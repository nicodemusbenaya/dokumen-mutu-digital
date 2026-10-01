/**
 * Logika murni parse/build tabel untuk TableGridEditor.
 * Sengaja bebas React/JSX agar bisa diuji round-trip dari skrip (parse → build
 * tidak boleh menghilangkan satu karakter pun isi dokumen).
 */

export interface GridCell {
  /** HTML asli di dalam sel (bold, <br>, paragraf, dsb.) — tidak pernah di-strip. */
  html: string;
  colSpan: number;
  rowSpan: number;
  /** Atribut selain colspan/rowspan (style, width, valign, ...). */
  attrs: string;
  tag: 'th' | 'td';
}

export type GridRow = (GridCell | null)[];

export interface ParsedTable {
  hasTable: boolean;
  /** Tabel tidak aman diedit lewat grid → biarkan TipTap yang menanganinya. */
  blocked: string | null;
  prefixHtml: string;
  suffixHtml: string;
  tableAttrs: string;
  headRowAttrs: string;
  headers: GridCell[] | null;
  rows: GridRow[];
}

export interface GridState {
  headers: GridCell[] | null;
  rows: GridRow[];
  prefix: string;
  suffix: string;
  tableAttrs: string;
  headRowAttrs: string;
}

export const EMPTY_TABLE: ParsedTable = {
  hasTable: false,
  blocked: null,
  prefixHtml: '',
  suffixHtml: '',
  tableAttrs: '',
  headRowAttrs: '',
  headers: null,
  rows: [],
};

// ─── Util HTML ────────────────────────────────────────────────────

export interface HtmlPart {
  start: number;
  end: number;
  open: string;
  inner: string;
  close: string;
}

/** Potongan `<tag>`…`</tag>` dengan penanganan tag bersarang. */
export function collectParts(html: string, tagRe: string): HtmlPart[] {
  const re = new RegExp(`<\\/?(${tagRe})(\\s[^>]*)?>`, 'gi');
  const out: HtmlPart[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith('</')) continue;
    const start = m.index;
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
      start,
      end: closeEnd,
      open: html.slice(start, openEnd),
      inner: html.slice(openEnd, innerEnd),
      close: html.slice(innerEnd, closeEnd),
    });
    re.lastIndex = closeEnd;
  }
  return out;
}

