import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export interface ParsedDocumentResult {
  judul: string;
  kode: string;
  detectedType: string;
  sections: Record<string, string>;
  unmatchedSections: Array<{ title: string; content: string }>;
  sourceType: 'docx' | 'pdf';
}

const SECTION_KEYWORDS = [
  { key: 'tujuan', regex: /^(?:\d+[\.\)]\s*)?tujuan/i },
  { key: 'ruang_lingkup', regex: /^(?:\d+[\.\)]\s*)?ruang\s*lingkup/i },
  { key: 'dokumen_referensi', regex: /^(?:\d+[\.\)]\s*)?dokumen\s*referensi/i },
  { key: 'referensi', regex: /^(?:\d+[\.\)]\s*)?referensi|standar\s*acuan|dasar\s*hukum/i },
  { key: 'proses_bisnis', regex: /^(?:\d+[\.\)]\s*)?proses\s*bisnis|pohon\s*bisnis/i },
  { key: 'istilah_definisi', regex: /^(?:\d+[\.\)]\s*)?istilah|definisi|pengertian/i },
  { key: 'personil', regex: /^(?:\d+[\.\)]\s*)?personil|kualifikasi\s*personil/i },
  { key: 'peralatan_kerja', regex: /^(?:\d+[\.\)]\s*)?peralatan\s*kerja|alat\s*kerja/i },
  { key: 'perlengkapan_k3', regex: /^(?:\d+[\.\)]\s*)?perlengkapan\s*k3|k3l|apd/i },
  { key: 'material', regex: /^(?:\d+[\.\)]\s*)?material|bahan\s*habis\s*pakai/i },
  { key: 'uraian_kegiatan', regex: /^(?:\d+[\.\)]\s*)?uraian\s*kegiatan|langkah\s*kerja/i },
  { key: 'alur_prosedur', regex: /^(?:\d+[\.\)]\s*)?alur\s*pros[ed]+ur|prosedur|tahapan\s*pelaksanaan/i },
  { key: 'dokumen_pendukung', regex: /^(?:\d+[\.\)]\s*)?dokumen\s*pendukung|lampiran|rekaman\s*terkait/i },
  { key: 'profil_organisasi', regex: /^(?:\d+[\.\)]\s*)?profil\s*organisasi/i },
  { key: 'kebijakan_mutu', regex: /^(?:\d+[\.\)]\s*)?kebijakan\s*mutu/i },
  { key: 'struktur_organisasi', regex: /^(?:\d+[\.\)]\s*)?struktur\s*organisasi/i },
  { key: 'sistem_manajemen_terintegrasi', regex: /^(?:\d+[\.\)]\s*)?sistem\s*manajemen/i },
  { key: 'petunjuk_pengisian', regex: /^(?:\d+[\.\)]\s*)?petunjuk\s*pengisian/i },
  { key: 'daftar_rekaman', regex: /^(?:\d+[\.\)]\s*)?daftar\s*rekaman/i },
];

function matchSectionKey(title: string): string | null {
  const clean = title.replace(/<[^>]+>/g, '').trim();
  for (const kw of SECTION_KEYWORDS) {
    if (kw.regex.test(clean)) return kw.key;
  }
  return null;
}

/**
 * Parse file Word (.docx) menjadi seksi terstruktur
 */
