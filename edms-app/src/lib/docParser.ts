import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import type { DocumentType } from './documentTypes';

// ─────────────────────────────────────────────────────────────────
// Tipe hasil
// ─────────────────────────────────────────────────────────────────

export type SourceType = 'docx' | 'pdf' | 'xlsx' | 'unsupported';

export interface ParsedAsset {
  id: number;
  data: Buffer;
  ext: string;
  mime: string;
}

export interface ParsedSectionOrderItem {
  key: string;
  title: string;
  isCustom: boolean;
}

export interface ParseContext {
  fileName?: string;
  relPath?: string;
}

export interface ParsedDocumentResult {
  /** Kode dari nama berkas; '' bila tidak ada (biarkan pembuat skrip yang generate). */
  kode: string;
  judul: string;
  detectedType: DocumentType;
  sourceType: SourceType;
  /** Konten masih memakai placeholder @@IMG:{id}@@ sampai di-materialize. */
  sections: Record<string, string>;
  sectionOrder: ParsedSectionOrderItem[];
  /** Kop surat hasil ekstrak word/header*.xml (juga memakai placeholder). */
  kopHtml: string | null;
  assets: ParsedAsset[];
  warnings: string[];
}

const SECTION_ORDER_KEY = '_section_order';
const MAX_SECTION_KEY = 60;

// ─────────────────────────────────────────────────────────────────
// Utilitas teks / HTML
// ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────
// Penampilan judul seksi
// ─────────────────────────────────────────────────────────────────

function presentTitle(raw: string): string {
  return collapse(raw).replace(/[\s:.\-–—]+$/, '').trim();
}

const NAV_HEADING_PATTERNS = [
  /^riwayat\s+perubahan/i,
  /^daftar\s+isi/i,
  /^daftar\s+lampiran/i,
  /^daftar\s+tabel/i,
  /^daftar\s+gambar/i,
  /^lembar\s+pengesahan/i,
  /^halaman\s+pengesahan/i,
  /^peta\s+proses/i,
];

function isUsableHeadingTitle(raw: string): boolean {
  const t = collapse(raw);
  if (!t || t.length > 200) return false;
  if (NAV_HEADING_PATTERNS.some((re) => re.test(t))) return false;
  if (/:\s*$/.test(t)) return false;                 // label kolom, bukan judul bagian
  if (!/[A-Za-z]{3}/.test(t)) return false;          // harus ada minimal 3 huruf berurutan
  if (/^[\s.\-–—_·•*]*$/.test(t)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// Membaca arsip ZIP (docx) tanpa dependensi ekstra
// ─────────────────────────────────────────────────────────────────

export function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();

  let eocd = -1;
  const scanFrom = Math.max(0, buffer.length - 66000);
  for (let i = buffer.length - 22; i >= scanFrom; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Bukan berkas ZIP/DOCX yang valid (EOCD tidak ditemukan).');

  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(p + 10);
    const compSize = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const cmtLen = buffer.readUInt16LE(p + 32);
    const localOff = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);

    try {
      if (localOff + 30 <= buffer.length && buffer.readUInt32LE(localOff) === 0x04034b50) {
        const lNameLen = buffer.readUInt16LE(localOff + 26);
        const lExtraLen = buffer.readUInt16LE(localOff + 28);
        const dataStart = localOff + 30 + lNameLen + lExtraLen;
        const raw = buffer.subarray(dataStart, dataStart + compSize);
        let data: Buffer;
        if (method === 0) data = Buffer.from(raw);
        else if (method === 8) data = zlib.inflateRawSync(raw);
        else data = Buffer.alloc(0);
        if (!out.has(name)) out.set(name, data);
      }
    } catch {
      // entri rusak dilewati — tidak menggagalkan seluruh dokumen
    }

    p += 46 + nameLen + extraLen + cmtLen;
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────
// Parser XML minimal (untuk WordprocessingML header/kop)
// ─────────────────────────────────────────────────────────────────

export interface XNode {
  tag: string;
  attrs: Record<string, string>;
  children: Array<XNode | string>;
}

function localName(tag: string): string {
  const i = tag.lastIndexOf(':');
  return i < 0 ? tag : tag.slice(i + 1);
}

function childrenOf(node: XNode): XNode[] {
  const out: XNode[] = [];
  for (const c of node.children) if (typeof c !== 'string') out.push(c);
  return out;
}

function findChild(node: XNode, name: string): XNode | null {
  for (const c of childrenOf(node)) if (localName(c.tag) === name) return c;
  return null;
}

function parseXml(src: string): XNode | null {
  const n = src.length;
  const stack: XNode[] = [];
  let root: XNode | null = null;
  let i = 0;

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i && stack.length) stack[stack.length - 1].children.push(src.slice(i, lt));

    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<?', lt)) { const e = src.indexOf('?>', lt); i = e < 0 ? n : e + 2; continue; }
    if (src.startsWith('<![CDATA[', lt)) {
      const e = src.indexOf(']]>', lt);
      if (stack.length && e >= 0) stack[stack.length - 1].children.push(src.slice(lt + 9, e));
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith('<!', lt)) { const e = src.indexOf('>', lt); i = e < 0 ? n : e + 1; continue; }

    const gt = src.indexOf('>', lt);
    if (gt < 0) break;
    const inner = src.slice(lt + 1, gt);

    if (inner.startsWith('/')) {
      const tag = inner.slice(1).trim();
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === tag) { stack.length = k; break; }
      }
      i = gt + 1;
      continue;
    }

    const selfClose = inner.endsWith('/');
    const body = selfClose ? inner.slice(0, -1) : inner;
    const sp = body.search(/[\s/]/);
    const tag = (sp < 0 ? body : body.slice(0, sp)).trim();
    const attrStr = sp < 0 ? '' : body.slice(sp);
    const attrs: Record<string, string> = {};
    const re = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(attrStr))) {
      const k = m[1] ?? m[3];
      const v = m[2] ?? m[4] ?? '';
      if (k) attrs[k] = decodeEntities(v);
    }

    const node: XNode = { tag, attrs, children: [] };
    if (stack.length) stack[stack.length - 1].children.push(node);
    else if (!root) root = node;
    if (!selfClose) stack.push(node);
    i = gt + 1;
  }

  return root;
}

// ─────────────────────────────────────────────────────────────────
// Aset gambar (placeholder @@IMG:{id}@@)
// ─────────────────────────────────────────────────────────────────

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('svg')) return 'svg';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('gif')) return 'gif';
  if (m.includes('bmp')) return 'bmp';
  if (m.includes('webp')) return 'webp';
  if (m.includes('tif')) return 'tif';
  if (m.includes('x-emf')) return 'emf';
  if (m.includes('x-wmf')) return 'wmf';
  return 'png';
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', tif: 'image/tiff',
  tiff: 'image/tiff',
};

