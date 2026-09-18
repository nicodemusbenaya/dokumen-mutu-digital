// Master Klausul Standar ISO & Template Cepat untuk Dokumen Mutu PLN UP Sertifikasi
// Membantu staf menyusun dokumen dengan kalimat baku yang sesuai standar audit ISO 9001/17024/17025

export interface ClauseSnippet {
  id: string;
  title: string;
  category: string;
  description: string;
  htmlContent: string;
}

export const SECTION_SNIPPETS: Record<string, ClauseSnippet[]> = {
  tujuan: [
    {
      id: 'tujuan_operasional_baku',
      title: 'Pedoman Operasional & Pengendalian Standar',
      category: 'Operasional',
      description: 'Kalimat tujuan standar untuk prosedur mutu operasional.',
      htmlContent: `<p>Prosedur ini disusun dengan tujuan untuk:</p>
<ul>
  <li>Memastikan seluruh tahapan proses operasional berjalan secara tertib, akurat, mutakhir, dan konsisten;</li>
  <li>Mencegah terjadinya kesalahan pelaksanaan, ketidaksesuaian proses, atau penggunaan dokumen yang tidak sah;</li>
  <li>Menjamin kepatuhan terhadap regulasi ketenagalistrikan dan standar mutu yang berlaku.</li>
</ul>`,
    },
    {
      id: 'tujuan_iso_9001',
      title: 'Kepatuhan Standar SNI ISO 9001:2015',
      category: 'ISO 9001',
      description: 'Fokus pada pemenuhan sistem manajemen mutu & kepuasan pelanggan.',
      htmlContent: `<p>Memberikan panduan pelaksanaan kegiatan guna memastikan pemenuhan persyaratan Sistem Manajemen Mutu <strong>SNI ISO 9001:2015</strong> Klausul 7.5 (Informasi Terdokumentasi) dan Klausul 8 (Operasi), serta meningkatkan kepuasan pelanggan secara berkelanjutan.</p>`,
    },
    {
      id: 'tujuan_sertifikasi_lsp',
      title: 'Penjaminan Mutu Sertifikasi Kompetensi (LSP/LSK)',
      category: 'Sertifikasi',
      description: 'Tujuan khusus untuk proses sertifikasi kompetensi tenaga teknik.',
      htmlContent: `<p>Memastikan bahwa proses sertifikasi kompetensi tenaga teknik ketenagalistrikan dilaksanakan secara independen, adil, objektif, dan valid sesuai dengan ketentuan <strong>Pedoman BNSP</strong> serta standar <strong>SNI ISO/IEC 17024:2012</strong>.</p>`,
    },
  ],

  ruang_lingkup: [
    {
      id: 'lingkup_seluruh_ups',
      title: 'Seluruh Lingkungan PLN UP Sertifikasi',
      category: 'Umum',
      description: 'Cakupan seluruh bidang dan unit kerja PLN UPS.',
      htmlContent: `<p>Prosedur ini berlaku untuk seluruh bidang kerja, pejabat struktural, staf fungsional, dan pihak terkait di lingkungan <strong>PT PLN (Persero) Unit Pelaksana Sertifikasi</strong>, mencakup kantor operasional Ragunan, Duren Tiga, serta unit layanan sertifikasi terkait.</p>`,
    },
    {
      id: 'lingkup_siklus_penuh',
      title: 'Siklus Proses dari Permohonan hingga Pelaporan',
      category: 'Alur Kerja',
      description: 'Menjelaskan batas awal dan batas akhir kegiatan.',
      htmlContent: `<p>Ruang lingkup pelaksanaan meliputi tahapan penerimaan permohonan, verifikasi kelengkapan persyaratan teknis/administratif, pelaksanaan uji atau asesmen kesesuaian, validasi dan pengesahan hasil, hingga penyerahan produk sertifikasi dan pengarsipan rekaman mutu.</p>`,
    },
  ],

  istilah_definisi: [
    {
      id: 'definisi_mutu_standar',
      title: 'Paket Definisi Baku Sistem Mutu ISO 9000',
      category: 'ISO 9000',
      description: 'Kumpulan definisi standar dokumen terkendali, rekaman, audit, dll.',
      htmlContent: `<ol>
  <li><strong>Dokumen Terkendali (Controlled Copy):</strong> Dokumen resmi yang peredaran, nomor versi, dan masa berlakunya dikendalikan secara digital melalui aplikasi EDMS.</li>
  <li><strong>Rekaman Mutu:</strong> Dokumen yang menyatakan hasil yang dicapai atau memberikan bukti pelaksanaan suatu aktivitas kerja.</li>
  <li><strong>Ketidaksesuaian (Non-Conformance):</strong> Kondisi tidak terpenuhinya satu atau lebih persyaratan standar acuan, prosedur operasional, atau regulasi yang berlaku.</li>
  <li><strong>Tindakan Korektif:</strong> Tindakan untuk menghilangkan penyebab ketidaksesuaian guna mencegah terulangnya kejadian serupa di masa mendatang.</li>
</ol>`,
    },
  ],

  alur_prosedur: [
    {
      id: 'alur_lima_tahap',
      title: 'Matriks 5 Tahap Prosedur Mutu Baku',
      category: 'SOP Mutu',
      description: 'Kerangka alur standar 5 langkah kerja operasional.',
      htmlContent: `<ol>
  <li><strong>Persiapan & Identifikasi Kebutuhan:</strong> Staf pelaksana memeriksa kelengkapan dasar, dokumen referensi, dan ketersediaan sarana pendukung sebelum kegiatan dimulai.</li>
  <li><strong>Verifikasi & Validasi Awal:</strong> Petugas yang berwenang melakukan pemeriksaan berkas dan parameter teknis sesuai standar acuan.</li>
  <li><strong>Pelaksanaan Aktivitas Inti:</strong> Melaksanakan pekerjaan sesuai metode kerja, standar K3, dan instruksi kerja teknis yang telah ditetapkan.</li>
  <li><strong>Evaluasi & Pengesahan Hasil:</strong> Mengkaji hasil pelaksanaan, menandatangani formulir rekaman kerja, dan meminta persetujuan dari penanggung jawab bidang.</li>
  <li><strong>Pengarsipan Rekaman Mutu:</strong> Menyimpan seluruh dokumen evidence pada sistem EDMS sesuai jadwal retensi arsip yang berlaku.</li>
</ol>`,
    },
  ],

  dokumen_pendukung: [
    {
      id: 'pendukung_standar',
      title: 'Daftar Dokumen Mutu Terkait Baku',
      category: 'Formulir',
      description: 'Daftar formulir kendali, checklist, dan instruksi kerja pendukung.',
      htmlContent: `<ul>
  <li>Formulir Checklist Verifikasi Persyaratan (FR.UPS.SER3.BMK.01.04)</li>
  <li>Instruksi Kerja Pengoperasian Sarana Uji (IK.UPS.SER3.BMK.01)</li>
  <li>Berita Acara Pelaksanaan Kegiatan Operasional</li>
  <li>Daftar Rekaman Mutu Terkendali (FR.UPS.SER3.BMK.01.07)</li>
</ul>`,
    },
  ],
};

export function getSnippetsForSection(sectionKey: string): ClauseSnippet[] {
  const normalized = sectionKey.toLowerCase();
  for (const [key, snippets] of Object.entries(SECTION_SNIPPETS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return snippets;
    }
  }
  return [];
}
