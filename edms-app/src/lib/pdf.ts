import path from 'path';
import fs from 'fs/promises';

// ─────────────────────────────────────────────────────────────────
//  PDF Generation — Puppeteer (HTML-to-PDF)
//  Menggunakan puppeteer-core + @sparticuz/chromium-min
//  untuk kompatibilitas dengan Windows NAS deployment
// ─────────────────────────────────────────────────────────────────

async function getBrowser() {
  // Di production (NAS), gunakan chromium-min
  // Di development Windows, gunakan puppeteer biasa
  if (process.env.NODE_ENV === 'production') {
    const chromium = await import('@sparticuz/chromium-min');
    const puppeteer = await import('puppeteer-core');
    return puppeteer.default.launch({
      args:            (chromium.default as any).args || [],
      defaultViewport: (chromium.default as any).defaultViewport || { width: 1200, height: 800 },
      executablePath:  await (chromium.default as any).executablePath(),
      headless:        true,
    });
  } else {
    // Development: gunakan puppeteer full
    try {
      const puppeteer = await import('puppeteer');
      return puppeteer.default.launch({ headless: true });
    } catch {
      // Fallback ke puppeteer-core dengan chromium
      const puppeteer = await import('puppeteer-core');
      return puppeteer.default.launch({
        headless: true,
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

// ─── Generate HTML untuk PDF ──────────────────────────────────

function buildPdfHtml(doc: PdfDocumentData): string {
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

  const sections: Record<string, string> = {
    tujuan:        '1. Tujuan',
    ruang_lingkup: '2. Ruang Lingkup',
    definisi:      '3. Definisi & Istilah',
    prosedur:      '4. Prosedur',
    lampiran:      '5. Lampiran',
  };

  const bodyHtml = Object.entries(sections)
    .filter(([key]) => doc.sections[key])
    .map(([key, label]) => `
      <h3>${label}</h3>
      <div class="content">${doc.sections[key]}</div>
    `).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&family=Noto+Sans:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 11pt; color: #1A1A1A; line-height: 1.6; }
  .page { padding: 30mm 25mm 25mm; position: relative; }
  .controlled { position: absolute; top: 10mm; right: 12mm; font-size: 8pt; font-weight: 700; letter-spacing: .05em; color: #2E7D5A; border: 1.5px solid #2E7D5A; border-radius: 10px; padding: 3px 9px; }
  .kop { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1B2A4A; padding-bottom: 10px; margin-bottom: 14px; }
  .kop-icon { width: 44px; height: 44px; background: #D99A34; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .kop-text h3 { font-size: 13pt; font-weight: 700; color: #1B2A4A; }
  .kop-text p { font-size: 9pt; color: #555; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9pt; }
  .meta-table td { padding: 4px 8px; border: 1px solid #DDD; }
  .meta-table td:nth-child(odd) { font-weight: 700; background: #F5F3ED; width: 28%; }
  .doc-title { font-family: 'Noto Serif', Georgia, serif; font-size: 16pt; font-weight: 700; text-align: center; margin: 16px 0; color: #1B2A4A; }
  h3 { font-family: 'Noto Serif', Georgia, serif; font-size: 11pt; font-weight: 700; color: #1B2A4A; margin: 16px 0 6px; }
  .content { font-size: 10.5pt; line-height: 1.75; margin-bottom: 8px; }
  .content p { margin-bottom: 6px; }
  .content ol, .content ul { padding-left: 18px; margin-bottom: 6px; }
  .content li { margin-bottom: 3px; }
  .refs ul { padding-left: 16px; font-size: 9.5pt; }
  .sig-block { display: flex; gap: 16px; margin-top: 40px; }
  .sig-col { flex: 1; text-align: center; }
  .sig-label { font-size: 9pt; color: #666; margin-bottom: 8px; }
  .sig-draw { height: 52px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px; }
  .sig-empty { color: #CCC; font-size: 18pt; }
  .name-line { border-top: 1px solid #999; padding-top: 5px; margin-top: 4px; }
  .sig-name { font-weight: 700; font-size: 10pt; }
  .sig-title { font-size: 8.5pt; color: #666; }
  .qr-block { flex: 0.6; }
  .qr-img { width: 52px; height: 52px; background: repeating-conic-gradient(#DDD 0% 25%, #fff 0% 50%) 0 0 / 6px 6px; margin: 8px auto; border: 1px solid #DDD; }
  .qr-note { font-size: 8pt; color: #999; text-align: center; }
</style>
</head>
<body>
<div class="page">
  <div class="controlled">${doc.status === 'Aktif' ? 'CONTROLLED COPY' : 'DRAFT — BELUM RESMI'}</div>
  <div class="kop">
    <div class="kop-icon">⚡</div>
    <div class="kop-text">
      <h3>PLN UP Sertifikasi</h3>
      <p>Sistem Manajemen Terintegrasi — Dokumen Mutu</p>
    </div>
  </div>
  <table class="meta-table">
    <tr><td>Kode Dokumen</td><td>${doc.kode}</td><td>Versi</td><td>v${doc.versi}</td></tr>
    <tr><td>Jenis</td><td>${doc.jenis}</td><td>Status</td><td>${doc.status}</td></tr>
    <tr><td>Bidang</td><td>${doc.bidang}</td><td>Berlaku Sejak</td><td>${new Date(doc.updatedAt).toLocaleDateString('id-ID')}</td></tr>
  </table>
  <div class="doc-title">${doc.judul}</div>
  ${bodyHtml}
  ${refsHtml ? `<div class="refs"><h3>Referensi Dokumen</h3><ul>${refsHtml}</ul></div>` : ''}
  <div class="sig-block">
    ${sigBlock('Disiapkan oleh', doc.penyusun, null, 'Penyusun Dokumen')}
    ${sigBlock('Menyetujui', doc.mgrApprover, doc.mgrSignature, 'Manager Bidang')}
    ${sigBlock('Mengesahkan', doc.pimpinanApprover, doc.pimpinanSignature, 'Pimpinan Unit')}
    <div class="sig-col qr-block">
      <div class="sig-label">Kode Verifikasi</div>
      <div class="qr-img"></div>
      <div class="qr-note">${doc.kode} · v${doc.versi}</div>
    </div>
  </div>
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
  await fs.mkdir(uploadDir, { recursive: true });

  const fileName = `${doc.kode.replace(/\//g, '-')}_v${doc.versi}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  const html    = buildPdfHtml(doc);
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