function registerAsset(
  data: Buffer,
  mime: string,
  assets: ParsedAsset[],
  cache: Map<string, number>,
): string {
  const hash = crypto.createHash('md5').update(data).digest('hex');
  const known = cache.get(hash);
  if (known !== undefined) return `@@IMG:${known}@@`;
  const id = assets.length;
  assets.push({ id, data, ext: extForMime(mime), mime });
  cache.set(hash, id);
  return `@@IMG:${id}@@`;
}

const DATA_URL_RE = /data:image\/(png|jpe?g|gif|bmp|webp|svg\+xml|tiff?);base64,([A-Za-z0-9+/=]+)/gi;

function extractDataUrlImages(
  html: string,
  assets: ParsedAsset[],
  cache: Map<string, number>,
): string {
  return html.replace(DATA_URL_RE, (_whole, mime: string, b64: string) => {
    try {
      return registerAsset(Buffer.from(b64, 'base64'), `image/${mime}`, assets, cache);
    } catch {
      return '';
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// WordprocessingML → HTML (hanya untuk header/kop)
// ─────────────────────────────────────────────────────────────────

interface WmlCtx {
  entries: Map<string, Buffer>;
  rels: Map<string, string>;
  assets: ParsedAsset[];
  cache: Map<string, number>;
  fieldDepth: { value: number };
}

interface RunStyle {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  sz?: string;
  color?: string;
}

function readAttr(node: XNode, ...names: string[]): string | null {
  for (const nm of names) {
    const v = node.attrs[nm];
    if (v !== undefined && v !== '') return v;
    const short = nm.includes(':') ? nm.split(':').pop()! : nm;
    for (const k of Object.keys(node.attrs)) {
      if (k === short || k.endsWith(':' + short)) return node.attrs[k];
    }
  }
  return null;
}

function twipsToMm(twips: number): string {
  return `${Math.round((twips * 25.4) / 1440)}mm`;
}

function resolveRid(rid: string, ctx: WmlCtx): Buffer | null {
  const target = ctx.rels.get(rid);
  if (!target) return null;
  let key = target.replace(/\\/g, '/');
  if (key.startsWith('/')) key = key.slice(1);
  else if (!key.startsWith('word/')) key = `word/${key}`;
  return ctx.entries.get(key) ?? null;
}

function imageFromDrawing(node: XNode, ctx: WmlCtx): string | null {
  const blip = findDescendant(node, 'blip');
  const rid = blip ? (readAttr(blip, 'r:embed', 'r:link', 'embed', 'link')) : null;
  const vml = findDescendant(node, 'imagedata');
  const rid2 = vml ? readAttr(vml, 'r:id', 'id') : null;
  const useRid = rid ?? rid2;
  if (!useRid) return null;
  const buf = resolveRid(useRid, ctx);
  if (!buf || buf.length < 40) return null;
  const target = ctx.rels.get(useRid) || '';
  const ext = (target.split('.').pop() || 'png').toLowerCase();
  const mime = EXT_MIME[ext] || 'image/png';
  return registerAsset(buf, mime, ctx.assets, ctx.cache);
}

function findDescendant(node: XNode, name: string): XNode | null {
  for (const c of childrenOf(node)) {
    if (localName(c.tag) === name) return c;
    const deep = findDescendant(c, name);
    if (deep) return deep;
  }
  return null;
}

function applyRunStyle(html: string, st: RunStyle): string {
  if (!html) return html;
  let out = html;
  const styles: string[] = [];
  if (st.sz) styles.push(`font-size:${st.sz}pt`);
  if (st.color && st.color !== 'auto') styles.push(`color:#${st.color.replace('#', '')}`);
  if (st.u) styles.push('text-decoration:underline');
  if (styles.length) out = `<span style="${styles.join(';')}">${out}</span>`;
  if (st.i) out = `<em>${out}</em>`;
  if (st.b) out = `<strong>${out}</strong>`;
  return out;
}

function runStyleOf(run: XNode): RunStyle {
  const st: RunStyle = {};
  const rPr = findChild(run, 'rPr');
  if (!rPr) return st;
  const b = findChild(rPr, 'b');
  if (b && (readAttr(b, 'w:val') ?? '1') !== '0') st.b = true;
  const i = findChild(rPr, 'i');
  if (i && (readAttr(i, 'w:val') ?? '1') !== '0') st.i = true;
  const u = findChild(rPr, 'u');
  if (u && (readAttr(u, 'w:val') ?? 'single') !== 'none') st.u = true;
  const sz = findChild(rPr, 'sz');
  const szVal = sz ? readAttr(sz, 'w:val') : null;
  if (szVal && !isNaN(parseFloat(szVal))) st.sz = String(parseFloat(szVal) / 2);
  const color = findChild(rPr, 'color');
  const colorVal = color ? readAttr(color, 'w:val') : null;
  if (colorVal && colorVal !== 'auto') st.color = colorVal;
  return st;
}

function wmlInline(node: XNode, ctx: WmlCtx, st: RunStyle): string {
  const name = localName(node.tag);

  if (name === 't') {
    const txt = node.children.filter((c): c is string => typeof c === 'string').join('');
    return applyRunStyle(escapeHtml(txt), st);
  }
  if (name === 'tab') return applyRunStyle('&#160;&#160;&#160;', st);
  if (name === 'br') return '<br>';
  if (name === 'instrText' || name === 'delText' || name === 'noBreakHyphen' || name === 'softHyphen') return '';
  if (name === 'fldChar') {
    const typ = readAttr(node, 'w:fldCharType') ?? '';
    if (typ === 'begin') ctx.fieldDepth.value++;
    else if (typ === 'end') ctx.fieldDepth.value = Math.max(0, ctx.fieldDepth.value - 1);
    return '';
  }
  if (name === 'drawing' || name === 'pict' || name === 'object') {
    const src = imageFromDrawing(node, ctx);
    return src ? `<img src="${src}" alt="">` : '';
  }
  if (name === 'rPr' || name === 'pPr' || name === 'tcPr' || name === 'tblPr' || name === 'trPr') return '';

  let out = '';
  for (const c of node.children) {
    if (typeof c === 'string') {
      if (ctx.fieldDepth.value === 0) out += applyRunStyle(escapeHtml(c), st);
      continue;
    }
    const cn = localName(c.tag);
    if (cn === 'r') {
      out += wmlInline(c, ctx, { ...st, ...runStyleOf(c) });
      continue;
    }
    if (ctx.fieldDepth.value > 0 && cn !== 'fldChar') continue;
    if (cn === 'p') { out += wmlParagraph(c, ctx); continue; }
    if (cn === 'tbl') { out += wmlTable(c, ctx); continue; }
    out += wmlInline(c, ctx, st);
  }
  return out;
}

function wmlParagraph(node: XNode, ctx: WmlCtx): string {
  const styles: string[] = [];
  const pPr = findChild(node, 'pPr');

  if (pPr) {
    const jc = findChild(pPr, 'jc');
    const val = jc ? readAttr(jc, 'w:val') : null;
    if (val === 'center') styles.push('text-align:center');
    else if (val === 'right') styles.push('text-align:right');
    else if (val === 'both' || val === 'distribute') styles.push('text-align:justify');

    const ind = findChild(pPr, 'ind');
    if (ind) {
      const left = parseFloat(readAttr(ind, 'w:left', 'w:start') ?? '0');
      if (left > 120) styles.push(`margin-left:${twipsToMm(left)}`);
      const first = parseFloat(readAttr(ind, 'w:firstLine') ?? '0');
      if (first > 0) styles.push(`text-indent:${twipsToMm(first)}`);
    }

    const pBdr = findChild(pPr, 'pBdr');
    if (pBdr) {
      const bottom = findChild(pBdr, 'bottom');
      const bVal = bottom ? readAttr(bottom, 'w:val') : null;
      if (bVal && bVal !== 'none' && bVal !== 'nil') styles.push('border-bottom:1px solid #000');
    }
  }

  const inner = wmlInline(node, ctx, {});
  if (!inner.trim()) return '';
  const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
  return `<p${styleAttr}>${inner}</p>`;
}

function tableIsBorderless(tblPr: XNode | null): boolean {
  if (!tblPr) return false;
  const borders = findChild(tblPr, 'tblBorders');
  if (borders) {
    const sides = ['top', 'left', 'bottom', 'right']
      .map((s) => findChild(borders, s))
      .filter((x): x is XNode => !!x)
      .map((x) => (readAttr(x, 'w:val') ?? 'single').toLowerCase());
    if (sides.length && sides.every((v) => v === 'none' || v === 'nil')) return true;
    if (sides.length) return false;
  }
  return !findChild(tblPr, 'tblStyle');
}

function wmlTable(node: XNode, ctx: WmlCtx): string {
  const tblPr = findChild(node, 'tblPr');
  const borderless = tableIsBorderless(tblPr);

  let colgroup = '';
  const grid = findChild(node, 'tblGrid');
  if (grid) {
    const cols = childrenOf(grid)
      .filter((c) => localName(c.tag) === 'gridCol')
      .map((c) => readAttr(c, 'w:w'))
      .filter((w): w is string => !!w);
    if (cols.length) {
      const total = cols.reduce((s, w) => s + (parseFloat(w) || 0), 0);
      if (total > 0) {
        colgroup = `<colgroup>${cols
          .map((w) => `<col style="width:${((parseFloat(w) || 0) / total) * 100}%">`)
          .join('')}</colgroup>`;
      }
    }
  }

  const tableStyle = borderless
    ? 'width:100%;border-collapse:collapse;border:none;'
    : 'width:100%;border-collapse:collapse;';
  const cellStyle = borderless
    ? 'border:none;padding:2px 5px;vertical-align:top;'
    : 'border:1px solid #000;padding:3px 6px;vertical-align:top;';

  const openMerge = new Map<number, { count: number; row: number }>();
  let rows = '';
  let rowIndex = -1;

  for (const tr of childrenOf(node).filter((c) => localName(c.tag) === 'tr')) {
    rowIndex++;
    let gridIdx = 0;
    let cells = '';
    const continued = new Set<number>();

    for (const tc of childrenOf(tr).filter((c) => localName(c.tag) === 'tc')) {
      const tcPr = findChild(tc, 'tcPr');
      const spanRaw = tcPr ? readAttr(tcPr, 'w:gridSpan') : null;
      const span = spanRaw ? Math.max(1, parseInt(spanRaw, 10) || 1) : 1;

      const vMergeNode = tcPr ? findChild(tcPr, 'vMerge') : null;
      const vMergeVal = vMergeNode ? (readAttr(vMergeNode, 'w:val') ?? 'continue') : null;

      if (vMergeVal === 'continue') {
        const open = openMerge.get(gridIdx);
        if (open) { open.count += 1; continued.add(gridIdx); }
        gridIdx += span;
        continue;
      }

      const pending = openMerge.get(gridIdx);
      const rowspan = pending ? pending.count + 1 : 1;
      if (pending) openMerge.delete(gridIdx);

      const style: string[] = [];
      const jc = tcPr ? findChild(tcPr, 'jc') : null;
      const jv = jc ? readAttr(jc, 'w:val') : null;
      if (jv === 'center') style.push('text-align:center');
      else if (jv === 'right') style.push('text-align:right');
      const shd = tcPr ? findChild(tcPr, 'shd') : null;
      const fill = shd ? readAttr(shd, 'w:fill') : null;
      if (fill && fill !== 'auto' && fill !== 'nil') style.push(`background-color:#${fill}`);

      const inner = wmlInline(tc, ctx, {});
      const attrs = [
        `style="${cellStyle}${style.join(';')}"`,
        span > 1 ? `colspan="${span}"` : '',
        rowspan > 1 ? `rowspan="${rowspan}"` : '',
      ].filter(Boolean).join(' ');

      cells += `<td ${attrs}>${inner}</td>`;

      if (vMergeVal === 'restart') openMerge.set(gridIdx, { count: 0, row: rowIndex });
      gridIdx += span;
    }

    // entri yang tidak dilanjutkan di baris ini sudah tidak berlaku
    for (const key of [...openMerge.keys()]) {
      const e = openMerge.get(key)!;
      if (e.row < rowIndex && !continued.has(key)) openMerge.delete(key);
    }

    if (cells) rows += `<tr>${cells}</tr>`;
  }

  if (!rows) return '';
  return `<table style="${tableStyle}">${colgroup}${rows}</table>`;
}

function wmlToHtml(root: XNode, ctx: WmlCtx): string {
  const out: string[] = [];

  const walk = (node: XNode) => {
    for (const c of childrenOf(node)) {
      const name = localName(c.tag);
      if (name === 'p') out.push(wmlParagraph(c, ctx));
      else if (name === 'tbl') out.push(wmlTable(c, ctx));
      else walk(c); // sdt, sdtContent, hdr, body, ...
    }
  };

  walk(root);
  return out.filter(Boolean).join('');
}

// ─────────────────────────────────────────────────────────────────
// Ekstraksi kop surat dari word/header*.xml
// ─────────────────────────────────────────────────────────────────

function readRels(entries: Map<string, Buffer>, relsPath: string): Map<string, string> {
  const buf = entries.get(relsPath);
  const map = new Map<string, string>();
  if (!buf) return map;
  const root = parseXml(buf.toString('utf8'));
  if (!root) return map;
  for (const c of childrenOf(root)) {
    if (localName(c.tag) !== 'Relationship') continue;
    const id = c.attrs['Id'];
    const tgt = c.attrs['Target'];
    if (id && tgt) map.set(id, tgt);
  }
  return map;
}

function extractKop(
  entries: Map<string, Buffer>,
  ctx: WmlCtx,
  hint: { kode?: string; judul?: string },
): { html: string | null; usedHeader: string | null } {
  const headerNames = [...entries.keys()]
    .filter((k) => /^word\/header\d+\.xml$/i.test(k))
    .sort();

  let best: { html: string; score: number; name: string } | null = null;
  const kode = (hint.kode || '').toLowerCase();
  const judulWords = (hint.judul || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);

  for (const name of headerNames) {
    const xml = entries.get(name);
    if (!xml || xml.length < 40) continue;
    const root = parseXml(xml.toString('utf8'));
    if (!root) continue;

    ctx.rels = readRels(entries, name.replace(/([^/]+)$/, '_rels/$1.rels'));
    ctx.fieldDepth = { value: 0 };

    const html = wmlToHtml(root, ctx);
    if (!html) continue;

    const text = collapse(stripTags(html));
    if (text.length < 20) continue;

    let score = text.length;
    if (kode && text.toLowerCase().includes(kode)) score += 10000;
    if (judulWords.length) {
      const low = text.toLowerCase();
      const hits = judulWords.filter((w) => low.includes(w)).length;
      score += hits * 500;
    }
    if (/<img\s/i.test(html)) score += 300;
    if (/<table/i.test(html)) score += 200;

    if (!best || score > best.score) best = { html, score, name };
  }

  return { html: best ? best.html : null, usedHeader: best ? best.name : null };
}

// ─────────────────────────────────────────────────────────────────
// Pemindaian batas tabel di word/document.xml (mammoth membuangnya)
// ─────────────────────────────────────────────────────────────────

export function scanBodyBorderlessTables(docXml: string): boolean[] {
  const flags: boolean[] = [];
  const re = /<w:tbl>|<\/w:tbl>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(docXml)) !== null) {
    if (m[0] === '<w:tbl>') {
      const window = docXml.slice(m.index, m.index + 6000);
      const nextOpen = window.indexOf('<w:tbl>', 7);
      const nextClose = window.indexOf('</w:tbl>');
      const limit = nextOpen >= 0 && nextClose >= 0 ? Math.min(nextOpen, nextClose)
        : nextOpen >= 0 ? nextOpen
        : nextClose >= 0 ? nextClose : window.length;

      const head = window.slice(0, limit);
      const prMatch = head.match(/<w:tblPr(?:\s[^>]*)?>([\s\S]*?)<\/w:tblPr>|<w:tblPr(?:\s[^>]*)?\/>/);
      if (!prMatch) {
        flags.push(false);
      } else if (prMatch[1] === undefined) {
        flags.push(false); // <w:tblPr .../> tanpa isi
      } else {
        const pr = prMatch[1];
        const bMatch = pr.match(/<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/);
        if (bMatch) {
          const sides = ['top', 'left', 'bottom', 'right'].map((s) => {
            const sm = bMatch[1].match(new RegExp(`<w:${s}\\s([^>]*)/>`));
            if (!sm) return null;
            const vm = sm[1].match(/w:val="([^"]+)"/);
            return (vm ? vm[1] : 'single').toLowerCase();
          }).filter((v): v is string => v !== null);
          flags.push(sides.length > 0 && sides.every((v) => v === 'none' || v === 'nil'));
        } else {
          flags.push(!/<w:tblStyle\s/.test(pr));
        }
      }
    }
  }

  return flags;
}

function applyBorderlessFlags(html: string, flags: boolean[]): string {
  if (!flags.length) return html;
  const openCount = (html.match(/<table(?:\s[^>]*)?>/g) || []).length;
  if (openCount !== flags.length) return html; // jumlah tidak cocok → jangan menebak

  let idx = 0;
  return html.replace(/<table(\s[^>]*)?>/g, (whole, attrs: string | undefined) => {
    const i = idx++;
    if (!flags[i]) return whole;
    const a = attrs || '';
    if (/style\s*=/.test(a)) return `<table${a.replace(/style\s*=\s*"/, 'style="border:none;')}>`;
    return `<table style="border:none;"${a}>`;
  });
}

// ─────────────────────────────────────────────────────────────────
// Pemecah HTML menjadi node tingkat-atas
// ─────────────────────────────────────────────────────────────────

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

export interface TopNode {
  tag: string;
  raw: string;
  text: string;
  isText: boolean;
}

function tagNameOf(inner: string): string {
  const m = inner.match(/^[^\s/>]+/);
  return (m ? m[0] : '').toLowerCase();
}

export function splitTopLevel(html: string): TopNode[] {
  const nodes: TopNode[] = [];
  const n = html.length;
  let depth = 0;
  let openStart = -1;
  let openTag = '';
  let i = 0;
  let textStart = 0;

  const flushText = (end: number) => {
    if (depth !== 0 || end <= textStart) return;
    const raw = html.slice(textStart, end);
    if (raw.trim().length) {
      nodes.push({ tag: '#text', raw, text: collapse(stripTags(raw)), isText: true });
    }
  };

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { flushText(n); break; }

    if (html.startsWith('<!--', lt)) {
      flushText(lt);
      const e = html.indexOf('-->', lt);
      i = e < 0 ? n : e + 3;
      textStart = i;
      continue;
    }

    const gt = html.indexOf('>', lt);
    if (gt < 0) { flushText(n); break; }

    flushText(lt);

    const inner = html.slice(lt + 1, gt);
    const isClose = inner.startsWith('/');

    if (isClose) {
      if (depth === 1) {
        depth = 0;
        const raw = html.slice(openStart, gt + 1);
        nodes.push({ tag: openTag, raw, text: collapse(stripTags(raw)), isText: false });
        openStart = -1;
      } else if (depth > 1) {
        depth--;
      }
      i = gt + 1;
      textStart = i;
      continue;
    }

    const selfClose = inner.endsWith('/');
    const tag = tagNameOf(inner);

    if (depth === 0) {
      if (selfClose || VOID_TAGS.has(tag)) {
        const raw = html.slice(lt, gt + 1);
        nodes.push({ tag, raw, text: collapse(stripTags(raw)), isText: false });
      } else {
        depth = 1;
        openStart = lt;
        openTag = tag;
      }
      i = gt + 1;
      textStart = i;
      continue;
    }

    if (!selfClose && !VOID_TAGS.has(tag)) depth++;
    i = gt + 1;
  }

  if (depth > 0 && openStart >= 0) {
    const raw = html.slice(openStart);
    nodes.push({ tag: openTag, raw, text: collapse(stripTags(raw)), isText: false });
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────
// Penyusunan seksi (hybrid)
// ─────────────────────────────────────────────────────────────────

interface Anchor {
  idx: number;
  kind: 'heading' | 'bagian' | 'table';
  title: string;
  keyHint: string;
}

function makeKey(base: string, used: Set<string>): string {
  const root = (base || 'bagian').slice(0, MAX_SECTION_KEY);
  if (!used.has(root)) { used.add(root); return root; }
  let n = 2;
  for (;;) {
    const suffix = `_${n}`;
    const cand = root.slice(0, MAX_SECTION_KEY - suffix.length) + suffix;
    if (!used.has(cand)) { used.add(cand); return cand; }
    n++;
    if (n > 9999) return root;
  }
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SECTION_KEY);
}

function titleCaseFromKey(key: string): string {
  return collapse(key.replace(/_/g, ' '))
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
}

function pickHeadingAnchors(nodes: TopNode[]): Anchor[] {
  const heads = nodes
    .map((node, idx) => ({ node, idx }))
    .filter(({ node }) => /^h[1-6]$/.test(node.tag) && isUsableHeadingTitle(node.text));

  if (!heads.length) return [];

  for (let level = 1; level <= 6; level++) {
    const atLevel = heads.filter(({ node }) => node.tag === `h${level}`);
    if (atLevel.length >= 2) {
      return atLevel.map(({ node, idx }) => ({
        idx,
        kind: 'heading' as const,
        title: presentTitle(node.text),
        keyHint: slug(node.text),
      }));
    }
  }

  // Tidak ada level dengan ≥2 judul: pakai level yang paling banyak (bisa 1).
  let best: typeof heads = [];
  for (let level = 1; level <= 6; level++) {
    const atLevel = heads.filter(({ node }) => node.tag === `h${level}`);
    if (atLevel.length > best.length) best = atLevel;
  }
  return best.map(({ node, idx }) => ({
    idx,
    kind: 'heading' as const,
    title: presentTitle(node.text),
    keyHint: slug(node.text),
  }));
}

const BAGIAN_RE = /^\s*Bagian\s+(\d+)\s*[:.\-]?\s*(.*)$/i;

function pickBagianAnchors(nodes: TopNode[]): Anchor[] {
  const out: Anchor[] = [];
  nodes.forEach((node, idx) => {
    if (node.tag !== 'p') return;
    const m = node.text.match(BAGIAN_RE);
    if (!m) return;
    const rest = (m[2] || '').replace(/^[:.\-\s]+/, '').trim();
    out.push({
      idx,
      kind: 'bagian',
      title: presentTitle(rest) || `Bagian ${m[1]}`,
      keyHint: `bagian_${m[1]}`,
    });
  });
  return out;
}

const SENTENCE_CONNECTORS = new RegExp(
  `\\b(yang|dengan|adalah|akan|untuk|dapat|berikut|tersebut|sebagai|daripada|berikut|dibawah|di\\s+bawah)\\b`,
  'i',
);

function titleCaseRatio(t: string): number {
  const words = t.split(/[^A-Za-z]+/).filter((w) => w.length >= 3);
  if (!words.length) return 0;
  return words.filter((w) => w[0] === w[0].toUpperCase()).length / words.length;
}

function uppercaseRatio(t: string): number {
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (!letters.length) return 0;
  return letters.replace(/[^A-Z]/g, '').length / letters.length;
}

/** Judul tabel bukan kalimat: kalimat mengandung kata sambung dan bukan huruf besar semua. */
function isTableTitleCandidate(t: string): boolean {
  if (!t || t.length > 90) return false;
  if (!/[A-Za-z]{3}/.test(t)) return false;
  if (/:/.test(t)) return false;                       // label kolom / baris isian, bukan judul
  if (/_ {2,}|\.{4,}|-{5,}/.test(t)) return false;      // garis pengisian
  if (/->|=>|→/.test(t)) return false;                  // legenda/keterangan alur, bukan judul
  if (/\.\s*$/.test(t) && SENTENCE_CONNECTORS.test(t)) return false;
  if (SENTENCE_CONNECTORS.test(t) && uppercaseRatio(t) < 0.85 && titleCaseRatio(t) < 0.7) return false;
  return true;
}

function pickTableAnchors(nodes: TopNode[]): Anchor[] {
  const out: Anchor[] = [];
  nodes.forEach((node, idx) => {
    if (node.tag !== 'table') return;
    let title = '';
    for (let j = idx - 1; j >= 0; j--) {
      const prev = nodes[j];
      if (prev.isText) continue;
      if (prev.tag === 'table') break;
      if (prev.tag === 'p' || /^h[1-6]$/.test(prev.tag)) {
        const t = presentTitle(prev.text);
        const boldish = /<strong/i.test(prev.raw);
        if (isTableTitleCandidate(t)) {
          if (boldish) { title = t; break; }
          if (!title) title = t;
        }
      }
    }
    out.push({
      idx,
      kind: 'table',
      title: title || `Tabel ${out.length + 1}`,
      keyHint: '',
    });
  });
  return out;
}

interface BuiltSection { key: string; title: string; content: string }

function rawBetween(nodes: TopNode[], start: number, end: number): string {
  const parts: string[] = [];
  for (let i = Math.max(0, start); i < Math.min(end, nodes.length); i++) parts.push(nodes[i].raw);
  return parts.join('');
}

// ── Tabel klause: <tr> berisi [kosong | <hN>Judul</hN> | ':' | Isi] ──────

const CLAUSE_KEY_RULES: Array<[RegExp, string]> = [
  [/^tujuan$/i, 'tujuan'],
  [/^ruang\s+lingkup/i, 'ruang_lingkup'],
  [/^(?:dokumen\s+)?referensi|standar\s+acuan|dasar\s+hukum/i, 'referensi'],
  [/^proses\s+bisnis|pohon\s+bisnis/i, 'proses_bisnis'],
  [/^(?:istilah|definisi)/i, 'istilah_definisi'],
  [/^(?:alur\s+pros|uraian\s+kegiatan|langkah\s+kerja|tahapan)/i, 'alur_prosedur'],
  [/^dokumen\s+pendukung/i, 'dokumen_pendukung'],
  [/^(?:personil|kualifikasi)/i, 'personil'],
  [/^peralatan/i, 'peralatan_kerja'],
  [/^(?:perlengkapan|k3|apd)/i, 'perlengkapan_k3'],
  [/^(?:material|bahan)/i, 'material'],
  [/^petunjuk\s+pengisian/i, 'petunjuk_pengisian'],
  [/^daftar\s+rekaman/i, 'daftar_rekaman'],
];

function clauseKeyFor(title: string): string {
  for (const [re, key] of CLAUSE_KEY_RULES) if (re.test(title)) return key;
  return slug(title) || 'bagian';
}

interface HtmlPart {
  start: number;
  open: string;
  inner: string;
  close: string;
  end: number;
}

/** Kumpulkan potongan `<tag>`…`</tag>` dengan penanganan tag bersarang. */
function collectParts(html: string, tagRe: string): HtmlPart[] {
  const re = new RegExp(`<\\/?(${tagRe})(\\s[^>]*)?>`, 'gi');
  const out: HtmlPart[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith('</')) continue; // penutup yatim
    const openEnd = re.lastIndex;
    let depth = 1;
    let innerEnd = -1;
    let closeEnd = -1;
    let c: RegExpExecArray | null;
    while ((c = re.exec(html)) !== null) {
      depth += c[0].startsWith('</') ? -1 : 1;
      if (depth === 0) { innerEnd = c.index; closeEnd = re.lastIndex; break; }
    }
    if (innerEnd < 0) { innerEnd = html.length; closeEnd = html.length; }
    out.push({
      start: m.index,
      open: html.slice(m.index, openEnd),
      inner: html.slice(openEnd, innerEnd),
      close: html.slice(innerEnd, closeEnd),
      end: closeEnd,
    });
    re.lastIndex = closeEnd;
  }
  return out;
}

