import path from 'path';
import fs from 'fs/promises';
import { DOCUMENT_SECTIONS, DocumentType, getSectionLabel } from '@/lib/documentTypes';

// ─────────────────────────────────────────────────────────────────
//  PDF Generation — Puppeteer (HTML-to-PDF)
//  Menggunakan puppeteer-core + @sparticuz/chromium-min
//  untuk kompatibilitas dengan Windows NAS deployment
// ─────────────────────────────────────────────────────────────────

async function getBrowser() {
  if (process.env.NODE_ENV === 'production') {
    const chromium = await import('@sparticuz/chromium-min');
    const puppeteer = await import('puppeteer-core');
    const p = (puppeteer as any).default || puppeteer;
    const c = (chromium as any).default || chromium;
    const launch = p.launch || p.default?.launch;
    return launch({
      args:            c.args || ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: c.defaultViewport || { width: 1200, height: 800 },
      executablePath:  await c.executablePath(),
      headless:        true,
    });
  } else {
    try {
      const puppeteer = await import('puppeteer');
      const p = (puppeteer as any).default || puppeteer;
      const launch = p.launch || p.default?.launch;
      return launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch {
      const puppeteer = await import('puppeteer-core');
      const p = (puppeteer as any).default || puppeteer;
      const launch = p.launch || p.default?.launch;
      return launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath:
          process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : '/usr/bin/google-chrome',
      });
    }
  }
}

export interface PdfDocumentData {
  kode:           string;
  judul:          string;
  jenis:          string;
  bidang:         string;
  versi:          string;
  status:         string;
  updatedAt:      string;
  sections:       Record<string, string>;
  refs:           Array<{ kategori: string; nomor: string; judul: string }>;
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
  'BA Pemusnahan Rekaman',
  'Pernyataan Kerahasiaan',
  'Daftar Rekaman Mutu',
  'Formulir Kerja',
  'Formulir Tambahan'
]);

