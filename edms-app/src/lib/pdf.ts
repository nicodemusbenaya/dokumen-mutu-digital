import path from 'path';
import fs from 'fs/promises';
import { DOCUMENT_SECTIONS, DocumentType, getSectionLabel, getOrderedSections, getDisplaySectionLabel } from '@/lib/documentTypes';
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

async function getBrowser() {
  const puppeteer = await import('puppeteer-core');
  const p = (puppeteer as any).default || puppeteer;
  const launch = p.launch || p.default?.launch;

  const executablePath = await findChromiumPath();
  const isDocker = process.env.DOCKER === 'true' || process.platform === 'linux';

  return launch({
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

// ─── Generate HTML untuk PDF ──────────────────────────────────

const FORMULIR_TYPES = new Set([
  'Formulir Standar (FR.01.04)',
  'Berita Acara Pemusnahan (FR.01.05)',
  'Pernyataan Kerahasiaan (FR.01.06)',
  'Daftar Rekaman Mutu (FR.01.07)',
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

function buildPdfHtml(doc: PdfDocumentData, logos: { danantara: string; pln: string; plnVertical: string }): string {
  const isFormulir = FORMULIR_TYPES.has(doc.jenis) || (doc.jenis && doc.jenis.toLowerCase().includes('formulir'));

  const formattedDate = new Date(doc.updatedAt).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const refsHtml = doc.refs.map(r =>
    `<li>[${r.kategori}] ${r.nomor} — ${r.judul}</li>`
  ).join('');

  const sigBlock = (label: string, name: string | null, sigSrc: string | null, title: string) => `
    <div class="sig-col">
      <div class="sig-label">${label}</div>
      <div class="sig-draw">
        ${sigSrc ? `<img src="${sigSrc}" style="max-height:50px;max-width:140px">` : '<span class="sig-empty">—</span>'}
      </div>
      <div class="name-line">
        <div class="sig-name">${name || '—'}</div>
        <div class="sig-title">${title}</div>
      </div>
    </div>`;

  const orderedSections = getOrderedSections(doc.jenis, doc.sections);
  const activeSections = orderedSections.filter(sec => doc.sections?.[sec.key] && doc.sections[sec.key].trim());

  const sigData = {
    mgrSignature: doc.mgrSignature,
    mgrApprover: doc.mgrApprover,
    pimpinanSignature: doc.pimpinanSignature,
    pimpinanApprover: doc.pimpinanApprover,
    penyusun: doc.penyusun
  };

  // Generate riwayat perubahan otomatis / tersinkronisasi
  const revisionRows = getRevisionHistory(doc, doc.versions || []);
  const revisionTableHtml = renderRevisionTableHtml(revisionRows);

  // Keys seksi yang sengaja tidak menampilkan heading h3 (format surat pernyataan / berita acara)
  const SUPPRESS_TITLE_KEYS = new Set([
    'judul_formulir',
    'identitas_ba',
    'identitas_pihak',
    'pernyataan_komitmen',
    'konsekuensi_penutup'
  ]);

  // Body content
  const bodyHtml = isFormulir
    ? `<div class="form-body-stream">
        ${activeSections
      .map((sec, idx) => {
        const content = injectSignaturesIntoFormHtml(doc.sections[sec.key], sigData);
        if (SUPPRESS_TITLE_KEYS.has(sec.key)) {
          return `<div class="content form-block">${content}</div>`;
        }
        const label = getDisplaySectionLabel(sec, idx, doc.jenis);
        return `
              <div class="doc-section">
                <h3 class="section-title">${label}</h3>
                <div class="content">${content}</div>
              </div>
            `;
      })
      .join('')}
       </div>`
    : `<div class="pdf-body">
        ${activeSections
      .map((sec, idx) => {
        const content = injectSignaturesIntoFormHtml(doc.sections[sec.key], sigData);
        const label = getDisplaySectionLabel(sec, idx, doc.jenis);
        return `
              <div class="doc-section">
                <h3 class="section-title">${label}</h3>
                <div class="content">${content}</div>
              </div>
            `;
      }).join('')}
        ${refsHtml ? `<div class="refs"><h3 class="section-title">REFERENSI & STANDAR TERKAIT</h3><ul style="padding-left:16px;font-size:9pt;">${refsHtml}</ul></div>` : ''}
       </div>`;

  // Lembar Pengesahan + Riwayat Perubahan (one-time content, bukan per-page header)
  const pengesahanHtml = `
    <div class="pengesahan-box" style="margin: 10px 0 12px;">
      <div class="pengesahan-title">LEMBAR PENGESAHAN</div>
      <div style="font-size:8.5pt; color:#64748B; margin-bottom:6px;">Jakarta, ${formattedDate}</div>
      <table class="pengesahan-table">
        <tr>
          <td style="width:50%; text-align:center;">
            <div style="font-weight:700; font-size:9pt;">Disusun Oleh:</div>
            <div style="font-size:8pt; color:#64748B; margin-top:2px;">${isFormulir ? 'Manager Bidang Terkait' : (doc.jenis === 'Manual Mutu' ? 'Para Manager Bidang' : 'Manager Bidang Terkait')}</div>
            <div class="sig-draw">
              ${doc.mgrSignature ? `<img src="${doc.mgrSignature}" style="max-height:45px;max-width:130px">` : '<span class="sig-empty">—</span>'}
            </div>
            <div style="margin-top:4px; font-weight:700; font-size:9pt;">${doc.mgrApprover || '( ..................................... )'}</div>
          </td>
          <td style="width:50%; text-align:center;">
            <div style="font-weight:700; font-size:9pt;">Disahkan Oleh:</div>
            <div style="font-size:8pt; color:#64748B; margin-top:2px;">Senior Manager UPS</div>
            <div class="sig-draw">
              ${doc.pimpinanSignature ? `<img src="${doc.pimpinanSignature}" style="max-height:45px;max-width:130px">` : '<span class="sig-empty">—</span>'}
            </div>
            <div style="margin-top:4px; font-weight:700; font-size:9pt;">${doc.pimpinanApprover || '( ..................................... )'}</div>
          </td>
        </tr>
      </table>
    </div>
    ${revisionTableHtml}`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4 portrait;
    margin: 16mm 18mm 18mm 18mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #1A1A1A; line-height: 1.55; opacity: 1; }
  .page { padding: 0; position: relative; width: 100%; opacity: 1; }
  
  /* Kop Formulir — sekarang di headerTemplate, tidak perlu di body */
  
  /* Section & Clause Styling: Anti-terpotong di tengah halaman */
  .doc-section {
    margin-bottom: 14px;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .section-title, h1, h2, h3, h4, h5, h6 {
    font-size: 9.5pt;
    font-weight: 700;
    color: #0B192C;
    margin: 12px 0 6px;
    padding-bottom: 3px;
    border-bottom: 1.5px solid #CBD5E1;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  
  /* Content formatting */
  .content { font-size: 9.5pt; line-height: 1.6; margin-bottom: 8px; color: #1A1A1A; }
  .content p { margin-bottom: 6px; text-align: justify; }
  .content ol, .content ul { padding-left: 20px; margin-bottom: 6px; text-align: justify; }
  .content li { margin-bottom: 4px; page-break-inside: avoid !important; break-inside: avoid !important; }
  
  /* Table styling resmi: lapang, rapi, berpadding proporsional */
  table, .content table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 14px !important; font-size: 9pt !important; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; }
  table th, .content table th { background-color: #F1F5F9 !important; color: #0F172A !important; font-weight: 700 !important; text-align: center !important; padding: 6px 8px !important; border: 1px solid #000 !important; vertical-align: middle !important; line-height: 1.35 !important; }
  table td, .content table td { padding: 6px 8px !important; border: 1px solid #000 !important; vertical-align: top !important; line-height: 1.45 !important; color: #1A1A1A !important; }
  
  /* Helper borderless table untuk form isian data / tanda tangan */
  table[style*="border:none"], table[style*="border: none"] { border: none !important; }
  table[style*="border:none"] td, table[style*="border: none"] td { border: none !important; }
  
  /* Lembar Pengesahan & Riwayat & Referensi */
  .pengesahan-title, .riwayat-title { font-size: 9.5pt; font-weight: 800; color: #0B192C; margin: 14px 0 5px; letter-spacing: 0.03em; page-break-after: avoid !important; break-after: avoid !important; }
  .pengesahan-box, .pengesahan-table, .riwayat-table, .refs, .sig-block {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .pengesahan-table td { border: 1px solid #334155 !important; padding: 8px 12px !important; }
  .riwayat-table th { background-color: #F1F5F9 !important; border: 1px solid #334155 !important; padding: 5px 7px !important; font-size: 8pt !important; }
  .riwayat-table td { border: 1px solid #475569 !important; padding: 5px 7px !important; font-size: 8pt !important; }

  .refs ul { padding-left: 16px; font-size: 8.5pt; }
  .sig-block { display: flex; gap: 16px; margin-top: 24px; border-top: 1.5px solid #0B192C; padding-top: 12px; }
  .sig-col { flex: 1; text-align: center; }
  .sig-label { font-size: 8pt; color: #64748B; margin-bottom: 5px; font-weight: 700; }
  .sig-draw { height: 44px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px; }
  .sig-empty { color: #CBD5E1; font-size: 16pt; }
  .name-line { border-top: 1px solid #CBD5E1; padding-top: 4px; margin-top: 4px; }
  .sig-name { font-weight: 700; font-size: 8.5pt; color: #0B192C; }
  .sig-title { font-size: 7.5pt; color: #64748B; }
  .qr-block { flex: 0.6; }
  .qr-img { width: 40px; height: 40px; background: repeating-conic-gradient(#DDD 0% 25%, #fff 0% 50%) 0 0 / 5px 5px; margin: 4px auto; border: 1px solid #CBD5E1; }
  .qr-note { font-size: 6.5pt; color: #94A3B8; text-align: center; }
</style>
</head>
<body>
<div class="page">
  ${pengesahanHtml}
  ${bodyHtml}
  ${isFormulir && refsHtml ? `<div class="refs"><h3 class="section-title">REFERENSI DOKUMEN</h3><ul>${refsHtml}</ul></div>` : ''}
  ${!isFormulir ? `
  <div class="sig-block">
    ${sigBlock('Disiapkan oleh', doc.penyusun, null, 'Penyusun Dokumen')}
    ${sigBlock('Menyetujui', doc.mgrApprover, doc.mgrSignature, 'Manager Bidang')}
    ${sigBlock('Mengesahkan', doc.pimpinanApprover, doc.pimpinanSignature, 'Pimpinan Unit')}
    <div class="sig-col qr-block">
      <div class="sig-label">Verifikasi Keabsahan</div>
      <div class="qr-img"></div>
      <div class="qr-note">${doc.kode} · v${doc.versi}</div>
    </div>
  </div>` : ''}
</div>
</body>
</html>`;
}

// ─── Main: Generate PDF file ──────────────────────────────────

export async function generatePdf(
  doc: PdfDocumentData,
  documentId: number
): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pdf');
  // Bersihkan karakter ilegal filesystem (terutama Windows: <>:"/\|?*)
  const safeKode = (doc.kode || 'DOC').replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeVersi = String(doc.versi || '1.0').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${safeKode}_v${safeVersi}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  const logos = await getLogosBase64();
  const html = buildPdfHtml(doc, logos);
  const headerTemplate = buildHeaderTemplate(doc, logos);
  const footerTemplate = buildFooterTemplate(doc);
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '30mm', right: '18mm', bottom: '24mm', left: '18mm' },
      headerTemplate,
      footerTemplate,
    });
  } finally {
    await browser.close();
  }

  // Return URL path (relative to /public)
  return `/uploads/pdf/${fileName}`;
}