function isFillerCell(inner: string): boolean {
  const t = collapse(stripTags(inner));
  return t === '' || /^[:：]$/.test(t) || /^[.\-–—_·•\s]*$/.test(t);
}

function cellHeadingText(cellInner: string): string | null {
  const m = cellInner.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i);
  if (!m) return null;
  return collapse(stripTags(m[0]));
}

function headingCellIndex(cells: HtmlPart[]): number {
  for (let i = 0; i < cells.length; i++) {
    if (!/<h[1-6][^>]*>/i.test(cells[i].inner)) continue;
    if (/<table[\s>]/i.test(cells[i].inner)) continue; // heading milik tabel bersarang
    return i;
  }
  return -1;
}

function countClauseRows(tableRaw: string): number {
  if ((tableRaw.match(/<h[1-6][^>]*>/gi) || []).length < 2) return 0;
  let n = 0;
  for (const row of collectParts(tableRaw, 'tr')) {
    const cells = collectParts(row.inner, 'td|th');
    const hi = headingCellIndex(cells);
    if (hi >= 0 && isUsableHeadingTitle(cellHeadingText(cells[hi].inner) || '')) n++;
  }
  return n;
}

function cellOpenTag(c: HtmlPart): string {
  return c.close ? `${c.open}${c.inner}${c.close}` : `${c.open}${c.inner}${/^<\s*th/i.test(c.open) ? '</th>' : '</td>'}`;
}

