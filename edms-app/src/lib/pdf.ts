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
      try { await fs.access(p); return p; } catch {}
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
    try { await fs.access(p); return p; } catch {}
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
  kode:           string;
  judul:          string;
  jenis:          string;
  bidang:         string;
  versi:          string;
  status:         string;
  createdAt?:     string;
  updatedAt:      string;
  sections:       Record<string, string>;
  refs:           Array<{ kategori: string; nomor: string; judul: string }>;
  versions?:      any[];
  penyusun:       string;
  mgrApprover:    string | null;
  mgrSignature:   string | null; // base64 data URL
  pimpinanApprover: string | null;
  pimpinanSignature: string | null;
}

let cachedLogos: { danantara: string; pln: string } | null = null;
async function getLogosBase64(): Promise<{ danantara: string; pln: string }> {
  if (cachedLogos) return cachedLogos;
  try {
    const pubDir = path.join(process.cwd(), 'public', 'images');
    const [danantaraBuf, plnBuf] = await Promise.all([
      fs.readFile(path.join(pubDir, 'logo-danantara.png')).catch(() => null),
      fs.readFile(path.join(pubDir, 'logo-pln.png')).catch(() => null),
    ]);
    cachedLogos = {
      danantara: danantaraBuf ? `data:image/png;base64,${danantaraBuf.toString('base64')}` : '',
      pln: plnBuf ? `data:image/png;base64,${plnBuf.toString('base64')}` : '',
    };
    return cachedLogos;
  } catch (err) {
    console.error('Error loading logo base64:', err);
    return { danantara: '', pln: '' };
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

const FORMULIR_OFFICIAL_HEADERS: Record<string, { title: string; formNo: string }> = {
  'Formulir Standar (FR.01.04)': {
    title: 'FORMULIR REKAMAN MUTU STANDAR',
    formNo: 'FR.UPS.SER3.BMK.01.04-00'
  },
  'Berita Acara Pemusnahan (FR.01.05)': {
    title: 'FORMULIR BERITA ACARA<br>PEMUSNAHAN REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.05-00'
  },
  'Pernyataan Kerahasiaan (FR.01.06)': {
    title: 'FORMULIR PERNYATAAN KERAHASIAAN',
    formNo: 'FR.UPS.SER3.BMK.01.06-00'
  },
  'Daftar Rekaman Mutu (FR.01.07)': {
    title: 'DAFTAR REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.07-00'
  },
  'BA Pemusnahan Rekaman': {
    title: 'FORMULIR BERITA ACARA<br>PEMUSNAHAN REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.05-00'
  },
  'Pernyataan Kerahasiaan': {
    title: 'FORMULIR PERNYATAAN KERAHASIAAN',
    formNo: 'FR.UPS.SER3.BMK.01.06-00'
  },
  'Daftar Rekaman Mutu': {
    title: 'DAFTAR REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.07-00'
  },
  'Formulir Kerja': {
    title: 'FORMULIR REKAMAN MUTU STANDAR',
    formNo: 'FR.UPS.SER3.BMK.01.04-00'
  },
  'Formulir Tambahan': {
    title: 'FORMULIR REKAMAN MUTU TAMBAHAN',
    formNo: 'FR.UPS.SER3.BMK.01.XX-00'
  }
};

function buildPdfHtml(doc: PdfDocumentData, logos: { danantara: string; pln: string }): string {
  const isFormulir = FORMULIR_TYPES.has(doc.jenis) || (doc.jenis && doc.jenis.toLowerCase().includes('formulir'));
  const formHeader = FORMULIR_OFFICIAL_HEADERS[doc.jenis] || {
    title: `FORMULIR ${doc.judul.toUpperCase()}`,
    formNo: doc.kode || 'FR.UPS.SER3.BMK.01.04-00'
  };

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

  // Body content: Jika ada judul klausul, selalu render judul seksi resmi
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

  // Bagian Header Kop & Lembar Pengesahan & Riwayat Perubahan
  const headerHtml = isFormulir
    ? `<table class="kop-formulir-table">
        <tr>
          <td class="kop-form-logo">
            <div class="kop-logo-box">
              <div class="kop-logo-row">
                ${logos.danantara ? `<img src="${logos.danantara}" class="kop-logo-danantara" alt="Danantara Indonesia">` : ''}
                <div class="kop-logo-divider"></div>
                ${logos.pln ? `<img src="${logos.pln}" class="kop-logo-pln" alt="PLN">` : ''}
              </div>
              <div class="kop-logo-text">
                <div class="kop-text-pln">PT PLN (PERSERO)</div>
                <div class="kop-text-ups">UNIT PELAKSANA SERTIFIKASI</div>
              </div>
              <div class="uncontrolled-notice" style="margin-top:4px; text-align:center;">Uncontrolled when printed or downloaded</div>
            </div>
          </td>
          <td class="kop-form-title">
            ${formHeader.title}
          </td>
          <td class="kop-form-meta">
            <div><strong>Nomor:</strong> ${formHeader.formNo}</div>
            <div><strong>Tanggal:</strong> ${formattedDate}</div>
            <div><strong>Halaman:</strong> 1 dari 1</div>
            <div><strong>Status:</strong> <span class="kop-meta-status ${doc.status === 'Aktif' ? 'status-controlled' : 'status-draft'}">${doc.status === 'Aktif' ? 'Controlled' : doc.status}</span></div>
          </td>
        </tr>
      </table>
      
      <!-- Lembar Pengesahan Resmi Formulir -->
      <div class="pengesahan-box" style="margin: 10px 0 12px;">
        <div class="pengesahan-title">LEMBAR PENGESAHAN</div>
        <div style="font-size:8.5pt; color:#64748B; margin-bottom:6px;">Jakarta, ${formattedDate}</div>
        <table class="pengesahan-table">
          <tr>
            <td style="width:50%; text-align:center;">
              <div style="font-weight:700; font-size:9pt;">Disusun Oleh:</div>
              <div style="font-size:8pt; color:#64748B; margin-top:2px;">Manager Bidang Terkait</div>
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
      ${revisionTableHtml}`
    : `<div class="kop">
        <div class="kop-brand-area">
          <div class="kop-logos">
            ${logos.danantara ? `<img src="${logos.danantara}" class="kop-logo-danantara" alt="Danantara Indonesia">` : ''}
            <div class="kop-divider"></div>
            ${logos.pln ? `<img src="${logos.pln}" class="kop-logo-pln" alt="PLN">` : ''}
          </div>
          <div class="uncontrolled-notice">Uncontrolled when printed or downloaded</div>
        </div>
        <div class="kop-text">
          <h3>PT PLN (PERSERO) UNIT PELAKSANA SERTIFIKASI</h3>
          <p>SISTEM MANAJEMEN TERINTEGRASI — DOKUMEN MUTU TERKENDALI</p>
        </div>
      </div>
      <table class="meta-table">
        <tr><td>Kode Dokumen</td><td>${doc.kode}</td><td>Versi</td><td>v${doc.versi}</td></tr>
        <tr><td>Jenis</td><td>${doc.jenis}</td><td>Status</td><td>${doc.status}</td></tr>
        <tr><td>Bidang</td><td>${doc.bidang}</td><td>Berlaku Sejak</td><td>${formattedDate}</td></tr>
      </table>
      <div class="doc-title">${doc.judul.toUpperCase()}</div>

      <!-- Lembar Pengesahan Resmi SOP / IK / Manual Mutu -->
      <div class="pengesahan-box">
        <div class="pengesahan-title">LEMBAR PENGESAHAN</div>
        <div style="font-size:8.5pt; color:#64748B; margin-bottom:6px;">Jakarta, ${formattedDate}</div>
        <table class="pengesahan-table">
          <tr>
            <td style="width:50%; text-align:center;">
              <div style="font-weight:700; font-size:9pt;">Disusun Oleh:</div>
              <div style="font-size:8pt; color:#64748B; margin-top:2px;">${doc.jenis === 'Manual Mutu' ? 'Para Manager Bidang' : 'Manager Bidang Terkait'}</div>
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
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&family=Noto+Sans:wght@400;600;700&display=swap');
  @page {
    size: A4 portrait;
    margin: 18mm 20mm 20mm 20mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 10pt; color: #1A1A1A; line-height: 1.6; }
  .page { padding: 0; position: relative; width: 100%; }
  
  /* Subtle Notice Watermark Baku ISO */
  .uncontrolled-notice {
    font-size: 7pt;
    font-family: Arial, 'Noto Sans', sans-serif;
    color: #1d4ed8;
    letter-spacing: 0.01em;
    line-height: 1.25;
    margin-top: 3.5px;
    font-weight: 500;
  }

  /* Kop Surat Reguler */
  .kop { display: flex; align-items: center; justify-content: flex-start; gap: 14px; border-bottom: 2.5px double #0B192C; padding-bottom: 12px; margin-bottom: 16px; }
  .kop-brand-area { display: flex; flex-direction: column; align-items: flex-start; }
  .kop-logos { display: flex; align-items: center; gap: 10px; }
  .kop-divider { width: 1.5px; height: 26px; background: #94A3B8; }
  .kop-text h3 { font-size: 11pt; font-weight: 800; color: #0B192C; margin: 0; letter-spacing: .02em; line-height: 1.25; }
  .kop-text p { font-size: 8pt; color: #64748B; margin-top: 3px; font-weight: 600; letter-spacing: .01em; }
  
  /* Kop Formulir Kotak 3-Kolom Khas PLN UP Sertifikasi */
  .kop-formulir-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; border: 1.5px solid #000; }
  .kop-formulir-table td { border: 1px solid #000; padding: 7px 10px; vertical-align: middle; }
  
  .kop-form-logo { width: 30%; }
  .kop-logo-box { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .kop-logo-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 5px; }
  .kop-logo-danantara { height: 20px; width: auto; max-width: 90px; object-fit: contain; }
  .kop-logo-divider { width: 1.5px; height: 22px; background: #94A3B8; }
  .kop-logo-pln { height: 26px; width: auto; object-fit: contain; }
  .kop-logo-text { text-align: center; line-height: 1.25; }
  .kop-text-pln { font-size: 7.5pt; font-weight: 800; color: #0F172A; letter-spacing: 0.4px; }
  .kop-text-ups { font-size: 6.5pt; font-weight: 700; color: #1E3A8A; letter-spacing: 0.2px; margin-top: 1px; }

  .kop-form-title { width: 42%; text-align: center; font-size: 10pt; font-weight: 800; color: #000; letter-spacing: 0.02em; line-height: 1.35; }
  
  .kop-form-meta { width: 28%; font-size: 8pt; line-height: 1.55; color: #000; }
  .kop-meta-status { display: inline-block; padding: 1.5px 6px; border-radius: 4px; font-weight: 700; font-size: 7pt; letter-spacing: 0.03em; }
  .kop-meta-status.status-controlled { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
  .kop-meta-status.status-draft { background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D; }

  /* Metadata Table */
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 8.5pt; }
  .meta-table td { padding: 5px 8px; border: 1px solid #CBD5E1; }
  .meta-table td:nth-child(odd) { font-weight: 700; background: #F8FAFC; width: 28%; color: #475569; }
  
  .doc-title { font-family: 'Noto Serif', Georgia, serif; font-size: 14pt; font-weight: 700; text-align: center; margin: 16px 0; color: #0B192C; letter-spacing: .02em; }
  
  /* Section & Clause Styling: Anti-terpotong di tengah halaman (Pindah ke halaman baru jika tidak muat) */
  .doc-section {
    margin-bottom: 16px;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .section-title, h1, h2, h3, h4, h5, h6 {
    font-size: 9.5pt;
    font-weight: 700;
    color: #0B192C;
    margin: 14px 0 6px;
    padding-bottom: 3px;
    border-bottom: 1.5px solid #CBD5E1;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  
  /* Content formatting */
  .content { font-size: 9.5pt; line-height: 1.65; margin-bottom: 8px; color: #1A1A1A; }
  .content p { margin-bottom: 6px; text-align: justify; }
  .content ol, .content ul { padding-left: 20px; margin-bottom: 6px; text-align: justify; }
  .content li { margin-bottom: 4px; page-break-inside: avoid !important; break-inside: avoid !important; }
  
  /* Table styling resmi: lapang, rapi, berpadding proporsional */
  table, .content table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 14px !important; font-size: 9pt !important; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; }
  table th, .content table th { background-color: #F1F5F9 !important; color: #0F172A !important; font-weight: 700 !important; text-align: center !important; padding: 7px 10px !important; border: 1px solid #000 !important; vertical-align: middle !important; line-height: 1.35 !important; }
  table td, .content table td { padding: 7px 10px !important; border: 1px solid #000 !important; vertical-align: top !important; line-height: 1.5 !important; color: #1A1A1A !important; }
  
  /* Helper borderless table untuk form isian data / tanda tangan */
  table[style*="border:none"], table[style*="border: none"] { border: none !important; }
  table[style*="border:none"] td, table[style*="border: none"] td { border: none !important; }
  
  /* Lembar Pengesahan & Riwayat & Referensi */
  .pengesahan-title, .riwayat-title { font-size: 10pt; font-weight: 800; color: #0B192C; margin: 16px 0 6px; letter-spacing: 0.03em; page-break-after: avoid !important; break-after: avoid !important; }
  .pengesahan-box, .pengesahan-table, .riwayat-table, .refs, .sig-block {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .pengesahan-table td { border: 1px solid #334155 !important; padding: 10px 14px !important; }
  .riwayat-table th { background-color: #F1F5F9 !important; border: 1px solid #334155 !important; padding: 6px 8px !important; font-size: 8.5pt !important; }
  .riwayat-table td { border: 1px solid #475569 !important; padding: 6px 8px !important; font-size: 8.5pt !important; }

  .refs ul { padding-left: 16px; font-size: 9pt; }
  .sig-block { display: flex; gap: 16px; margin-top: 32px; border-top: 1.5px solid #0B192C; padding-top: 14px; }
  .sig-col { flex: 1; text-align: center; }
  .sig-label { font-size: 8.5pt; color: #64748B; margin-bottom: 6px; font-weight: 700; }
  .sig-draw { height: 48px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px; }
  .sig-empty { color: #CBD5E1; font-size: 18pt; }
  .name-line { border-top: 1px solid #CBD5E1; padding-top: 5px; margin-top: 4px; }
  .sig-name { font-weight: 700; font-size: 9pt; color: #0B192C; }
  .sig-title { font-size: 8pt; color: #64748B; }
  .qr-block { flex: 0.6; }
  .qr-img { width: 44px; height: 44px; background: repeating-conic-gradient(#DDD 0% 25%, #fff 0% 50%) 0 0 / 6px 6px; margin: 4px auto; border: 1px solid #CBD5E1; }
  .qr-note { font-size: 7pt; color: #94A3B8; text-align: center; }
</style>
</head>
<body>
<div class="page">
  ${headerHtml}
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

  const logos   = await getLogosBase64();
  const html    = buildPdfHtml(doc, logos);
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path:   filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });
  } finally {
    await browser.close();
  }

  // Return URL path (relative to /public)
  return `/uploads/pdf/${fileName}`;
}