function readAttrInt(attrs: string, name: string): number {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("?)(\\d+)\\1`, 'i'));
  const n = m ? Number(m[2]) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function stripAttr(attrs: string, name: string): string {
  return attrs.replace(new RegExp(`\\s*\\b${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'), '');
}

function readCell(open: string, inner: string): GridCell {
  const tag: 'th' | 'td' = /^<\s*th/i.test(open) ? 'th' : 'td';
  const attrs = open.replace(/^<\s*[a-zA-Z]+/, '').replace(/>$/, '').trim();
  const colSpan = readAttrInt(attrs, 'colspan');
  const rowSpan = readAttrInt(attrs, 'rowspan');
  const rest = stripAttr(stripAttr(attrs, 'colspan'), 'rowspan').trim();
  return { html: inner, colSpan, rowSpan, attrs: rest, tag };
}

/**
 * Susun sel per baris menjadi kisi rectangular: slot yang tertutup
 * colspan/rowspan baris sebelumnya diisi `null` (tidak dirender, tidak diedit).
 */
export function buildGrid(rawRows: GridCell[][]): GridRow[] {
  const out: GridRow[] = [];
  let pending: Array<{ col: number; cell: GridCell; left: number }> = [];

  for (const cells of rawRows) {
    const row: GridRow = [];
    const still: typeof pending = [];

    for (const p of pending) {
      row[p.col] = null;
      if (p.left > 1) still.push({ ...p, left: p.left - 1 });
    }
    pending = still;

    let col = 0;
    for (const cell of cells) {
      while (row[col] !== undefined) col++;
      for (let k = 0; k < cell.colSpan; k++) {
        row[col + k] = k === 0 ? cell : null;
      }
      if (cell.rowSpan > 1) pending.push({ col, cell, left: cell.rowSpan - 1 });
      col += cell.colSpan;
    }

    out.push(row);
  }
  return out;
}

/** Hilangkan selindung colspan/rowspan (dipakai saat struktur baris diubah). */
export function flattenRows(rows: GridRow[]): GridCell[][] {
  return rows.map((row) => {
    const def: 'th' | 'td' = row.find((c) => c)?.tag ?? 'td';
    return row.map((c) =>
      c
        ? { ...c, colSpan: 1, rowSpan: 1 }
        : { html: '', colSpan: 1, rowSpan: 1, attrs: '', tag: def }
    );
  });
}

/** HTML → teks tampilan untuk textarea (formatting hilang hanya saat pengguna mengetik). */
export function cellToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|td|th)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/, '')
    .replace(/\n+$/, '');
}

/** Teks textarea → HTML sel. */
export function textToCell(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>');
}

// ─── Parse / Build ────────────────────────────────────────────────

export function parseTableFromHtml(html: string): ParsedTable {
  if (!html || !html.includes('<table')) {
    return { ...EMPTY_TABLE, prefixHtml: html || '' };
  }

  const tables = collectParts(html, 'table');
  if (!tables.length) return { ...EMPTY_TABLE, prefixHtml: html };

  const first = tables[0];
  const prefixHtml = html.slice(0, first.start).trim();
  const suffixHtml = html.slice(first.end).trim();

  if (/<table[\s>]/i.test(first.inner)) return { ...EMPTY_TABLE, blocked: 'nested', prefixHtml, suffixHtml };
  if (/<img[\s>]/i.test(first.inner)) return { ...EMPTY_TABLE, blocked: 'image', prefixHtml, suffixHtml };
  if (/border\s*:\s*none/i.test(first.open)) return { ...EMPTY_TABLE, blocked: 'layout', prefixHtml, suffixHtml };
  if (!/<th[\s>]/i.test(first.inner)) return { ...EMPTY_TABLE, blocked: 'no-header', prefixHtml, suffixHtml };

  const trParts = collectParts(first.inner, 'tr');
  const rawRows: GridCell[][] = [];
  for (const tr of trParts) {
    const cells = collectParts(tr.inner, 'td|th').map((c) => readCell(c.open, c.inner));
    if (cells.length) rawRows.push(cells);
  }
  if (!rawRows.length) return { ...EMPTY_TABLE, prefixHtml, suffixHtml };

  const hasHeaderRow = rawRows[0].some((c) => c.tag === 'th');
  const grid = buildGrid(rawRows);
  const headers = hasHeaderRow ? (grid[0] as GridCell[]) : null;
  const rows = hasHeaderRow ? grid.slice(1) : grid;

  const headRowAttrs = headers && trParts[0]
    ? trParts[0].open.replace(/^<\s*tr/i, '').replace(/>$/, '').trim()
    : '';

  return {
    hasTable: true,
    blocked: null,
    prefixHtml,
    suffixHtml,
    tableAttrs: first.open.replace(/^<\s*table/i, '').replace(/>$/, '').trim(),
    headRowAttrs,
    headers,
    rows,
  };
}

function cellHtml(c: GridCell | null): string {
  if (!c) return '';
  const span: string[] = [];
  if (c.colSpan > 1) span.push(` colspan="${c.colSpan}"`);
  if (c.rowSpan > 1) span.push(` rowspan="${c.rowSpan}"`);
  const attrs = c.attrs ? ` ${c.attrs}` : '';
  return `<${c.tag}${attrs}${span.join('')}>${c.html}</${c.tag}>`;
}

export function buildHtmlFromTable(state: GridState): string {
  const parts: string[] = [];
  if (state.prefix) parts.push(state.prefix);

  const head = state.headers
    ? `<thead><tr${state.headRowAttrs ? ` ${state.headRowAttrs}` : ''}>${state.headers.map(cellHtml).join('')}</tr></thead>`
    : '';
  const body = state.rows.length
    ? `<tbody>${state.rows.map((r) => `<tr>${r.map(cellHtml).join('')}</tr>`).join('')}</tbody>`
    : '';

  parts.push(`<table${state.tableAttrs ? ` ${state.tableAttrs}` : ''}>${head}${body}</table>`);

  if (state.suffix) parts.push(state.suffix);
  return parts.join('\n');
}

export function toState(p: ParsedTable): GridState {
  return {
    headers: p.headers,
    rows: p.rows,
    prefix: p.prefixHtml,
    suffix: p.suffixHtml,
    tableAttrs: p.tableAttrs,
    headRowAttrs: p.headRowAttrs,
  };
}

export function gridColumnCount(state: GridState): number {
  const widths = state.rows.map((r) => r.length);
  if (state.headers) widths.push(state.headers.length);
  return widths.length ? Math.max(...widths) : 4;
}

/** Ekstrak atribut selain colspan/rowspan menjadi properti gaya untuk render React. */
export function attrsToStyle(attrs: string): Record<string, string> {
  const style: Record<string, string> = {};
  const sm = attrs.match(/style\s*=\s*"([^"]*)"/i) || attrs.match(/style\s*=\s*'([^']*)'/i);
  if (sm) {
    for (const decl of sm[1].split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      const val = decl.slice(i + 1).trim();
      if (prop) style[prop] = val;
    }
  }
  const w = attrs.match(/\bwidth\s*=\s*"([^"]*)"/i);
  if (w && !style.width) style.width = w[1];
  const va = attrs.match(/\bvalign\s*=\s*"([^"]*)"/i);
  if (va && !style.verticalAlign) style.verticalAlign = va[1];
  const al = attrs.match(/\balign\s*=\s*"([^"]*)"/i);
  if (al && !style.textAlign) style.textAlign = al[1];
  return style;
}