function buildClauseSections(
  tableNode: TopNode,
  used: Set<string>,
  out: BuiltSection[],
): void {
  const wrapStyle = /border\s*:\s*none/.test(tableNode.raw)
    ? 'width:100%;border-collapse:collapse;border:none;'
    : 'width:100%;border-collapse:collapse;';
  const wrapRow = (inner: string) => `<table style="${wrapStyle}"><tbody><tr>${inner}</tr></tbody></table>`;

  let prefix = '';
  let current: { title: string; key: string; parts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const content = current.parts.join('').trim();
    if (content) {
      out.push({ key: makeKey(current.key, used), title: current.title, content });
    }
    current = null;
  };

  for (const row of collectParts(tableNode.raw, 'tr')) {
    const cells = collectParts(row.inner, 'td|th');
    const hi = headingCellIndex(cells);
    const headingText = hi >= 0 ? cellHeadingText(cells[hi].inner) : null;

    if (hi >= 0 && headingText && isUsableHeadingTitle(headingText)) {
      if (prefix) {
        out.push({
          key: makeKey(`tabel_${String(out.length + 1).padStart(2, '0')}`, used),
          title: 'Tabel',
          content: prefix.trim(),
        });
        prefix = '';
      }
      flush();

      const title = presentTitle(headingText);
      const contentCells = cells.filter((c, i) => i !== hi && !isFillerCell(c.inner));
      const content = contentCells.length === 1 ? contentCells[0].inner
        : contentCells.length > 1 ? wrapRow(contentCells.map(cellOpenTag).join(''))
        : cells[hi].inner;

      current = { title, key: clauseKeyFor(title), parts: [content] };
    } else if (current) {
      current.parts.push(wrapRow(row.inner));
    } else {
      prefix += `${row.open}${row.inner}${row.close}`;
    }
  }

  flush();

  if (prefix.trim()) {
    out.push({
      key: makeKey(`tabel_${String(out.length + 1).padStart(2, '0')}`, used),
      title: 'Tabel',
      content: prefix.trim(),
    });
  }
}