const FORMULIR_OFFICIAL_HEADERS: Record<string, { title: string; formNo: string }> = {
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
    formNo: 'FR.UPS.SER3.BSB.01.07-00'
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

// Injeksi otomatis tanda tangan dan nama approver ke dalam blok tanda tangan di formulir/dokumen
export function injectSignaturesIntoFormHtml(
  html: string,
  data: {
    mgrSignature?: string | null;
    mgrApprover?: string | null;
    pimpinanSignature?: string | null;
    pimpinanApprover?: string | null;
    penyusun?: string | null;
  }
): string {
  if (!html) return html;
  let res = html;

  // 1. Injeksi Tanda Tangan Digital Manager
  if (data.mgrSignature) {
    const sigImgTag = `<div style="height:55px; display:flex; align-items:center; justify-content:center; margin:4px auto;"><img src="${data.mgrSignature}" style="max-height:50px; max-width:140px; display:block; margin:0 auto; object-fit:contain;" alt="Tanda Tangan Digital Manager" /></div>`;

    // Pola A: Template baku memiliki placeholder <div style="height:60px;"></div>
    if (res.includes('<div style="height:60px;"></div>')) {
      res = res.replace('<div style="height:60px;"></div>', sigImgTag);
    } 
    // Pola B: Editor TipTap menghapus div dan menyisakan paragraf Manager langsung bersisian dengan nama (dalam <p> tags)
    else if (!res.includes('alt="Tanda Tangan Digital Manager"') && !res.includes('<table') ) {
      res = res.replace(
        /(<p[^>]*>(?:[\s\S](?!<\/p>))*Manager(?:[\s\S](?!<\/p>))*<\/p>)(\s*)(<p[^>]*>\s*<strong[^>]*>\s*\((?:[\s\S])*?\)\s*<\/strong>\s*<\/p>|<p[^>]*>\s*\((?:[\s\S])*?\)\s*<\/p>)/i,
        `$1${sigImgTag}$3`
      );
    }
    // Pola C: TipTap mereformat menjadi table; signature block ada di dalam <td>
    // Inject sebelum <p><strong>( name )</strong></p> yang ada dalam td yang sama dengan "Manager"
    else if (!res.includes('alt="Tanda Tangan Digital Manager"')) {
      res = res.replace(
        /(<strong>Manager[\s\S]*?<\/strong><\/p>)(\s*)(<p>\s*<strong>\s*\()/i,
        `$1${sigImgTag}$3`
      );
    }

    // Ganti titik-titik placeholder nama dengan nama approver resmi
    if (data.mgrApprover) {
      res = res.replace(/\(\s*\.{3,}\s*\)/g, `(${data.mgrApprover})`);
    }
  }

  // 2. Injeksi Tanda Tangan Digital Pimpinan / Senior Manager (jika ada pada teks)
  if (data.pimpinanSignature) {
    const pimpinanSigImg = `<div style="height:55px; display:flex; align-items:center; justify-content:center; margin:4px auto;"><img src="${data.pimpinanSignature}" style="max-height:50px; max-width:140px; display:block; margin:0 auto; object-fit:contain;" alt="Tanda Tangan Digital Pimpinan" /></div>`;
    if (!res.includes('alt="Tanda Tangan Digital Pimpinan"')) {
      res = res.replace(
        /(<p[^>]*>(?:[\s\S](?!<\/p>))*(?:Senior Manager|Pimpinan|General Manager)(?:[\s\S](?!<\/p>))*<\/p>)(\s*)(<p[^>]*>\s*<strong[^>]*>\s*\((?:[\s\S])*?\)\s*<\/strong>\s*<\/p>|<p[^>]*>\s*\((?:[\s\S])*?\)\s*<\/p>)/i,
        `$1${pimpinanSigImg}$3`
      );
    }
    if (data.pimpinanApprover) {
      res = res.replace(/\(\s*\.{3,}\s*\)/g, `(${data.pimpinanApprover})`);
    }
  }

  return res;
}

function buildPdfHtml(doc: PdfDocumentData, logos: { danantara: string; pln: string }): string {
  const isFormulir = FORMULIR_TYPES.has(doc.jenis);
  const formHeader = FORMULIR_OFFICIAL_HEADERS[doc.jenis] || {
    title: `FORMULIR ${doc.judul.toUpperCase()}`,
    formNo: doc.kode
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

  const typeSections = (DOCUMENT_SECTIONS[doc.jenis as DocumentType] || []).map(s => s.key);
  const docSectionKeys = Object.keys(doc.sections || {});
  const allKeys = Array.from(new Set([...typeSections, ...docSectionKeys]));

  const sigData = {
    mgrSignature: doc.mgrSignature,
    mgrApprover: doc.mgrApprover,
    pimpinanSignature: doc.pimpinanSignature,
    pimpinanApprover: doc.pimpinanApprover,
    penyusun: doc.penyusun
  };

  // Body content: Jika Formulir, render tanpa h3 agar mengalir persis instrumen hukum aslinya
  const bodyHtml = isFormulir
    ? `<div class="form-body-stream">
        ${allKeys
          .filter(key => doc.sections?.[key])
          .map(key => {
            const content = injectSignaturesIntoFormHtml(doc.sections[key], sigData);
            return `<div class="content form-block">${content}</div>`;
          })
          .join('')}
       </div>`
    : allKeys
        .filter(key => doc.sections?.[key])
        .map(key => {
          const content = injectSignaturesIntoFormHtml(doc.sections[key], sigData);
          return `
            <h3>${getSectionLabel(key, doc.jenis)}</h3>
            <div class="content">${content}</div>
          `;
        }).join('');

  // Bagian Header Kop
  const headerHtml = isFormulir
    ? `<table class="kop-formulir-table">
        <tr>
          <td class="kop-form-logo">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              ${logos.danantara ? `<img src="${logos.danantara}" style="height:26px;width:auto;" alt="Danantara">` : ''}
              ${logos.pln ? `<img src="${logos.pln}" style="height:32px;width:auto;" alt="PLN">` : ''}
            </div>
            <div style="font-size:8pt; font-weight:800; color:#0B192C; line-height:1.25;">
              PT PLN (PERSERO)<br>UNIT PELAKSANA SERTIFIKASI
            </div>
          </td>
          <td class="kop-form-title">
            ${formHeader.title}
          </td>
          <td class="kop-form-meta">
            <div><strong>Nomor:</strong> ${formHeader.formNo}</div>
            <div><strong>Tanggal:</strong> ${formattedDate}</div>
            <div><strong>Halaman:</strong> 1 dari 1</div>
            <div><strong>Status:</strong> ${doc.status === 'Aktif' ? 'Controlled' : doc.status}</div>
          </td>
        </tr>
      </table>`
    : `<div class="kop">
        <div class="kop-logos">
          ${logos.danantara ? `<img src="${logos.danantara}" style="height:30px;width:auto;" alt="Danantara">` : ''}
          <div class="kop-divider"></div>
          ${logos.pln ? `<img src="${logos.pln}" style="height:36px;width:auto;" alt="PLN">` : ''}
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

      <!-- Riwayat Perubahan Resmi -->
      <div class="riwayat-box">
        <div class="riwayat-title">RIWAYAT PERUBAHAN</div>
        <table class="riwayat-table">
          <thead>
            <tr>
              <th style="width:6%;">No</th>
              <th style="width:14%;">Tanggal</th>
              <th style="width:12%;">Halaman</th>
              <th style="width:30%;">Uraian yang Diubah</th>
              <th style="width:28%;">Uraian Perubahan</th>
              <th style="width:10%;">Revisi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center;">1</td>
              <td style="text-align:center;">${formattedDate}</td>
              <td style="text-align:center;">Semua</td>
              <td>Penerbitan Dokumen Mutu Baru</td>
              <td>Penerbitan Dokumen Mutu Terkendali Resmi di Sistem EDMS</td>
              <td style="text-align:center;">v${doc.versi}</td>
            </tr>
          </tbody>
        </table>
      </div>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&family=Noto+Sans:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 10pt; color: #1A1A1A; line-height: 1.6; }
  .page { padding: 25mm 22mm 22mm; position: relative; }
  .controlled { position: absolute; top: 10mm; right: 12mm; font-size: 8pt; font-weight: 700; letter-spacing: .05em; color: #16A34A; border: 1.5px solid #16A34A; border-radius: 10px; padding: 3px 9px; }
  
  /* Kop Surat Reguler */
  .kop { display: flex; align-items: center; justify-content: flex-start; gap: 14px; border-bottom: 2.5px double #0B192C; padding-bottom: 12px; margin-bottom: 16px; }
  .kop-logos { display: flex; align-items: center; gap: 10px; }
  .kop-divider { width: 1.5px; height: 32px; background: #CBD5E1; }
  .kop-text h3 { font-size: 11pt; font-weight: 800; color: #0B192C; margin: 0; letter-spacing: .02em; line-height: 1.25; }
  .kop-text p { font-size: 8pt; color: #64748B; margin-top: 3px; font-weight: 600; letter-spacing: .01em; }
  
  /* Kop Formulir Kotak 3-Kolom Khas PLN UP Sertifikasi */
  .kop-formulir-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1.5px solid #000; }
  .kop-formulir-table td { border: 1px solid #000; padding: 8px 12px; vertical-align: middle; }
  .kop-form-logo { width: 32%; text-align: left; }
  .kop-form-title { width: 40%; text-align: center; font-size: 11pt; font-weight: 800; color: #000; letter-spacing: 0.02em; line-height: 1.35; }
  .kop-form-meta { width: 28%; font-size: 8pt; line-height: 1.55; color: #000; }

  /* Metadata Table */
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 8.5pt; }
  .meta-table td { padding: 5px 8px; border: 1px solid #CBD5E1; }
  .meta-table td:nth-child(odd) { font-weight: 700; background: #F8FAFC; width: 28%; color: #475569; }
  
  .doc-title { font-family: 'Noto Serif', Georgia, serif; font-size: 14pt; font-weight: 700; text-align: center; margin: 16px 0; color: #0B192C; letter-spacing: .02em; }
  h3 { font-family: 'Noto Serif', Georgia, serif; font-size: 11pt; font-weight: 700; color: #0B192C; margin: 18px 0 6px; }
  
  /* Content formatting */
  .content { font-size: 9.5pt; line-height: 1.7; margin-bottom: 8px; }
  .content p { margin-bottom: 6px; }
  .content ol, .content ul { padding-left: 20px; margin-bottom: 6px; }
  .content li { margin-bottom: 4px; }
  
  /* Table styling resmi: lapang, rapi, berpadding proporsional */
  table, .content table { width: 100% !important; border-collapse: collapse !important; margin: 12px 0 16px !important; font-size: 9pt !important; page-break-inside: auto; }
  table th, .content table th { background-color: #F1F5F9 !important; color: #0F172A !important; font-weight: 700 !important; text-align: center !important; padding: 8px 12px !important; border: 1px solid #000 !important; vertical-align: middle !important; line-height: 1.35 !important; }
  table td, .content table td { padding: 8px 12px !important; border: 1px solid #000 !important; vertical-align: top !important; line-height: 1.5 !important; color: #1A1A1A !important; }
  
  /* Helper borderless table untuk form isian data / tanda tangan */
  table[style*="border:none"], table[style*="border: none"] { border: none !important; }
  table[style*="border:none"] td, table[style*="border: none"] td { border: none !important; }
  
  /* Lembar Pengesahan & Riwayat */
  .pengesahan-title, .riwayat-title { font-size: 10pt; font-weight: 800; color: #0B192C; margin: 16px 0 6px; letter-spacing: 0.03em; }
  .pengesahan-table td { border: 1px solid #334155 !important; padding: 10px 14px !important; }
  .riwayat-table th { background-color: #F1F5F9 !important; border: 1px solid #334155 !important; padding: 6px 8px !important; font-size: 8.5pt !important; }
  .riwayat-table td { border: 1px solid #475569 !important; padding: 6px 8px !important; font-size: 8.5pt !important; }

  .refs ul { padding-left: 16px; font-size: 9pt; }
  .sig-block { display: flex; gap: 16px; margin-top: 32px; border-top: 1.5px solid #0B192C; padding-top: 14px; page-break-inside: avoid; }
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
  <div class="controlled">${doc.status === 'Aktif' ? 'CONTROLLED COPY' : 'DRAFT — BELUM RESMI'}</div>
  ${headerHtml}
  ${bodyHtml}
  ${refsHtml ? `<div class="refs"><h3>Referensi Dokumen</h3><ul>${refsHtml}</ul></div>` : ''}
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
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }

  // Return URL path (relative to /public)
  return `/uploads/pdf/${fileName}`;
}
