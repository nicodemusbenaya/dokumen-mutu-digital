import path from 'path';
import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { DOCUMENT_SECTIONS, DocumentType, getSectionLabel, getOrderedSections, getDisplaySectionLabel, cleanSectionTitle } from '@/lib/documentTypes';
import { injectSignaturesIntoFormHtml } from '@/lib/pdf-utils';
import { getRevisionHistory, renderRevisionTableHtml } from '@/lib/revisionUtils';

// ─────────────────────────────────────────────────────────────────
//  PDF Generation — Puppeteer (HTML-to-PDF)
//  Menggunakan puppeteer-core + @sparticuz/chromium-min
//  untuk kompatibilitas dengan Windows NAS deployment
// ─────────────────────────────────────────────────────────────────

async function findChromiumPath(): Promise<string> {
  // 1. User-defined CHROMIUM_PATH
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  // 2. Linux paths
  if (process.platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
    ];
    for (const p of linuxPaths) {
      try { await fs.access(p); return p; } catch { }
    }
    throw new Error('Chromium/Chrome tidak ditemukan di Linux. Set env CHROMIUM_PATH.');
  }

  // 3. Windows — auto-detect Chrome & Edge
  const winCandidates = [
    // Google Chrome
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    // Microsoft Edge
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];

  for (const p of winCandidates) {
    try { await fs.access(p); return p; } catch { }
  }

  throw new Error(
    'Chrome/Edge tidak ditemukan di Windows. Install Chrome atau set env CHROMIUM_PATH di .env.local'
  );
}

let cachedBrowser: any = null;
async function getBrowser() {
  if (cachedBrowser && cachedBrowser.connected) return cachedBrowser;

  const puppeteer = await import('puppeteer-core');
  const p = (puppeteer as any).default || puppeteer;
  const launch = p.launch || p.default?.launch;

  const executablePath = await findChromiumPath();
  const isDocker = process.env.DOCKER === 'true' || process.platform === 'linux';

  cachedBrowser = await launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ],
    timeout: 60000,
    protocolTimeout: 60000,
  });
  return cachedBrowser;
}

export interface PdfDocumentData {
  kode: string;
  judul: string;
  jenis: string;
  bidang: string;
  versi: string;
  status: string;
  createdAt?: string;
  updatedAt: string;
  sections: Record<string, string>;
  refs: Array<{ kategori: string; nomor: string; judul: string }>;
  versions?: any[];
  penyusun: string;
  /** Path URL kop surat hasil ekstrak word/header*.xml (opsional). */
  kopPath?: string | null;
  mgrApprover: string | null;
  mgrSignature: string | null; // base64 data URL
  pimpinanApprover: string | null;
  pimpinanSignature: string | null;
}

let cachedLogos: { danantara: string; pln: string; plnVertical: string } | null = null;
async function getLogosBase64(): Promise<{ danantara: string; pln: string; plnVertical: string }> {
  if (cachedLogos) return cachedLogos;
  try {
    const pubDir = path.join(process.cwd(), 'public', 'images');
    const [danantaraBuf, plnBuf, plnVertBuf] = await Promise.all([
      fs.readFile(path.join(pubDir, 'logo-danantara.png')).catch(() => null),
      fs.readFile(path.join(pubDir, 'logo-pln.png')).catch(() => null),
      fs.readFile(path.join(pubDir, 'logo-pln-vertical.png')).catch(() => null),
    ]);
    cachedLogos = {
      danantara: danantaraBuf ? `data:image/png;base64,${danantaraBuf.toString('base64')}` : '',
      pln: plnBuf ? `data:image/png;base64,${plnBuf.toString('base64')}` : '',
      plnVertical: plnVertBuf
        ? `data:image/png;base64,${plnVertBuf.toString('base64')}`
        : (plnBuf ? `data:image/png;base64,${plnBuf.toString('base64')}` : ''),
    };
    return cachedLogos;
  } catch (err) {
    console.error('Error loading logo base64:', err);
    return { danantara: '', pln: '', plnVertical: '' };
  }
}

// ─── Inline aset lokal → data URL ───────────────────────────────
// Puppeteer setContent memakai base URL about:blank, sehingga src relatif
// (/uploads/media/...) tidak akan termuat. Semua gambar lokal di-inline dulu.

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon',
};