function buildInto(
  nodes: TopNode[],
  anchors: Anchor[],
  used: Set<string>,
  out: BuiltSection[],
  warnings: string[],
): void {
  if (!anchors.length) {
    const content = nodes.map((n) => n.raw).join('').trim();
    if (content) out.push({ key: makeKey('isi_dokumen', used), title: 'Isi Dokumen', content });
    return;
  }

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    let content: string;

    if (a.kind === 'table') {
      const start = i === 0 ? 0 : anchors[i - 1].idx + 1;
      const end = i + 1 < anchors.length ? a.idx + 1 : nodes.length;
      content = rawBetween(nodes, start, end);
    } else {
      const bodyStart = a.idx + 1;
      const bodyEnd = i + 1 < anchors.length ? anchors[i + 1].idx : nodes.length;
      const preamble = i === 0 ? rawBetween(nodes, 0, a.idx) : '';
      content = preamble + rawBetween(nodes, bodyStart, bodyEnd);
    }

    content = content.trim();
    if (!content) continue;

    let key = a.keyHint ? makeKey(a.keyHint.slice(0, MAX_SECTION_KEY), used) : '';
    if (a.kind === 'table') {
      key = makeKey(`tabel_${String(out.length + 1).padStart(2, '0')}`, used);
    } else if (!key) {
      key = makeKey(`bagian_${out.length + 1}`, used);
    }

    out.push({ key, title: a.title || `Bagian ${out.length + 1}`, content });
  }

  if (!out.length) {
    const content = nodes.map((n) => n.raw).join('').trim();
    if (content) out.push({ key: makeKey('isi_dokumen', used), title: 'Isi Dokumen', content });
    warnings.push('Tidak ada anchor yang valid; seluruh isi dijadikan satu seksi.');
  }
}