export async function parseDocxBuffer(buffer: Buffer): Promise<ParsedDocumentResult> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;

  // 1. Deteksi Jenis Dokumen
  let detectedType = 'SOP/Prosedur';
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes('manual mutu') || lowerHtml.includes('pedoman mutu')) {
    detectedType = 'Manual Mutu';
  } else if (lowerHtml.includes('instruksi kerja') || lowerHtml.includes('intruksi kerja')) {
    detectedType = 'Instruksi Kerja';
  } else if (lowerHtml.includes('pemusnahan rekaman') || lowerHtml.includes('berita acara')) {
    detectedType = 'Berita Acara Pemusnahan (FR.01.05)';
  } else if (lowerHtml.includes('pernyataan kerahasiaan')) {
    detectedType = 'Pernyataan Kerahasiaan (FR.01.06)';
  } else if (lowerHtml.includes('daftar rekaman mutu')) {
    detectedType = 'Daftar Rekaman Mutu (FR.01.07)';
  } else if (lowerHtml.includes('formulir')) {
    detectedType = 'Formulir Standar (FR.01.04)';
  }

  // 2. Deteksi Judul Dokumen
  let judul = '';
  const titleMatch = html.match(/<strong>(?:DOKUMEN\s+(?:PROSEDUR|MUTU|INSTRUKSI\s+KERJA|FORMULIR)|FORMULIR|PROSEDUR)[^<]*<\/strong>(?:\s*<\/p>\s*<p>\s*<strong>(.*?)<\/strong>)?/i);
  if (titleMatch && titleMatch[1]) {
    const raw = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (raw && !raw.startsWith('...')) judul = raw;
  }
  if (!judul) {
    const firstH1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (firstH1 && firstH1[1]) {
      const cleanH1 = firstH1[1].replace(/<[^>]+>/g, '').trim();
      if (cleanH1 && !cleanH1.toLowerCase().includes('riwayat') && !cleanH1.toLowerCase().includes('daftar isi')) {
        judul = cleanH1;
      }
    }
  }

  // 3. Deteksi Kode Dokumen
  let kode = '';
  const kodeMatch = html.match(/\b([A-Z]{2,4}\.UPS\.[A-Z0-9._/-]+)\b/i);
  if (kodeMatch) {
    kode = kodeMatch[1].trim();
  }

  // 4. Ekstraksi Seksi berdasarkan Heading (h1-h6)
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const sections: Record<string, string> = {};
  const unmatchedSections: Array<{ title: string; content: string }> = [];

  const headings: Array<{ index: number; endIndex: number; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(html)) !== null) {
    const rawHeading = match[2].replace(/<[^>]+>/g, '').trim();
    if (
      rawHeading &&
      !rawHeading.toLowerCase().includes('riwayat perubahan') &&
      !rawHeading.toLowerCase().includes('daftar isi') &&
      !rawHeading.toLowerCase().includes('daftar lampiran') &&
      !rawHeading.toLowerCase().includes('daftar tabel') &&
      !rawHeading.toLowerCase().includes('daftar gambar')
    ) {
      headings.push({
        index: match.index,
        endIndex: headingRegex.lastIndex,
        text: rawHeading
      });
    }
  }

  if (headings.length > 0) {
    for (let i = 0; i < headings.length; i++) {
      const curr = headings[i];
      const next = headings[i + 1];
      let content = html.slice(curr.endIndex, next ? next.index : html.length).trim();
      
      // Bersihkan paragraf kosong berlebih di awal/akhir
      content = content.replace(/^(?:<p>\s*(?:&nbsp;|\s)*<\/p>)+/gi, '').replace(/(?:<p>\s*(?:&nbsp;|\s)*<\/p>)+$/gi, '').trim();

      const key = matchSectionKey(curr.text);
      if (key) {
        sections[key] = content;
      } else if (curr.text) {
        unmatchedSections.push({ title: curr.text, content });
        const slugKey = curr.text.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
        sections[slugKey] = content;
      }
    }
  } else {
    // Jika tidak memiliki tag <h1>...<h6> (misal formulir instrumen, berita acara, surat pernyataan)
    if (detectedType === 'Pernyataan Kerahasiaan (FR.01.06)') {
      // Potong ke komitmen list dan identitas
      const olMatch = html.match(/<ol[\s\S]*?<\/ol>/i);
      if (olMatch) {
        sections['pernyataan_komitmen'] = olMatch[0];
        const beforeOl = html.slice(0, olMatch.index).trim();
        const afterOl = html.slice((olMatch.index || 0) + olMatch[0].length).trim();
        if (beforeOl) sections['identitas_pihak'] = beforeOl;
        if (afterOl) sections['konsekuensi_penutup'] = afterOl;
      } else {
        sections['identitas_pihak'] = html;
      }
    } else if (detectedType === 'Berita Acara Pemusnahan (FR.01.05)') {
      const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
      if (tableMatch) {
        sections['daftar_rekaman'] = tableMatch[0];
        const beforeTable = html.slice(0, tableMatch.index).trim();
        const afterTable = html.slice((tableMatch.index || 0) + tableMatch[0].length).trim();
        if (beforeTable) sections['identitas_ba'] = beforeTable;
        if (afterTable) sections['penutup_pengesahan'] = afterTable;
      } else {
        sections['identitas_ba'] = html;
      }
    } else {
      // Formulir Standar / dokumen umum lainnya
      const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
      if (tableMatch) {
        sections['isian_formulir'] = tableMatch[0];
        const before = html.slice(0, tableMatch.index).trim();
        if (before) sections['petunjuk_pengisian'] = before;
      } else {
        sections['isian_formulir'] = html;
      }
    }
  }

  return {
    judul: judul || (detectedType.startsWith('Formulir') ? 'FORMULIR MUTU STANDAR' : 'PROSEDUR OPERASIONAL MUTU'),
    kode: kode || '',
    detectedType,
    sections,
    unmatchedSections,
    sourceType: 'docx'
  };
}