const IMG_SRC_RE = /(\ssrc\s*=\s*)("[^"]*"|'[^']*')/gi;
const IMG_SRC_SCAN_RE = /\ssrc\s*=\s*("[^"]*"|'[^']*')/gi;

async function resolveLocalAsset(src: string): Promise<Buffer | null> {
  if (!src || /^(data:|https?:|blob:|javascript:|\/\/)/i.test(src)) return null;
  const clean = src.replace(/^[./]+/, '');
  const rel = clean.replace(/^uploads\//, '');
  const candidates = [
    path.join(process.cwd(), 'storage', rel),              // storage/media/001.png
    path.join(process.cwd(), 'public', clean),             // public/uploads/media/001.png
    path.join(process.cwd(), 'public', 'uploads', rel),    // fallback
  ];
  for (const p of candidates) {
    try {
      const buf = await fs.readFile(p);
      if (buf.length) return buf;
    } catch { /* coba kandidat berikutnya */ }
  }
  return null;
}

async function inlineLocalImages(html: string): Promise<string> {
  if (!html || html.indexOf('<img') < 0) return html;

  const wanted = new Set<string>();
  let m: RegExpExecArray | null;
  IMG_SRC_SCAN_RE.lastIndex = 0;
  while ((m = IMG_SRC_SCAN_RE.exec(html)) !== null) {
    const val = m[1];
    if (val) wanted.add(val.slice(1, -1));
  }

  const repl = new Map<string, string>();
  for (const src of wanted) {
    const buf = await resolveLocalAsset(src);
    if (!buf) continue;
    const ext = path.extname(src.split('?')[0]).replace('.', '').toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    repl.set(src, `data:${mime};base64,${buf.toString('base64')}`);
  }
  if (!repl.size) return html;

  return html.replace(IMG_SRC_RE, (whole, attr: string, val: string) => {
    const sub = repl.get(val.slice(1, -1));
    return sub ? `${attr}${val[0]}${sub}${val[0]}` : whole;
  });
}

// ─── Kop surat asli (dari word/header*.xml) sebagai headerTemplate ──

async function loadKopHeaderTemplate(kopPath?: string | null): Promise<string | null> {
  if (!kopPath) return null;
  const clean = kopPath.replace(/^\/+/, '');
  const candidates = [
    path.join(process.cwd(), 'storage', clean.replace(/^uploads\//, '')),
    path.join(process.cwd(), 'public', clean),
    path.join(process.cwd(), clean),
  ];
  for (const p of candidates) {
    let raw = '';
    try {
      raw = await fs.readFile(p, 'utf8');
    } catch {
      continue; // kandidat berikutnya
    }
    if (!raw || !raw.trim()) continue;
    try {
      return buildKopHeaderTemplate(await inlineLocalImages(raw));
    } catch (err) {
      console.error(`[PDF] Gagal meng-inline gambar kop ${kopPath}:`, err);
      return buildKopHeaderTemplate(raw);
    }
  }
  console.warn(`[PDF] Kop surat tidak ditemukan: ${kopPath}`);
  return null;
}

function buildKopHeaderTemplate(kopHtml: string): string {
  return `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 794px; margin: 0; padding: 0; }
    .kop-wrap { width: 100%; padding: 0 18mm; font-family: Arial, sans-serif; font-size: 7.5pt; line-height: 1.3; }
    .kop-wrap table { width: 100% !important; max-width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
    .kop-wrap td, .kop-wrap th { vertical-align: middle; word-break: break-word; }
    .kop-wrap img { max-height: 40px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }
    .kop-wrap p { margin: 0; }
    .kop-wrap br { display: block; }
  </style>
  <div class="kop-wrap">${kopHtml}</div>`;
}

// ─── Generate HTML untuk PDF ──────────────────────────────────

const FORMULIR_TYPES = new Set([
  'BA Pemusnahan Rekaman',
  'Pernyataan Kerahasiaan',
  'Daftar Rekaman Mutu',
  'Formulir Kerja',
  'Formulir Tambahan'
]);

function getOfficialHeaderTitles(doc: PdfDocumentData): { category: string; title: string } {
  const jenis = (doc.jenis || '').trim();
  const judul = (doc.judul || '').trim().toUpperCase();

  if (jenis === 'SOP/Prosedur' || jenis.toLowerCase().includes('prosedur')) {
    return {
      category: 'FORMULIR DOKUMEN PROSEDUR',
      title: judul
    };
  }
  if (jenis === 'Manual Mutu' || jenis.toLowerCase().includes('manual mutu')) {
    return {
      category: 'FORMULIR DOKUMEN MUTU',
      title: judul
    };
  }
  if (jenis === 'Instruksi Kerja' || jenis.toLowerCase().includes('instruksi')) {
    return {
      category: 'FORMULIR DOKUMEN INTRUKSI KERJA',
      title: judul
    };
  }
  if (jenis.includes('FR.01.05') || jenis.includes('Pemusnahan') || jenis.includes('BA Pemusnahan')) {
    return {
      category: 'FORMULIR BERITA ACARA',
      title: 'PEMUSNAHAN REKAMAN MUTU'
    };
  }
  if (jenis.includes('FR.01.06') || jenis.includes('Kerahasiaan')) {
    return {
      category: 'FORMULIR PERNYATAAN KERAHASIAAN',
      title: judul
    };
  }
  if (jenis.includes('FR.01.07') || jenis.includes('Daftar Rekaman')) {
    return {
      category: 'DAFTAR REKAMAN MUTU',
      title: judul
    };
  }
  return {
    category: 'FORMULIR',
    title: judul
  };
}

function getCoverPageTitle(doc: PdfDocumentData): string {
  const jenis = (doc.jenis || '').trim();
  if (jenis === 'SOP/Prosedur' || jenis.toLowerCase().includes('prosedur')) return 'DOKUMEN PROSEDUR';
  if (jenis === 'Instruksi Kerja' || jenis.toLowerCase().includes('instruksi')) return 'INSTRUKSI KERJA';
  if (jenis === 'Manual Mutu' || jenis.toLowerCase().includes('manual mutu')) return 'MANUAL MUTU';
  return 'FORMULIR';
}

function getCoverPageSubtitle(doc: PdfDocumentData): string {
  const jenis = (doc.jenis || '').trim();
  if (jenis.includes('FR.01.05') || jenis.includes('Pemusnahan') || jenis.includes('BA Pemusnahan')) return 'PEMUSNAHAN REKAMAN MUTU';
  if (jenis.includes('FR.01.06') || jenis.includes('Kerahasiaan')) return 'PERNYATAAN KERAHASIAAN';
  if (jenis.includes('FR.01.07') || jenis.includes('Daftar Rekaman')) return 'DAFTAR REKAMAN MUTU';
  return (doc.judul || '').trim().toUpperCase() || '';
}

// ─── Cover Page ─────────────────────────────────────────────────

function buildCoverPage(doc: PdfDocumentData, logos: { danantara: string; pln: string; plnVertical: string }): string {
  const coverTitle = getCoverPageTitle(doc);
  const coverSubtitle = getCoverPageSubtitle(doc);
  const logoSrc = logos.plnVertical || logos.pln || '';
  const kode = (doc.kode || 'XX.XX.XXX.XXXX.').toUpperCase();
  const rev = String(doc.versi || '00').padStart(2, '0');
  const dateStr = new Date(doc.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `
  <div class="cover-page">
    ${logoSrc ? `<img src="${logoSrc}" class="cover-logo" alt="Logo PLN">` : ''}
    <div class="cover-title">${coverTitle}</div>
    ${coverSubtitle ? `<div class="cover-dots">.................................</div><div class="cover-subtitle">${coverSubtitle}</div>` : `<div class="cover-dots">.................................</div>`}
    <div class="cover-code">${kode}</div>
    <div class="cover-rev">REV. ${rev}</div>
    <div class="cover-date">${dateStr}</div>
    <div class="cover-company">PT PLN (PERSERO)</div>
    <div class="cover-dept">UNIT PELAKSANA SERTIFIKASI</div>
    <div class="cover-dots-bottom">.................................</div>
  </div>`;
}

// ─── Daftar Isi ─────────────────────────────────────────────────

function buildDaftarIsi(
  activeSections: Array<{ key: string; title: string }>,
  hasRefs: boolean
): string {
  const items = activeSections.map((sec) => `
    <div class="toc-item">
      <span class="toc-text">${sec.title}</span>
    </div>`
  ).join('');

  const refItem = hasRefs ? `
    <div class="toc-item">
      <span class="toc-text">REFERENSI & STANDAR TERKAIT</span>
    </div>` : '';

  return `
  <div class="toc-page">
    <div class="toc-title-heading">DAFTAR ISI</div>
    <div class="toc-list">
      ${items}
      ${refItem}
    </div>
  </div>`;
}

// ─── Puppeteer headerTemplate (kop surat 3-kolom, di-stamp di setiap halaman) ──

function buildHeaderTemplate(
  doc: PdfDocumentData,
  logos: { danantara: string; pln: string; plnVertical: string },
): string {
  const headerTitles = getOfficialHeaderTitles(doc);
  const logoSrc = logos.plnVertical || logos.pln || '';
  return `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 794px; margin: 0; padding: 0; }
    .kop-wrap { width: 100%; padding: 0 18mm; }
    .kop { width: 100%; border-collapse: collapse; border: 1px solid #000; opacity: 0.88; font-family: Arial, sans-serif; font-size: 7.5pt; }
    .kop td { border: 1px solid #000; vertical-align: middle; padding: 3px 6px; }
    .kop-logo { width: 11%; text-align: center; padding: 3px 5px; }
    .kop-logo img { height: 38px; max-width: 34px; object-fit: contain; display: block; margin: 0 auto; }
    .kop-title { width: 56%; text-align: center; padding: 4px 8px; }
    .kop-main { font-size: 8pt; font-weight: 800; color: #000; letter-spacing: 0.02em; line-height: 1.25; }
    .kop-sub { font-size: 7pt; font-weight: 700; color: #000; margin-top: 1px; letter-spacing: 0.02em; line-height: 1.25; }
    .kop-meta { width: 33%; font-size: 6.5pt; line-height: 1.45; color: #000; padding: 3px 6px; }
  </style>
  <div class="kop-wrap">
    <table class="kop">
      <tr>
        <td class="kop-logo" rowspan="2">
          ${logoSrc ? `<img src="${logoSrc}" alt="Logo PLN">` : ''}
        </td>
        <td class="kop-title" rowspan="2">
          <div class="kop-main">${headerTitles.category}</div>
          ${headerTitles.title && headerTitles.title !== headerTitles.category ? `<div class="kop-sub">${headerTitles.title}</div>` : ''}
        </td>
        <td class="kop-meta"><strong>Nomor:</strong> ${doc.kode || '—'}</td>
      </tr>
      <tr>
        <td class="kop-meta"><strong>Tanggal:</strong> ${new Date(doc.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
      </tr>
    </table>
  </div>`;
}

// ─── Puppeteer footerTemplate (footer 2-kolom, di-stamp di setiap halaman) ──

function buildFooterTemplate(doc: PdfDocumentData): string {
  const revLabel = String(doc.versi || '00').padStart(2, '0');
  return `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 794px; margin: 0; padding: 0; }
    .ft-wrap { width: 100%; padding: 0 18mm; }
    .ft { width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: Arial, sans-serif; font-size: 5.5pt; opacity: 0.88; }
    .ft td { border: 1px solid #000; padding: 2px 5px; line-height: 1.35; color: #262626; vertical-align: middle; }
    .ft-left { width: 50%; font-size: 5.5pt; text-align: justify; }
    .ft-right-top { width: 50%; font-size: 5.5pt; text-align: right; padding: 2px 5px; border-bottom: 1px solid #000; }
    .ft-right-flex { display: flex; justify-content: space-between; align-items: center; width: 100%; }
    .ft-right-bottom { width: 50%; text-align: left; font-size: 5.5pt; height: 14px; vertical-align: top; padding: 1px 5px; }
    .ft-notice { font-family: Arial, sans-serif; font-size: 5pt; color: #4472c4; margin-top: 2px; font-weight: 500; letter-spacing: 0.01em; }
  </style>
  <div class="ft-wrap">
    <table class="ft">
      <tr>
        <td class="ft-left" rowspan="2">
          Dokumen ini merupakan hak milik dari PT PLN (Persero) UP Sertifikasi. Dilarang memperbanyak dan menyebarkan dalam bentuk apapun baik secara elektronik maupun mekanik serta dilarang menyebarkan dokumen ini kepada pihak lain tanpa izin tertulis dari PT PLN (Persero) UP Sertifikasi.
        </td>
        <td class="ft-right-top">
          <div class="ft-right-flex">
            <span>Rev. ${revLabel}</span>
            <span>Hal. <span class="pageNumber"></span> dari <span class="totalPages"></span></span>
          </div>
        </td>
      </tr>
      <tr>
        <td class="ft-right-bottom">Paraf :</td>
      </tr>
    </table>
    <div class="ft-notice">Uncontrolled when printed or downloaded</div>
  </div>`;
}

// ─── Shared CSS ─────────────────────────────────────────────────

function buildPdfStyles(): string {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #1A1A1A; line-height: 1.55; }
  .page { padding: 0; position: relative; width: 100%; }
  .doc-section { margin-bottom: 14px; page-break-inside: avoid !important; break-inside: avoid !important; }
  .section-title, h1, h2, h3, h4, h5, h6 { font-size: 9.5pt; font-weight: 700; color: #0B192C; margin: 12px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #CBD5E1; text-transform: uppercase; letter-spacing: 0.03em; page-break-after: avoid !important; break-after: avoid !important; }
  .clause-section { display: grid; grid-template-columns: 4.5cm auto 1fr; column-gap: 8px; align-items: start; margin-bottom: 10px; }
  .clause-label { line-height: 1.6; padding-left: 1.5em; text-indent: -1.5em; }
  .clause-colon { line-height: 1.6; }
  .clause-content { min-width: 0; }
  .content { font-size: 9.5pt; line-height: 1.6; margin-bottom: 8px; color: #1A1A1A; }
  .content p { margin-bottom: 6px; text-align: justify; }
  .content ol { counter-reset: item; list-style: none; padding-left: 0; margin-bottom: 6px; text-align: justify; }
  .content ol > li { counter-increment: item; position: relative; padding-left: 2.5em; margin-bottom: 4px; text-align: justify; page-break-inside: avoid !important; break-inside: avoid !important; }
  .content ol > li::before { content: counters(item, ".") ". "; position: absolute; left: 0; top: 0; }
  .content ul { padding-left: 16px; margin-bottom: 6px; text-align: justify; }
  .content li { margin-bottom: 4px; page-break-inside: avoid !important; break-inside: avoid !important; }
  table, .content table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 14px !important; font-size: 9pt !important; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; }
  table th, .content table th { color: #0F172A !important; font-weight: 400; text-align: left; padding: 6px 8px !important; border: 1px solid #000 !important; vertical-align: middle !important; line-height: 1.35 !important; }
  table td, .content table td { padding: 6px 8px !important; border: 1px solid #000 !important; vertical-align: top !important; line-height: 1.45 !important; color: #1A1A1A !important; }
  table[style*="border:none"], table[style*="border: none"] { border: none !important; }
  table[style*="border:none"] td, table[style*="border: none"] td { border: none !important; }
  .pengesahan-title, .riwayat-title { font-size: 9.5pt; font-weight: 800; color: #0B192C; margin: 14px 0 5px; letter-spacing: 0.03em; page-break-after: avoid !important; break-after: avoid !important; }
  .pengesahan-box, .pengesahan-table, .riwayat-table, .refs, .sig-block { page-break-inside: avoid !important; break-inside: avoid !important; }
  .pengesahan-table td { border: 1px solid #334155 !important; padding: 8px 12px !important; }
  .riwayat-table th { border: 1px solid #334155 !important; padding: 5px 7px !important; font-size: 8pt !important; }
  .riwayat-table td { border: 1px solid #475569 !important; padding: 5px 7px !important; font-size: 8pt !important; }
  .refs ul { padding-left: 16px; font-size: 8.5pt; }
  .cover-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 700px; text-align: center; padding: 40px 30px; }
  .cover-logo { width: 120px; height: auto; opacity: 1; margin-bottom: 30px; object-fit: contain; }
  .cover-title { font-size: 18pt; font-weight: 800; color: #0B192C; letter-spacing: 0.04em; margin-bottom: 6px; }
  .cover-dots { font-size: 9pt; color: #94A3B8; margin-bottom: 16px; letter-spacing: 0.1em; }
  .cover-subtitle { font-size: 10pt; font-weight: 700; color: #334155; margin-bottom: 20px; text-transform: uppercase; }
  .cover-code { font-size: 11pt; font-weight: 700; color: #0B192C; letter-spacing: 0.08em; margin-bottom: 4px; }
  .cover-rev { font-size: 10pt; font-weight: 600; color: #334155; margin-bottom: 4px; letter-spacing: 0.06em; }
  .cover-date { font-size: 9pt; color: #64748B; margin-bottom: 30px; }
  .cover-company { font-size: 11pt; font-weight: 800; color: #0B192C; letter-spacing: 0.05em; margin-bottom: 2px; }
  .cover-dept { font-size: 10pt; font-weight: 700; color: #334155; letter-spacing: 0.04em; margin-bottom: 20px; }
  .cover-dots-bottom { font-size: 9pt; color: #94A3B8; letter-spacing: 0.1em; }
  .pengesahan-page { page-break-after: always !important; break-after: always !important; padding: 20px 0; }
  .pengesahan-page-title { font-size: 12pt; font-weight: 800; color: #0B192C; text-align: center; letter-spacing: 0.06em; margin-bottom: 40px; text-transform: uppercase; }
  .pengesahan-date { font-size: 9pt; color: #334155; text-align: center; margin-bottom: 50px; }
  .pengesahan-cols { display: flex; gap: 60px; justify-content: center; padding: 0 60px; }
  .pengesahan-col { flex: 1; text-align: center; max-width: 280px; }
  .pengesahan-col-label { font-size: 9pt; font-weight: 700; color: #0B192C; margin-bottom: 4px; text-align: center; }
  .pengesahan-col-role { font-size: 8pt; color: #64748B; margin-bottom: 20px; text-align: center; }
  .pengesahan-sig-area { height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
  .pengesahan-dotted-line { border-bottom: 1px dashed #94A3B8; margin: 0 10px 6px; }
  .pengesahan-name { font-size: 9pt; font-weight: 700; color: #0B192C; text-align: center; }
  .riwayat-page { page-break-after: always !important; break-after: always !important; padding: 20px 0; }
  .riwayat-page-title { font-size: 11pt; font-weight: 800; color: #0B192C; text-align: center; letter-spacing: 0.06em; margin-bottom: 14px; text-transform: uppercase; }
  .toc-page { page-break-after: always !important; break-after: always !important; padding: 20px 0; }
  .toc-title-heading { font-size: 11pt; font-weight: 800; color: #0B192C; text-align: center; letter-spacing: 0.06em; margin-bottom: 20px; text-transform: uppercase; }
  .toc-list { width: 100%; }
  .toc-item { display: flex; align-items: baseline; gap: 8px; padding: 7px 0; }
  .toc-text { flex: 1; font-size: 9.5pt; color: #1A1A1A; }
</style>`;
}

// ─── Cover Page HTML (tanpa header/footer) ─────────────────────

function buildCoverHtml(doc: PdfDocumentData, logos: { danantara: string; pln: string; plnVertical: string }): string {
  const coverTitle = getCoverPageTitle(doc);
  const coverSubtitle = getCoverPageSubtitle(doc);
  const logoSrc = logos.plnVertical || logos.pln || '';
  const kode = (doc.kode || 'XX.XX.XXX.XXXX.').toUpperCase();
  const rev = String(doc.versi || '00').padStart(2, '0');
  const dateStr = new Date(doc.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<style>${buildPdfStyles()}</style>
</head><body>
<div class="page">
  <div class="cover-page">
    ${logoSrc ? `<img src="${logoSrc}" class="cover-logo" alt="Logo PLN">` : ''}
    <div class="cover-title">${coverTitle}</div>
    <div class="cover-dots">.................................</div>
    ${coverSubtitle ? `<div class="cover-subtitle">${coverSubtitle}</div>` : ''}
    <div class="cover-code">${kode}</div>
    <div class="cover-rev">REV. ${rev}</div>
    <div class="cover-date">${dateStr}</div>
    <div class="cover-company">PT PLN (PERSERO)</div>
    <div class="cover-dept">UNIT PELAKSANA SERTIFIKASI</div>
    <div class="cover-dots-bottom">.................................</div>
  </div>
</div>
</body></html>`;
}

// ─── Content Pages HTML (dengan header/footer via Puppeteer) ───

function buildContentHtml(doc: PdfDocumentData): string {
  const isFormulir = FORMULIR_TYPES.has(doc.jenis) || (doc.jenis && doc.jenis.toLowerCase().includes('formulir'));

  const formattedDate = new Date(doc.updatedAt).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const refsHtml = doc.refs.map(r =>
    `<li>[${r.kategori}] ${r.nomor} — ${r.judul}</li>`
  ).join('');

  const orderedSections = getOrderedSections(doc.jenis, doc.sections);
  const allActive = orderedSections.filter(sec => doc.sections?.[sec.key] && doc.sections[sec.key].trim());

  // Halaman LEMBAR PENGESAHAN / DAFTAR ISI selalu dirender sintesis di atas
  // (punya slot tanda tangan digital + daftar isi dinamis) — section impor yang
  // judulnya sama dibuang agar tidak muncul dua kali.
  const SYNTHESIZED_TITLES = /^(lembar\s+pengesahan|daftar\s+isi)$/i;
  const RIWAYAT_TITLE = /^riwayat\s+perubahan$/i;
  const importedRiwayat = allActive.some(sec => RIWAYAT_TITLE.test(cleanSectionTitle(sec.title)));
  const activeSections = allActive.filter(sec => !SYNTHESIZED_TITLES.test(cleanSectionTitle(sec.title)));

  const sigData = {
    mgrSignature: doc.mgrSignature,
    mgrApprover: doc.mgrApprover,
    pimpinanSignature: doc.pimpinanSignature,
    pimpinanApprover: doc.pimpinanApprover,
    penyusun: doc.penyusun
  };

  const revisionRows = getRevisionHistory(doc, doc.versions || []);
  const revisionTableHtml = renderRevisionTableHtml(revisionRows);

  const SUPPRESS_TITLE_KEYS = new Set([
    'judul_formulir', 'identitas_ba', 'identitas_pihak', 'pernyataan_komitmen', 'konsekuensi_penutup'
  ]);

  const bodyHtml = isFormulir
    ? `<div class="form-body-stream">
        ${activeSections.map((sec, idx) => {
          const content = injectSignaturesIntoFormHtml(doc.sections[sec.key], sigData);
          if (SUPPRESS_TITLE_KEYS.has(sec.key)) {
            return `<div class="content form-block">${content}</div>`;
          }
          const label = getDisplaySectionLabel(sec, idx, doc.jenis);
          return `<div class="doc-section"><h3 class="section-title">${label}</h3><div class="content">${content}</div></div>`;
        }).join('')}
       </div>`
    : `<div class="pdf-body">
        ${activeSections.map((sec, idx) => {
          const content = injectSignaturesIntoFormHtml(doc.sections[sec.key], sigData);
          const label = getDisplaySectionLabel(sec, idx, doc.jenis);
          return `<div class="doc-section clause-section"><div class="clause-label">${label}</div><div class="clause-colon">:</div><div class="clause-content content">${content}</div></div>`;
        }).join('')}
        ${refsHtml ? `<div class="refs"><h3 class="section-title">REFERENSI & STANDAR TERKAIT</h3><ul style="padding-left:16px;font-size:9pt;">${refsHtml}</ul></div>` : ''}
       </div>`;

  const pengesahanLabel = isFormulir ? 'Manager Bidang Terkait' : (doc.jenis === 'Manual Mutu' ? 'Para Manager Bidang' : 'Manager Bidang Terkait');
  const pengesahanHtml = `
    <div class="pengesahan-page">
      <div class="pengesahan-page-title">LEMBAR PENGESAHAN</div>
      <div class="pengesahan-date">Jakarta, ${formattedDate}</div>
      <div class="pengesahan-cols">
        <div class="pengesahan-col">
          <div class="pengesahan-col-label">Disusun Oleh:</div>
          <div class="pengesahan-col-role">${pengesahanLabel}</div>
          <div class="pengesahan-sig-area">${doc.mgrSignature ? `<img src="${doc.mgrSignature}" style="max-height:50px;max-width:140px">` : ''}</div>
          <div class="pengesahan-dotted-line"></div>
          <div class="pengesahan-name">${doc.mgrApprover || '( ..................................... )'}</div>
        </div>
        <div class="pengesahan-col">
          <div class="pengesahan-col-label">Disahkan Oleh:</div>
          <div class="pengesahan-col-role">Senior Manager UPS</div>
          <div class="pengesahan-sig-area">${doc.pimpinanSignature ? `<img src="${doc.pimpinanSignature}" style="max-height:50px;max-width:140px">` : ''}</div>
          <div class="pengesahan-dotted-line"></div>
          <div class="pengesahan-name">${doc.pimpinanApprover || '( ..................................... )'}</div>
        </div>
      </div>
    </div>`;

  // Dokumen impor yang sudah membawa RIWAYAT PERUBAHAN aslinya → pakai miliknya,
  // jangan ditimpa tabel sintesis (hanya berisi 1 baris hasil import).
  const riwayatHtml = importedRiwayat ? '' : `
    <div class="riwayat-page">
      <div class="riwayat-page-title">RIWAYAT PERUBAHAN</div>
      ${revisionTableHtml}
    </div>`;

  const activeSectionLabels = activeSections.map((sec, idx) => ({
    key: sec.key,
    title: getDisplaySectionLabel(sec, idx, doc.jenis),
  }));
  const daftarIsiHtml = buildDaftarIsi(activeSectionLabels, !!refsHtml);

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<style>${buildPdfStyles()}</style>
</head><body>
<div class="page">
  ${pengesahanHtml}
  ${riwayatHtml}
  ${daftarIsiHtml}
  ${bodyHtml}
</div>
</body></html>`;
}

// ─── Main: Generate PDF file ──────────────────────────────────

export async function generatePdf(
  doc: PdfDocumentData
): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'storage', 'pdf');
  const safeKode = (doc.kode || 'DOC').replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeVersi = String(doc.versi || '1.0').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${safeKode}_v${safeVersi}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  await fs.mkdir(uploadDir, { recursive: true });

  const logos = await getLogosBase64();

  // Kop surat asli dari word/header*.xml (jika diimpor) → headerTemplate.
  const kopTemplate = await loadKopHeaderTemplate(doc.kopPath);

  // Inline gambar lokal (attachments hasil import) agar termuat di Puppeteer.
  const coverHtml = await inlineLocalImages(buildCoverHtml(doc, logos));
  const contentHtml = await inlineLocalImages(buildContentHtml(doc));

  const browser = await getBrowser();

  const waitForImages = (pg: Awaited<ReturnType<typeof browser.newPage>>) =>
    pg.waitForFunction(() => {
      const imgs = document.querySelectorAll('img');
      return Array.from(imgs).every(img => img.complete && img.naturalHeight !== 0);
    }, { timeout: 8000 }).catch(() => {});

  // ── Pass 1 & 2 berjalan paralel ──
  const [coverPdfBytes, contentPdfBytes] = await Promise.all([
    (async () => {
      const pg = await browser.newPage();
      try {
        const html = coverHtml;
        await pg.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await waitForImages(pg);
        return await pg.pdf({
          format: 'A4', printBackground: true, displayHeaderFooter: false,
          margin: { top: '16mm', right: '18mm', bottom: '16mm', left: '18mm' },
        });
      } finally { await pg.close(); }
    })(),
    (async () => {
      const pg = await browser.newPage();
      try {
        const html = contentHtml;
        await pg.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await waitForImages(pg);
        return await pg.pdf({
          format: 'A4', printBackground: true, displayHeaderFooter: true,
          // Kop asli lebih tinggi dari kop generik → beri ruang header ekstra.
          margin: { top: kopTemplate ? '40mm' : '30mm', right: '18mm', bottom: '24mm', left: '18mm' },
          headerTemplate: kopTemplate ?? buildHeaderTemplate(doc, logos),
          footerTemplate: buildFooterTemplate(doc),
        });
      } finally { await pg.close(); }
    })(),
  ]);

  // ── Merge ──
  const mergedPdf = await PDFDocument.create();
  const coverDoc = await PDFDocument.load(coverPdfBytes);
  const contentDoc = await PDFDocument.load(contentPdfBytes);
  const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
  for (const pg of coverPages) mergedPdf.addPage(pg);
  const contentPages = await mergedPdf.copyPages(contentDoc, contentDoc.getPageIndices());
  for (const pg of contentPages) mergedPdf.addPage(pg);
  await fs.writeFile(filePath, Buffer.from(await mergedPdf.save()));

  return `/uploads/pdf/${fileName}`;
}