function finish(
  built: BuiltSection[],
  warnings: string[],
): { sections: Record<string, string>; order: ParsedSectionOrderItem[] } {
  const sections: Record<string, string> = {};
  const order: ParsedSectionOrderItem[] = [];

  for (const b of built) {
    if (Object.prototype.hasOwnProperty.call(sections, b.key)) {
      warnings.push(`Key seksi duplikat "${b.key}" dilewati.`);
      continue;
    }
    sections[b.key] = b.content;
    order.push({ key: b.key, title: b.title, isCustom: true });
  }

  sections[SECTION_ORDER_KEY] = JSON.stringify(order);
  return { sections, order };
}

/** Dokumen berisi satu seksi: ganti judul hasil generate ("Tabel 1") dengan judul dokumen. */
function retitleSingleSection(
  sections: Record<string, string>,
  order: ParsedSectionOrderItem[],
  judul: string,
): void {
  if (order.length !== 1 || !judul) return;
  const item = order[0];
  if (/^(Tabel \d+|Isi Dokumen|Bagian \d+)$/.test(item.title) || !isTableTitleCandidate(item.title)) {
    item.title = collapse(judul).slice(0, 90);
    item.isCustom = true;
    sections[SECTION_ORDER_KEY] = JSON.stringify(order);
  }
}