/**
 * Parse file PDF menjadi seksi terstruktur
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocumentResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textObj = await parser.getText();
  const rawText: string = (textObj as any).text || '';

  // Deteksi jenis dokumen
  let detectedType = 'SOP/Prosedur';
  const lowerText = rawText.toLowerCase();
  if (lowerText.includes('manual mutu') || lowerText.includes('pedoman mutu')) {
    detectedType = 'Manual Mutu';
  } else if (lowerText.includes('instruksi kerja')) {
    detectedType = 'Instruksi Kerja';
  } else if (lowerText.includes('formulir')) {
    detectedType = 'Formulir Standar (FR.01.04)';
  }

  // Deteksi kode
  let kode = '';
  const kodeMatch = rawText.match(/\b([A-Z]{2,4}[-.]?[A-Z0-9._/-]+)\b/);
  if (kodeMatch) kode = kodeMatch[1].trim();

  // Deteksi judul
  let judul = '';
  const titleLine = rawText.split('\n').find(l => l.trim().length > 5 && l === l.toUpperCase() && !l.includes('PLN') && !l.includes('SISTEM') && !l.includes('KODE'));
  if (titleLine) judul = titleLine.trim();

  // Klausul split regex
  const clauseMarkers = [
    { key: 'tujuan', regex: /(?:^|\n)(?:\d+[\.\)]\s*)?TUJUAN\b/i },
    { key: 'ruang_lingkup', regex: /(?:^|\n)(?:\d+[\.\)]\s*)?RUANG\s+LINGKUP\b/i },
    { key: 'referensi', regex: /(?:^|\n)(?:\d+[\.\)]\s*)?(?:DOKUMEN\s+)?REFERENSI\b/i },
    { key: 'proses_bisnis', regex: /(?:^|\n)(?:\d+[\.\)]\s*)?PROSES\s+BISNIS\b/i },
    { key: 'istilah_definisi', regex: /(?:^|\n)(?:\d+[\.\)]\s*)?ISTILAH(?:\s+DAN\s+DEFINISI)?\b/i },
    { key: 'alur_prosedur', regex: /(?:^|\n)(?:\d+[\.\)]\s*)?(?:ALUR\s+)?PROSEDUR\b/i },
    { key: 'dokumen_pendukung', regex: /(?:^|\n)(?:\d+[\.\)]\s*)?DOKUMEN\s+PENDUKUNG\b/i },
  ];

  const foundMarkers: Array<{ key: string; index: number }> = [];
  for (const cm of clauseMarkers) {
    const m = rawText.search(cm.regex);
    if (m !== -1) {
      foundMarkers.push({ key: cm.key, index: m });
    }
  }

  foundMarkers.sort((a, b) => a.index - b.index);

  const sections: Record<string, string> = {};
  if (foundMarkers.length > 0) {
    for (let i = 0; i < foundMarkers.length; i++) {
      const curr = foundMarkers[i];
      const next = foundMarkers[i + 1];
      const chunk = rawText.slice(curr.index, next ? next.index : rawText.length);
      // Hapus baris judul klausul
      const lines = chunk.split('\n').filter(l => l.trim().length > 0);
      lines.shift(); // hapus header
      const paragraphHtml = lines
        .map(line => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()}</p>`)
        .join('');
      sections[curr.key] = paragraphHtml;
    }
  } else {
    // Fallback: seluruh teks ke satu seksi
    const paras = rawText.split(/\n\s*\n/).map(p => `<p>${p.trim()}</p>`).join('');
    sections['tujuan'] = paras;
  }

  return {
    judul: judul || 'DOKUMEN MUTU TERKENDALI',
    kode: kode || '',
    detectedType,
    sections,
    unmatchedSections: [],
    sourceType: 'pdf'
  };
}