function splitSections(html: string, warnings: string[]): {
  sections: Record<string, string>;
  order: ParsedSectionOrderItem[];
} {
  const nodes = splitTopLevel(html);
  const used = new Set<string>();
  const out: BuiltSection[] = [];

  // 1. Heading tingkat-atas (Manual Mutu, dokumen berstruktur klausul polos)
  const headingAnchors = pickHeadingAnchors(nodes);
  if (headingAnchors.length >= 2) {
    buildInto(nodes, headingAnchors, used, out, warnings);
    return finish(out, warnings);
  }

  // 2. Penanda "Bagian N" (formulir instrumen)
  const bagianAnchors = pickBagianAnchors(nodes);
  if (bagianAnchors.length) {
    buildInto(nodes, bagianAnchors, used, out, warnings);
    return finish(out, warnings);
  }

  // 3. Tabel klause: satu baris = satu klausul (tipikal dokumen PR)
  const isClause = nodes.map((n) => n.tag === 'table' && countClauseRows(n.raw) >= 2);
  if (isClause.some(Boolean)) {
    let bufStart = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (!isClause[i]) continue;
      const buf = nodes.slice(bufStart, i);
      if (buf.length) buildInto(buf, pickTableAnchors(buf), used, out, warnings);
      buildClauseSections(nodes[i], used, out);
      bufStart = i + 1;
    }
    const tail = nodes.slice(bufStart);
    if (tail.length) buildInto(tail, pickTableAnchors(tail), used, out, warnings);
    return finish(out, warnings);
  }

  // 4. Per tabel (formulir tanpa judul bagian)
  const tableAnchors = pickTableAnchors(nodes);
  if (tableAnchors.length) {
    buildInto(nodes, tableAnchors, used, out, warnings);
    return finish(out, warnings);
  }

  buildInto(nodes, [], used, out, warnings);
  return finish(out, warnings);
}

// ─────────────────────────────────────────────────────────────────
// Metadata dari nama berkas & jenis dokumen
// ─────────────────────────────────────────────────────────────────

export function parseFileName(fileName: string): { kode: string; judul: string; ext: string; base: string } {
  let base = fileName || '';
  let ext = '';

  const mExt = base.match(/\.(docx|doc|xlsx|pdf|drawio)$/i);
  if (mExt) {
    ext = mExt[1].toLowerCase();
    base = base.slice(0, -mExt[0].length);
  }
  // nama ganda seperti "...docx.docx" atau "...docx.pdf"
  const mDup = base.match(/\.(docx|doc|xlsx|pdf)$/i);
  if (mDup) base = base.slice(0, -mDup[0].length);

  let kode = '';
  const mKode = base.match(/^([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+-\d{2})(?=\s|$)/);
  if (mKode) {
    kode = mKode[1];
    base = base.slice(mKode[1].length).trim();
  }

  return { kode, judul: cleanJudul(base), ext, base };
}

export function cleanJudul(raw: string): string {
  let out = collapse(raw);
  const patterns = [
    /\s*[-–—(]?\s*RE-?V(?:ISI)?[\s.\-–—0-9()A-Za-z]*$/i,
    /\s*[-–—]?\s*EDIT(?:\s*[-–—]\s*REVISI\s+[A-Za-z ]+)?\s*$/i,
    /\s*[-–—]?\s*FINAL\s*$/i,
    /\s*\(\d+\)\s*$/,
    /\s*,\s*$/,
    /\s+[-–—]\s*$/,
    /\s+\.\s*$/,
  ];
  let prev: string;
  let guard = 0;
  do {
    prev = out;
    for (const p of patterns) out = out.replace(p, '').trim();
    guard++;
  } while (out !== prev && guard < 8);
  return out;
}

export function detectType(ctx: ParseContext & { kode?: string; judul?: string }): DocumentType {
  const kode = (ctx.kode || '').toUpperCase();
  const name = `${ctx.fileName || ''}`.toLowerCase();
  const rel = (ctx.relPath || '').replace(/\//g, '\\').toLowerCase();

  if (/(^|[^a-z])manual mutu([^a-z]|$)/.test(name) || rel.includes('\\manual mutu\\')) return 'Manual Mutu';
  if (kode.startsWith('PR.')) return 'SOP/Prosedur';
  if (kode.startsWith('IK.')) return 'Instruksi Kerja';
  if (name.startsWith('lampiran') || /(^|[\\/])lampiran([\\/]|$)/.test(rel)) return 'Formulir Tambahan';
  // Kode baku 01.05/01.06/01.07 hanya di jalur FR.UPS.SER3.* (kode lain seperti
  // FR.UPS.PBR3.BST.01.06-00 adalah formulir biasa yang kebetulan punya nomor sama).
  const bakuForm = /^FR\.UPS\.SER3\.[A-Z]{3}\.01\.0[567]-\d{2}$/.test(kode);
  if ((bakuForm && /\.01\.05-\d{2}$/.test(kode)) || name.includes('berita acara pemusnahan')) return 'BA Pemusnahan Rekaman';
  if ((bakuForm && /\.01\.06-\d{2}$/.test(kode)) || name.includes('pernyataan kerahasiaan')) return 'Pernyataan Kerahasiaan';
  if ((bakuForm && /\.01\.07-\d{2}$/.test(kode)) || name.includes('daftar rekaman mutu')) return 'Daftar Rekaman Mutu';
  return 'Formulir Kerja';
}

// ─────────────────────────────────────────────────────────────────
// Materialisasi aset ke storage
// ─────────────────────────────────────────────────────────────────

export async function materializeParsedAssets(
  parsed: ParsedDocumentResult,
  targetDir: string,
  urlPrefix: string,
): Promise<{ sections: Record<string, string>; kopHtml: string | null }> {
  const map = new Map<number, string>();

  if (parsed.assets.length) {
    await fs.mkdir(targetDir, { recursive: true });
    for (const a of parsed.assets) {
      const name = `${String(a.id).padStart(3, '0')}.${a.ext}`;
      await fs.writeFile(path.join(targetDir, name), a.data);
      map.set(a.id, `${urlPrefix}/${name}`);
    }
  }

  const rewrite = (value: string | null): string | null =>
    value === null ? null : value.replace(/@@IMG:(\d+)@@/g, (_m, d: string) => map.get(Number(d)) ?? '');

  const sections: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.sections)) sections[k] = rewrite(v) ?? '';

  return { sections, kopHtml: rewrite(parsed.kopHtml) };
}

// ─────────────────────────────────────────────────────────────────
// Parser DOCX
// ─────────────────────────────────────────────────────────────────

export async function parseDocxBuffer(
  buffer: Buffer,
  ctx: ParseContext = {},
): Promise<ParsedDocumentResult> {
  const warnings: string[] = [];
  const meta = parseFileName(ctx.fileName || '');
  const detectedType = detectType({ ...ctx, kode: meta.kode, judul: meta.judul });

  const converted = await mammoth.convertToHtml({ buffer });
  const rawHtml = converted.value;
  for (const msg of converted.messages || []) {
    if (msg.type === 'error') warnings.push(`mammoth: ${msg.message}`);
  }

  const assets: ParsedAsset[] = [];
  const cache = new Map<string, number>();

  let bodyHtml = extractDataUrlImages(rawHtml, assets, cache);
  let kopHtml: string | null = null;

  // Tabel tanpa border ditandai berdasarkan sumber asli (mammoth membuang styling)
  try {
    const entries = readZipEntries(buffer);
    const docXml = entries.get('word/document.xml');
    if (docXml) {
      const flags = scanBodyBorderlessTables(docXml.toString('utf8'));
      bodyHtml = applyBorderlessFlags(bodyHtml, flags);
    }

    const wmlCtx: WmlCtx = {
      entries,
      rels: new Map(),
      assets,
      cache,
      fieldDepth: { value: 0 },
    };
    const kop = extractKop(entries, wmlCtx, { kode: meta.kode, judul: meta.judul });
    kopHtml = kop.html;
    if (!kop.html) warnings.push('Kop surat (word/header*.xml) tidak ditemukan atau kosong.');
  } catch (err) {
    kopHtml = null;
    warnings.push(`Ekstrak kop surat gagal: ${(err as Error).message}`);
  }

  const { sections, order } = splitSections(bodyHtml, warnings);

  if (!Object.keys(sections).filter((k) => k !== SECTION_ORDER_KEY).length) {
    warnings.push('Tidak ada isi yang dapat dibaca dari berkas ini.');
  }

  retitleSingleSection(sections, order, meta.judul);

  return {
    kode: meta.kode,
    judul: meta.judul || 'DOKUMEN MUTU TERKENDALI',
    detectedType,
    sourceType: 'docx',
    sections,
    sectionOrder: order,
    kopHtml,
    assets,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────
// Parser PDF
// ─────────────────────────────────────────────────────────────────

export async function parsePdfBuffer(
  buffer: Buffer,
  ctx: ParseContext = {},
): Promise<ParsedDocumentResult> {
  const warnings: string[] = [];
  const meta = parseFileName(ctx.fileName || '');
  const detectedType = detectType({ ...ctx, kode: meta.kode, judul: meta.judul });

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textObj = await parser.getText();
  const rawText: string = (textObj as { text?: string }).text || '';

  const clauseMarkers: Array<{ key: string; regex: RegExp }> = [
    { key: 'tujuan', regex: /(?:^|\n)(?:\d+[\.)]\s*)?TUJUAN\b/i },
    { key: 'ruang_lingkup', regex: /(?:^|\n)(?:\d+[\.)]\s*)?RUANG\s+LINGKUP\b/i },
    { key: 'referensi', regex: /(?:^|\n)(?:\d+[\.)]\s*)?(?:DOKUMEN\s+)?REFERENSI\b/i },
    { key: 'proses_bisnis', regex: /(?:^|\n)(?:\d+[\.)]\s*)?PROSES\s+BISNIS\b/i },
    { key: 'istilah_definisi', regex: /(?:^|\n)(?:\d+[\.)]\s*)?ISTILAH(?:\s+DAN\s+DEFINISI)?\b/i },
    { key: 'alur_prosedur', regex: /(?:^|\n)(?:\d+[\.)]\s*)?(?:ALUR\s+)?PROSEDUR\b/i },
    { key: 'dokumen_pendukung', regex: /(?:^|\n)(?:\d+[\.)]\s*)?DOKUMEN\s+PENDUKUNG\b/i },
  ];

  const found: Array<{ key: string; index: number }> = [];
  for (const cm of clauseMarkers) {
    const idx = rawText.search(cm.regex);
    if (idx !== -1) found.push({ key: cm.key, index: idx });
  }
  found.sort((a, b) => a.index - b.index);

  const sections: Record<string, string> = {};
  const order: ParsedSectionOrderItem[] = [];

  const toHtml = (text: string): string =>
    text
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => `<p>${escapeHtml(l.trim())}</p>`)
      .join('');

  if (found.length) {
    for (let i = 0; i < found.length; i++) {
      const start = found[i].index;
      const end = i + 1 < found.length ? found[i + 1].index : rawText.length;
      const chunk = rawText.slice(start, end);
      const lines = chunk.split('\n').filter((l) => l.trim().length > 0);
      lines.shift(); // buang baris penanda klausulnya
      const html = toHtml(lines.join('\n'));
      if (!html.trim()) continue;
      sections[found[i].key] = html;
      order.push({ key: found[i].key, title: titleCaseFromKey(found[i].key), isCustom: true });
    }
  }

  if (!order.length) {
    const html = toHtml(rawText.trim());
    if (html) {
      sections['isi_dokumen'] = html;
      order.push({ key: 'isi_dokumen', title: 'Isi Dokumen', isCustom: true });
      warnings.push('Tanda klausul tidak ditemukan; seluruh teks dijadikan satu seksi.');
    }
  }

  sections[SECTION_ORDER_KEY] = JSON.stringify(order);

  return {
    kode: meta.kode,
    judul: meta.judul || 'DOKUMEN MUTU TERKENDALI',
    detectedType,
    sourceType: 'pdf',
    sections,
    sectionOrder: order,
    kopHtml: null,
    assets: [],
    warnings,
  };
}
