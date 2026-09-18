// Master Konfigurasi Jenis Dokumen & Struktur Seksi Baku
// Sesuai Prosedur PR.UPS.SER3.BMK.01-02 dan Formulir Baku FR.UPS.SER3.BMK.01.01 s/d 01.07
// PT PLN (Persero) Unit Pelaksana Sertifikasi

export type DocumentType = 
  | 'SOP/Prosedur'
  | 'Manual Mutu'
  | 'Instruksi Kerja'
  | 'Formulir Standar (FR.01.04)'
  | 'Berita Acara Pemusnahan (FR.01.05)'
  | 'Pernyataan Kerahasiaan (FR.01.06)'
  | 'Daftar Rekaman Mutu (FR.01.07)'
  | 'Formulir Kerja'
  | 'BA Pemusnahan Rekaman'
  | 'Pernyataan Kerahasiaan'
  | 'Daftar Rekaman Mutu'
  | 'Formulir Tambahan';

export interface SectionDef {
  key: string;
  label: string;
  hint: string;
  defaultHtml?: string;
}

export const DOCUMENT_TYPES: DocumentType[] = [
  'SOP/Prosedur',
  'Manual Mutu',
  'Instruksi Kerja',
  'Formulir Standar (FR.01.04)',
  'Berita Acara Pemusnahan (FR.01.05)',
  'Pernyataan Kerahasiaan (FR.01.06)',
  'Daftar Rekaman Mutu (FR.01.07)',
  'Formulir Kerja',
  'Formulir Tambahan',
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'SOP/Prosedur': 'Prosedur / SOP (Level 2 — FR.01.02)',
  'Manual Mutu': 'Dokumen Mutu / Manual Mutu (Level 1 — FR.01.01)',
  'Instruksi Kerja': 'Instruksi Kerja (Level 3 — FR.01.03)',
  'Formulir Standar (FR.01.04)': 'Formulir Mutu Standar (Level 4 — FR.01.04)',
  'Berita Acara Pemusnahan (FR.01.05)': 'Berita Acara Pemusnahan Rekaman (FR.01.05)',
  'Pernyataan Kerahasiaan (FR.01.06)': 'Surat Pernyataan Kerahasiaan (FR.01.06)',
  'Daftar Rekaman Mutu (FR.01.07)': 'Daftar Rekaman Mutu Terkendali (FR.01.07)',
  'Formulir Kerja': 'Formulir Mutu Standar (FR.01.04)',
  'BA Pemusnahan Rekaman': 'Berita Acara Pemusnahan Rekaman (FR.01.05)',
  'Pernyataan Kerahasiaan': 'Surat Pernyataan Kerahasiaan (FR.01.06)',
  'Daftar Rekaman Mutu': 'Daftar Rekaman Mutu (FR.01.07)',
  'Formulir Tambahan': 'Formulir Tambahan (Rekaman Mutu Khusus)',
};

export const DOCUMENT_TYPE_BADGES: Record<DocumentType, string> = {
  'SOP/Prosedur': 'badge-amber',
  'Manual Mutu': 'badge-navy',
  'Instruksi Kerja': 'badge-teal',
  'Formulir Standar (FR.01.04)': 'badge-purple',
  'Berita Acara Pemusnahan (FR.01.05)': 'badge-red',
  'Pernyataan Kerahasiaan (FR.01.06)': 'badge-blue',
  'Daftar Rekaman Mutu (FR.01.07)': 'badge-green',
  'Formulir Kerja': 'badge-purple',
  'BA Pemusnahan Rekaman': 'badge-red',
  'Pernyataan Kerahasiaan': 'badge-blue',
  'Daftar Rekaman Mutu': 'badge-green',
  'Formulir Tambahan': 'badge-purple',
};

// Seksi Baku untuk masing-masing jenis dokumen sesuai 7 formulir resmi PLN UPS
export const DOCUMENT_SECTIONS: Record<DocumentType, SectionDef[]> = {
  'SOP/Prosedur': [
    {
      key: 'tujuan',
      label: '1. Tujuan',
      hint: 'Menjelaskan tujuan disusunnya prosedur (misal: memastikan keakuratan, ketersediaan, dan kepatuhan).',
      defaultHtml: '<p>Memastikan bahwa:</p><ul><li>Pengendalian proses operasional berjalan akurat, mutakhir, aman, dan konsisten;</li><li>Mencegah terjadinya kesalahan pelaksanaan atau penggunaan dokumen tidak sah.</li></ul>'
    },
    {
      key: 'ruang_lingkup',
      label: '2. Ruang Lingkup',
      hint: 'Mencakup batasan penerapan dan unit/pihak yang terlibat.',
      defaultHtml: '<p>Meliputi seluruh tahapan pelaksanaan mulai dari perencanaan, pelaksanaan teknis, verifikasi hasil, hingga dokumentasi dan evaluasi di lingkungan PT PLN (Persero) Unit Pelaksana Sertifikasi.</p>'
    },
    {
      key: 'referensi',
      label: '3. Referensi',
      hint: 'Standar ISO, regulasi pemerintah, peraturan direksi PLN, atau SKKNI acuan.',
      defaultHtml: '<ul><li>SNI ISO 9001:2015 Sistem Manajemen Mutu</li><li>SNI ISO/IEC 17024:2012 Penilaian Kesesuaian — Persyaratan Umum LSP</li><li>Pedoman BNSP No. 201 Tahun 2014</li><li>Petunjuk Teknis PT PLN (Persero) No. 0031.PTs/DIR TNK/2025</li></ul>'
    },
    {
      key: 'proses_bisnis',
      label: '4. Proses Bisnis',
      hint: 'Nomor kode dan nama proses bisnis sesuai Pohon Bisnis PLN UPS (contoh: 2.3.9 Memelihara akreditasi/lisensi).',
      defaultHtml: '<p><strong>2.3.9</strong> Memelihara akreditasi/lisensi LSP dan LSK serta penjaminan mutu sertifikasi kompetensi ketenagalistrikan.</p>'
    },
    {
      key: 'istilah_definisi',
      label: '5. Istilah dan Definisi',
      hint: 'Definisi istilah teknis dan singkatan yang digunakan dalam penulisan prosedur.',
      defaultHtml: '<p>Istilah dan definisi yang digunakan dalam penulisan prosedur ini mengacu pada standar ISO 9000 serta ketentuan operasional PLN UP Sertifikasi.</p>'
    },
    {
      key: 'alur_prosedur',
      label: '6. Alur Prosedur',
      hint: 'Uraian langkah kerja langkah demi langkah menggunakan kalimat aktif performatif.',
      defaultHtml: '<ol><li><strong>Persiapan:</strong> Pengelola proses bisnis mengidentifikasi kebutuhan dan dokumen acuan yang relevan.</li><li><strong>Pemeriksaan:</strong> Melakukan verifikasi persyaratan dan kelengkapan administrasi/teknis.</li><li><strong>Pelaksanaan:</strong> Melaksanakan kegiatan sesuai instruksi dan metode kerja yang ditetapkan.</li><li><strong>Validasi & Pelaporan:</strong> Merekam hasil kerja pada formulir kendali dan melaporkan kepada penanggung jawab bidang.</li></ol>'
    },
    {
      key: 'dokumen_pendukung',
      label: '7. Dokumen Pendukung',
      hint: 'Daftar formulir kerja (FR), instruksi kerja (IK), atau rekaman terkait yang digunakan.',
      defaultHtml: '<ul><li>Formulir Isian Standar</li><li>Instruksi Kerja Teknis Terkait</li><li>Daftar Rekaman Mutu</li></ul>'
    }
  ],

  'Manual Mutu': [
    {
      key: 'profil_organisasi',
      label: '1. Profil Organisasi & Ruang Lingkup SMT',
      hint: 'Uraian profil PLN UPS, visi, misi, serta cakupan Sistem Manajemen Terintegrasi.',
      defaultHtml: '<p>PT PLN (Persero) Unit Pelaksana Sertifikasi (UPS) menerapkan Sistem Manajemen Terintegrasi yang mengintegrasikan ISO 9001, ISO/IEC 17024, ISO/IEC 17020, serta regulasi ketenagalistrikan nasional.</p>'
    },
    {
      key: 'kebijakan_mutu',
      label: '2. Kebijakan Mutu & Sasaran',
      hint: 'Pernyataan komitmen mutu pimpinan unit, ketidakberpihakan, dan sasaran mutu.',
      defaultHtml: '<p>Manajemen puncak berkomitmen memberikan layanan sertifikasi kompetensi yang independen, transparan, profesional, dan berorientasi pada keselamatan kerja ketenagalistrikan.</p>'
    },
    {
      key: 'struktur_organisasi',
      label: '3. Struktur Organisasi & Wewenang',
      hint: 'Bagan struktur fungsi, peran, dan tanggung jawab jajaran manajemen dan pelaksana.',
      defaultHtml: '<p>Struktur organisasi PLN UP Sertifikasi dipimpin oleh Senior Manager dan didukung oleh Manager Bidang Pelayanan Sertifikasi, Manager Pengembangan Materi, dan Manager Mutu & Kinerja.</p>'
    },
    {
      key: 'sistem_manajemen_terintegrasi',
      label: '4. Sistem Manajemen Terintegrasi',
      hint: 'Uraian klausul pemenuhan persyaratan sistem manajemen terintegrasi.',
      defaultHtml: '<p>Dokumen Mutu ini menjabarkan pemenuhan persyaratan klausul standar ISO/IEC 17024:2012, SNI ISO 9001:2015, dan Peraturan Pelaksana PT PLN (Persero).</p>'
    },
    {
      key: 'lampiran_referensi',
      label: '5. Lampiran & Dokumen Terkait',
      hint: 'Daftar Prosedur Operasional Standar (SOP), Formulir, dan Matriks Hubungan Klausul.',
      defaultHtml: '<p>Seluruh prosedur operasional (Level 2) dan formulir kerja (Level 4) terdokumentasi dan terkendali dalam sistem EDMS Mutu Digital.</p>'
    }
  ],

  'Instruksi Kerja': [
    {
      key: 'tujuan',
      label: '1. Tujuan',
      hint: 'Tujuan spesifik instruksi teknis ini dijalankan.',
      defaultHtml: '<p>Memberikan panduan teknis yang rinci dan terstandarisasi bagi pelaksana kegiatan operasional.</p>'
    },
    {
      key: 'ruang_lingkup',
      label: '2. Ruang Lingkup',
      hint: 'Batasan kegiatan teknis yang diatur.',
      defaultHtml: '<p>Berlaku bagi seluruh personil teknis yang bertugas di Tempat Uji Kompetensi (TUK) atau unit kerja terkait.</p>'
    },
    {
      key: 'dokumen_referensi',
      label: '3. Dokumen Referensi',
      hint: 'Prosedur induk dan manual petunjuk teknis terkait.',
      defaultHtml: '<ul><li>Prosedur Operasional Standar (Level 2) terkait</li><li>Manual Alat & Petunjuk Teknis Pabrikan</li></ul>'
    },
    {
      key: 'personil',
      label: '4. Personil',
      hint: 'Kualifikasi, kompetensi, atau sertifikasi yang wajib dimiliki personil.',
      defaultHtml: '<p>Asesor kompetensi, teknisi uji, atau petugas administrasi yang memiliki kompetensi sesuai bidang tugasnya.</p>'
    },
    {
      key: 'peralatan_kerja',
      label: '5. Peralatan Kerja',
      hint: 'Daftar perkakas, sistem, komputer, atau instrumen yang digunakan.',
      defaultHtml: '<ul><li>Komputer / Laptop terhubung intranet PLN</li><li>Perangkat lunak browser standar modern</li><li>Alat tulis dan formulir verifikasi</li></ul>'
    },
    {
      key: 'perlengkapan_k3',
      label: '6. Perlengkapan K3',
      hint: 'APD (Alat Pelindung Diri) dan kepatuhan K3L yang wajib dipenuhi.',
      defaultHtml: '<p>Helm pengaman, sepatu safety, dan rompi keselamatan kerja (apabila inspeksi lapangan / uji kompetensi teknis).</p>'
    },
    {
      key: 'material',
      label: '7. Material',
      hint: 'Bahan habis pakai atau dokumen pendukung kegiatan.',
      defaultHtml: '<p>Formulir penilaian, lembar rekaman bukti, dan materi uji yang telah terverifikasi.</p>'
    },
    {
      key: 'uraian_kegiatan',
      label: '8. Uraian Kegiatan',
      hint: 'Langkah demi langkah teknis operasional dari awal hingga selesai.',
      defaultHtml: '<ol><li>Lakukan pemeriksaan awal kelengkapan administrasi dan fisik instrumen.</li><li>Jalankan langkah pengujian/verifikasi sesuai checklist standar.</li><li>Catat setiap nilai atau hasil observasi secara objektif.</li><li>Tandatangani rekaman hasil dan serahkan kepada penanggung jawab kegiatan.</li></ol>'
    }
  ],

  'Formulir Standar (FR.01.04)': [
    {
      key: 'judul_formulir',
      label: '1. Judul & Identitas Formulir',
      hint: 'Nama formulir resmi (misal: FORMULIR JADWAL AUDIT INTERNAL MUTU).',
      defaultHtml: '<p style="text-align:center; font-size:12pt; font-weight:bold; margin: 8px 0 14px; letter-spacing:0.04em;">FORMULIR REKAMAN MUTU STANDAR</p>'
    },
    {
      key: 'petunjuk_pengisian',
      label: '2. Petunjuk Pengisian',
      hint: 'Panduan tata cara pengisian kolom bagi pengguna formulir.',
      defaultHtml: '<p style="font-size:9.5pt; color:#475569; font-style:italic; margin-bottom:12px;">Petunjuk Pengisian: Isilah kolom-kolom berikut dengan huruf kapital secara jelas. Berikan tanda centang (✓) pada opsi yang sesuai.</p>'
    },
    {
      key: 'isian_formulir',
      label: '3. Format Isian / Matriks Formulir',
      hint: 'Format isian menyesuaikan kebutuhan sesuai template FR.01.04.',
      defaultHtml: '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin:10px 0;"><thead><tr style="background:#f1f5f9;"><th style="width:8%; text-align:center; padding:8px 10px;">NO.</th><th style="width:34%; text-align:center; padding:8px 10px;">ITEM / PARAMETER KEGIATAN</th><th style="width:36%; text-align:center; padding:8px 10px;">STANDAR / KRITERIA ACUAN</th><th style="width:22%; text-align:center; padding:8px 10px;">HASIL VERIFIKASI</th></tr></thead><tbody><tr><td style="text-align:center; padding:8px 10px;">1</td><td style="padding:8px 10px;">Pemeriksaan Kelengkapan Dokumen</td><td style="padding:8px 10px;">Lengkap, Sah, dan Terverifikasi</td><td style="text-align:center; padding:8px 10px;">Sesuai Persyaratan</td></tr><tr><td style="text-align:center; padding:8px 10px;">2</td><td style="padding:8px 10px;">Kesesuaian Data Identitas & Bukti Kerja</td><td style="padding:8px 10px;">KTP / NIP Valid & Evidence Sah</td><td style="text-align:center; padding:8px 10px;">Terverifikasi</td></tr></tbody></table>'
    }
  ],

  'Formulir Kerja': [
    {
      key: 'judul_formulir',
      label: '1. Judul & Identitas Formulir',
      hint: 'Nama formulir resmi (misal: FORMULIR JADWAL AUDIT INTERNAL MUTU).',
      defaultHtml: '<p style="text-align:center; font-size:12pt; font-weight:bold; margin: 8px 0 14px; letter-spacing:0.04em;">FORMULIR REKAMAN MUTU STANDAR</p>'
    },
    {
      key: 'petunjuk_pengisian',
      label: '2. Petunjuk Pengisian',
      hint: 'Panduan tata cara pengisian kolom bagi pengguna formulir.',
      defaultHtml: '<p style="font-size:9.5pt; color:#475569; font-style:italic; margin-bottom:12px;">Petunjuk Pengisian: Isilah kolom-kolom berikut dengan huruf kapital secara jelas. Berikan tanda centang (✓) pada opsi yang sesuai.</p>'
    },
    {
      key: 'isian_formulir',
      label: '3. Format Isian / Matriks Formulir',
      hint: 'Bentuk tabel, format isian data, checklist, dan kolom tanda tangan.',
      defaultHtml: '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin:10px 0;"><thead><tr style="background:#f1f5f9;"><th style="width:8%; text-align:center; padding:8px 10px;">NO.</th><th style="width:34%; text-align:center; padding:8px 10px;">ITEM / PARAMETER KEGIATAN</th><th style="width:36%; text-align:center; padding:8px 10px;">STANDAR / KRITERIA ACUAN</th><th style="width:22%; text-align:center; padding:8px 10px;">HASIL VERIFIKASI</th></tr></thead><tbody><tr><td style="text-align:center; padding:8px 10px;">1</td><td style="padding:8px 10px;">Pemeriksaan Kelengkapan Dokumen</td><td style="padding:8px 10px;">Lengkap, Sah, dan Terverifikasi</td><td style="text-align:center; padding:8px 10px;">Sesuai Persyaratan</td></tr><tr><td style="text-align:center; padding:8px 10px;">2</td><td style="padding:8px 10px;">Kesesuaian Data Identitas & Bukti Kerja</td><td style="padding:8px 10px;">KTP / NIP Valid & Evidence Sah</td><td style="text-align:center; padding:8px 10px;">Terverifikasi</td></tr></tbody></table>'
    }
  ],

  'Berita Acara Pemusnahan (FR.01.05)': [
    {
      key: 'identitas_ba',
      label: '1. Teks Pembuka & Identitas Berita Acara',
      hint: 'Sesuai template FR.UPS.SER3.BMK.01.05: judul tengah, nomor BA, dan paragraf hari/tanggal.',
      defaultHtml: '<p style="text-align:center; font-weight:bold; font-size:12pt; margin-bottom:4px; letter-spacing:0.02em;">BERITA ACARA<br>PEMUSNAHAN REKAMAN MUTU LSK/LSP USER PLN (BNSP / DJK / KAN)<br>NO. ...................</p><p style="margin-top:14px; margin-bottom:12px; line-height:1.6;">Pada hari ini ......... Tanggal ......... bulan ......... tahun ......... telah dilakukan pemusnahan rekaman mutu sebagai berikut :</p>'
    },
    {
      key: 'daftar_rekaman',
      label: '2. Matriks Tabel Rekaman Mutu yang Dimusnahkan',
      hint: 'Tabel 4 kolom resmi: NO., AKREDITOR/PEMBERI LISENSI, URAIAN, TAHUN PENERBITAN (MM/YYYY).',
      defaultHtml: '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin:14px 0;"><thead><tr style="background:#f1f5f9;"><th style="width:8%; text-align:center; padding:8px 10px;">NO.</th><th style="width:32%; text-align:center; padding:8px 10px;">AKREDITOR/ PEMBERI LISENSI</th><th style="width:40%; text-align:center; padding:8px 10px;">URAIAN</th><th style="width:20%; text-align:center; padding:8px 10px;">TAHUN PENERBITAN (MM/YYYY)</th></tr></thead><tbody><tr><td style="text-align:center; padding:8px 10px;">1</td><td style="padding:8px 10px;">BNSP / DJK ESDM</td><td style="padding:8px 10px;">Berkas Asesmen Uji Kompetensi Tenaga Teknik Listrik Kadaluarsa (> 3 tahun)</td><td style="text-align:center; padding:8px 10px;">12/2022</td></tr><tr><td style="text-align:center; padding:8px 10px;">2</td><td style="padding:8px 10px;">Komite Mutu Internal</td><td style="padding:8px 10px;">Formulir Verifikasi Lapangan Arsip Inaktif</td><td style="text-align:center; padding:8px 10px;">06/2021</td></tr></tbody></table>'
    },
    {
      key: 'penutup_pengesahan',
      label: '3. Penutup & Tanda Tangan Manager',
      hint: 'Paragraf penutup dan tanda tangan Manager Pelayanan Sertifikasi.',
      defaultHtml: '<p style="margin-top:14px; line-height:1.6;">Demikian Berita Acara ini dibuat untuk dapat dipergunakan sebagaimana diperlukan.</p><table style="width:100%; border:none; margin-top:24px;"><tr><td style="width:55%; border:none;"></td><td style="width:45%; border:none; text-align:center;"><p style="margin:0;"><strong>Manager<br>Pelayanan Sertifikasi dan Asesmen</strong></p><div style="height:60px;"></div><p style="margin:0;"><strong>( .................................................... )</strong></p></td></tr></table><div style="margin-top:20px; font-size:8.5pt; color:#64748B; border-top:1px dashed #cbd5e1; padding-top:8px;"><strong>Keterangan Pengisian:</strong><br>1. Diisi nama lembaga (BNSP, KAN, DJK)<br>2. Diisi nomor berita acara<br>3-6. Diisi nama hari, tanggal, bulan, tahun<br>7-9. Diisi rincian dokumen yang dimusnahkan<br>10. Diisi nama bidang, tanda tangan dan nama pengelola rekaman</div>'
    }
  ],

  'BA Pemusnahan Rekaman': [
    {
      key: 'identitas_ba',
      label: '1. Teks Pembuka & Identitas Berita Acara',
      hint: 'Sesuai template FR.UPS.SER3.BMK.01.05: judul tengah, nomor BA, dan paragraf hari/tanggal.',
      defaultHtml: '<p style="text-align:center; font-weight:bold; font-size:12pt; margin-bottom:4px; letter-spacing:0.02em;">BERITA ACARA<br>PEMUSNAHAN REKAMAN MUTU LSK/LSP USER PLN<br>NO. ...................</p><p style="margin-top:14px; margin-bottom:12px; line-height:1.6;">Pada hari ini ......... Tanggal ......... bulan ......... tahun ......... telah dilakukan pemusnahan rekaman mutu sebagai berikut :</p>'
    },
    {
      key: 'daftar_rekaman',
      label: '2. Matriks Tabel Rekaman Mutu yang Dimusnahkan',
      hint: 'Tabel 4 kolom resmi: NO., AKREDITOR/PEMBERI LISENSI, URAIAN, TAHUN PENERBITAN (MM/YYYY).',
      defaultHtml: '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin:14px 0;"><thead><tr style="background:#f1f5f9;"><th style="width:8%; text-align:center; padding:8px 10px;">NO.</th><th style="width:32%; text-align:center; padding:8px 10px;">AKREDITOR/ PEMBERI LISENSI</th><th style="width:40%; text-align:center; padding:8px 10px;">URAIAN</th><th style="width:20%; text-align:center; padding:8px 10px;">TAHUN PENERBITAN (MM/YYYY)</th></tr></thead><tbody><tr><td style="text-align:center; padding:8px 10px;">1</td><td style="padding:8px 10px;">BNSP / DJK ESDM</td><td style="padding:8px 10px;">Berkas Asesmen Uji Kompetensi Tenaga Teknik Listrik Kadaluarsa (> 3 tahun)</td><td style="text-align:center; padding:8px 10px;">12/2022</td></tr><tr><td style="text-align:center; padding:8px 10px;">2</td><td style="padding:8px 10px;">Komite Mutu Internal</td><td style="padding:8px 10px;">Formulir Verifikasi Lapangan Arsip Inaktif</td><td style="text-align:center; padding:8px 10px;">06/2021</td></tr></tbody></table>'
    },
    {
      key: 'penutup_pengesahan',
      label: '3. Penutup & Tanda Tangan Manager',
      hint: 'Paragraf penutup dan tanda tangan Manager Pelayanan Sertifikasi.',
      defaultHtml: '<p style="margin-top:14px; line-height:1.6;">Demikian Berita Acara ini dibuat untuk dapat dipergunakan sebagaimana diperlukan.</p><table style="width:100%; border:none; margin-top:24px;"><tr><td style="width:55%; border:none;"></td><td style="width:45%; border:none; text-align:center;"><p style="margin:0;"><strong>Manager<br>Pelayanan Sertifikasi dan Asesmen</strong></p><div style="height:60px;"></div><p style="margin:0;"><strong>( .................................................... )</strong></p></td></tr></table>'
    }
  ],

  'Pernyataan Kerahasiaan (FR.01.06)': [
    {
      key: 'identitas_pihak',
      label: '1. Identitas Penandatangan & Pernyataan',
      hint: 'Sesuai template FR.UPS.SER3.BMK.01.06: data diri Nama, NIP, Alamat, Jabatan, Perusahaan.',
      defaultHtml: '<p style="margin-bottom:12px; line-height:1.6;">Saya yang bertanda tangan dibawah ini:</p><table style="width:100%; border:none; margin: 12px 0 6px;"><tr><td style="width:24%; border:none; padding:4px 6px;"><strong>Nama</strong></td><td style="width:3%; border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">...................................................</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>NIP</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">...................................................</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>Alamat</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">...................................................</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>Jabatan</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">Asesor Kompetensi / Personil Teknis Sertifikasi</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>Nama Perusahaan</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">PT PLN (Persero) Unit Pelaksana Sertifikasi</td></tr></table><p style="font-size:8.5pt; font-style:italic; color:#64748B; margin-top:-2px; margin-bottom:12px;">*) Coret yang tidak perlu</p><p style="margin-bottom:10px; line-height:1.6;">Menyatakan dengan sesungguhnya bahwa saya bersedia dan sanggup mengikat diri pada Lembaga Sertifikasi Person/Lembaga Sertifikasi Profesi/Lembaga Sertifikasi Kompetensi USER PLN. Kesediaan tersebut saya buktikan dengan hal-hal sebagai berikut:</p>'
    },
    {
      key: 'pernyataan_komitmen',
      label: '2. 6 Butir Komitmen Kerahasiaan (Termasuk UU PDP)',
      hint: '6 klausul baku kerahasiaan materi uji, data pribadi peserta, dan kepatuhan UU No. 27 Tahun 2022.',
      defaultHtml: '<ol style="padding-left:22px; line-height:1.75; margin-bottom:14px;"><li><strong>Menjaga kerahasiaan informasi dan data yang kami akses;</strong></li><li><strong>Tidak mengungkapkan, memberikan, atau memperdagangkan informasi yang kami terima kepada pihak ketiga tanpa izin tertulis dari pihak yang berwenang atau sesuai dengan ketentuan yang berlaku;</strong></li><li><strong>Akan menggunakan informasi yang diakses hanya untuk tujuan yang ditentukan dalam konteks penugasan yang telah disetujui dan tidak akan menggunakan informasi tersebut untuk kepentingan pribadi atau kepentingan lain yang tidak terkait;</strong></li><li><strong>Bertanggung jawab untuk mengamankan informasi yang kami akses atau tangani, baik secara fisik maupun secara digital. Akan menggunakan langkah-langkah keamanan yang sesuai untuk mencegah akses tidak sah atau kebocoran informasi;</strong></li><li><strong>Apabila dalam pelaksanaan penugasan terdapat kebutuhan untuk mengakses data pribadi, maka pemrosesannya tunduk pada ketentuan kerahasiaan dalam pernyataan ini serta UU No. 27 Tahun 2022 (UU PDP), dan diamankan dari akses atau penyalahgunaan pihak yang tidak berwenang;</strong></li><li><strong>Mengakui bahwa kewajiban untuk menjaga kerahasiaan informasi tidak berakhir setelah berakhirnya penugasan dan akan tetap mematuhi kewajiban kerahasiaan sebagaimana yang diatur dalam regulasi yang berlaku, bahkan setelah tidak lagi terlibat dalam penugasan tersebut.</strong></li></ol>'
    },
    {
      key: 'konsekuensi_penutup',
      label: '3. Konsekuensi Hukum & Tanda Tangan Pembuat',
      hint: 'Pernyataan kesadaran hukum dan tempat/tanggal tanda tangan.',
      defaultHtml: '<p style="margin-bottom:14px; line-height:1.6;">Kami menyadari bahwa pelanggaran terhadap komitmen ini dapat berdampak secara hukum.</p><table style="width:100%; border:none; margin-top:24px;"><tr><td style="width:55%; border:none;"></td><td style="width:45%; border:none; text-align:center;"><p style="margin:0;">Jakarta, ......................... 2026<br>Yang membuat pernyataan,</p><div style="height:60px;"></div><p style="margin:0;"><strong>( .................................................... )</strong></p></td></tr></table>'
    }
  ],

  'Pernyataan Kerahasiaan': [
    {
      key: 'identitas_pihak',
      label: '1. Identitas Penandatangan & Pernyataan',
      hint: 'Sesuai template FR.UPS.SER3.BMK.01.06: data diri Nama, NIP, Alamat, Jabatan, Perusahaan.',
      defaultHtml: '<p style="margin-bottom:12px; line-height:1.6;">Saya yang bertanda tangan dibawah ini:</p><table style="width:100%; border:none; margin: 12px 0 6px;"><tr><td style="width:24%; border:none; padding:4px 6px;"><strong>Nama</strong></td><td style="width:3%; border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">...................................................</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>NIP</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">...................................................</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>Alamat</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">...................................................</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>Jabatan</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">Asesor Kompetensi / Personil Teknis Sertifikasi</td></tr><tr><td style="border:none; padding:4px 6px;"><strong>Nama Perusahaan</strong></td><td style="border:none; padding:4px 2px;">:</td><td style="border:none; padding:4px 6px;">PT PLN (Persero) Unit Pelaksana Sertifikasi</td></tr></table><p style="font-size:8.5pt; font-style:italic; color:#64748B; margin-top:-2px; margin-bottom:12px;">*) Coret yang tidak perlu</p><p style="margin-bottom:10px; line-height:1.6;">Menyatakan dengan sesungguhnya bahwa saya bersedia dan sanggup mengikat diri pada Lembaga Sertifikasi Person/Lembaga Sertifikasi Profesi/Lembaga Sertifikasi Kompetensi USER PLN. Kesediaan tersebut saya buktikan dengan hal-hal sebagai berikut:</p>'
    },
    {
      key: 'pernyataan_komitmen',
      label: '2. 6 Butir Komitmen Kerahasiaan (Termasuk UU PDP)',
      hint: '6 klausul baku kerahasiaan materi uji, data pribadi peserta, dan kepatuhan UU No. 27 Tahun 2022.',
      defaultHtml: '<ol style="padding-left:22px; line-height:1.75; margin-bottom:14px;"><li><strong>Menjaga kerahasiaan informasi dan data yang kami akses;</strong></li><li><strong>Tidak mengungkapkan, memberikan, atau memperdagangkan informasi yang kami terima kepada pihak ketiga tanpa izin tertulis dari pihak yang berwenang atau sesuai dengan ketentuan yang berlaku;</strong></li><li><strong>Akan menggunakan informasi yang diakses hanya untuk tujuan yang ditentukan dalam konteks penugasan yang telah disetujui dan tidak akan menggunakan informasi tersebut untuk kepentingan pribadi atau kepentingan lain yang tidak terkait;</strong></li><li><strong>Bertanggung jawab untuk mengamankan informasi yang kami akses atau tangani, baik secara fisik maupun secara digital. Akan menggunakan langkah-langkah keamanan yang sesuai untuk mencegah akses tidak sah atau kebocoran informasi;</strong></li><li><strong>Apabila dalam pelaksanaan penugasan terdapat kebutuhan untuk mengakses data pribadi, maka pemrosesannya tunduk pada ketentuan kerahasiaan dalam pernyataan ini serta UU No. 27 Tahun 2022 (UU PDP), dan diamankan dari akses atau penyalahgunaan pihak yang tidak berwenang;</strong></li><li><strong>Mengakui bahwa kewajiban untuk menjaga kerahasiaan informasi tidak berakhir setelah berakhirnya penugasan dan akan tetap mematuhi kewajiban kerahasiaan sebagaimana yang diatur dalam regulasi yang berlaku, bahkan setelah tidak lagi terlibat dalam penugasan tersebut.</strong></li></ol>'
    },
    {
      key: 'konsekuensi_penutup',
      label: '3. Konsekuensi Hukum & Tanda Tangan Pembuat',
      hint: 'Pernyataan kesadaran hukum dan tempat/tanggal tanda tangan.',
      defaultHtml: '<p style="margin-bottom:14px; line-height:1.6;">Kami menyadari bahwa pelanggaran terhadap komitmen ini dapat berdampak secara hukum.</p><table style="width:100%; border:none; margin-top:24px;"><tr><td style="width:55%; border:none;"></td><td style="width:45%; border:none; text-align:center;"><p style="margin:0;">Jakarta, ......................... 2026<br>Yang membuat pernyataan,</p><div style="height:60px;"></div><p style="margin:0;"><strong>( .................................................... )</strong></p></td></tr></table>'
    }
  ],

  'Daftar Rekaman Mutu (FR.01.07)': [
    {
      key: 'informasi_bidang',
      label: '1. Bidang Pengelola Rekaman',
      hint: 'Sesuai template FR.UPS.SER3.BMK.01.07: BIDANG : ...',
      defaultHtml: '<p style="font-size:11pt; font-weight:bold; margin-bottom:14px;">BIDANG : Manajemen Mutu & Pelayanan Sertifikasi</p>'
    },
    {
      key: 'tabel_rekaman',
      label: '2. Matriks 7 Kolom Rekaman Mutu Terkendali',
      hint: 'Tabel 7 kolom resmi daftar rekaman mutu terkendali.',
      defaultHtml: '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin:14px 0;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px 10px; text-align:center; font-size:9pt;">Bidang/Bagian Pengelola Rekaman</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Proses Bisnis/Aktivitas</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Arsip/Rekaman/Evidence Hasil Proses Bisnis Aktivitas</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Jenis Arsip/ Rekaman/ Evidence</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Link/Lokasi Tempat Penyimpanan</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Masa Simpan (Tahun)</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Kategori Kerahasiaan Dokumen</th></tr></thead><tbody><tr><td style="padding:8px 10px;">Manajemen Mutu & Sertifikasi</td><td style="padding:8px 10px;">2.3.9 Memelihara Akreditasi LSP/LSK</td><td style="padding:8px 10px;">Berkas Asesmen & Sertifikat Kompetensi</td><td style="padding:8px 10px; text-align:center;">Digital / Hardcopy</td><td style="padding:8px 10px;">Server EDMS UPS / Ruang Arsip Ragunan</td><td style="padding:8px 10px; text-align:center;">3 Tahun</td><td style="padding:8px 10px; text-align:center;">Rahasia</td></tr><tr><td style="padding:8px 10px;">Pengendalian Mutu Terkendali</td><td style="padding:8px 10px;">Pengendalian Informasi Terdokumentasi</td><td style="padding:8px 10px;">Daftar Induk Dokumen Mutu Terkendali</td><td style="padding:8px 10px; text-align:center;">Digital</td><td style="padding:8px 10px;">Aplikasi EDMS PLN UPS</td><td style="padding:8px 10px; text-align:center;">Selama Berlaku</td><td style="padding:8px 10px; text-align:center;">Internal Terbatas</td></tr></tbody></table>'
    },
    {
      key: 'keterangan_retensi',
      label: '3. Ketentuan Retensi & Penutupan',
      hint: 'Aturan pemindahan ke arsip inaktif atau pemusnahan berkala.',
      defaultHtml: '<p style="margin-top:14px; font-size:9pt; color:#475569; line-height:1.6;">Setiap rekaman yang telah mencapai batas masa simpan wajib ditinjau kembali oleh Penanggung Jawab Bidang bersama Tim Manajemen Mutu untuk menentukan kelayakan perpanjangan retensi atau pemusnahan resmi sesuai FR.UPS.SER3.BMK.01.05.</p>'
    }
  ],

  'Daftar Rekaman Mutu': [
    {
      key: 'informasi_bidang',
      label: '1. Bidang Pengelola Rekaman',
      hint: 'Sesuai template FR.UPS.SER3.BMK.01.07: BIDANG : ...',
      defaultHtml: '<p style="font-size:11pt; font-weight:bold; margin-bottom:14px;">BIDANG : Manajemen Mutu & Pelayanan Sertifikasi</p>'
    },
    {
      key: 'tabel_rekaman',
      label: '2. Matriks 7 Kolom Rekaman Mutu Terkendali',
      hint: 'Tabel 7 kolom resmi daftar rekaman mutu terkendali.',
      defaultHtml: '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin:14px 0;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px 10px; text-align:center; font-size:9pt;">Bidang/Bagian Pengelola Rekaman</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Proses Bisnis/Aktivitas</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Arsip/Rekaman/Evidence Hasil Proses Bisnis Aktivitas</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Jenis Arsip/ Rekaman/ Evidence</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Link/Lokasi Tempat Penyimpanan</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Masa Simpan (Tahun)</th><th style="padding:8px 10px; text-align:center; font-size:9pt;">Kategori Kerahasiaan Dokumen</th></tr></thead><tbody><tr><td style="padding:8px 10px;">Manajemen Mutu & Sertifikasi</td><td style="padding:8px 10px;">2.3.9 Memelihara Akreditasi LSP/LSK</td><td style="padding:8px 10px;">Berkas Asesmen & Sertifikat Kompetensi</td><td style="padding:8px 10px; text-align:center;">Digital / Hardcopy</td><td style="padding:8px 10px;">Server EDMS UPS / Ruang Arsip Ragunan</td><td style="padding:8px 10px; text-align:center;">3 Tahun</td><td style="padding:8px 10px; text-align:center;">Rahasia</td></tr><tr><td style="padding:8px 10px;">Pengendalian Mutu Terkendali</td><td style="padding:8px 10px;">Pengendalian Informasi Terdokumentasi</td><td style="padding:8px 10px;">Daftar Induk Dokumen Mutu Terkendali</td><td style="padding:8px 10px; text-align:center;">Digital</td><td style="padding:8px 10px;">Aplikasi EDMS PLN UPS</td><td style="padding:8px 10px; text-align:center;">Selama Berlaku</td><td style="padding:8px 10px; text-align:center;">Internal Terbatas</td></tr></tbody></table>'
    },
    {
      key: 'keterangan_retensi',
      label: '3. Ketentuan Retensi & Penutupan',
      hint: 'Aturan pemindahan ke arsip inaktif atau pemusnahan berkala.',
      defaultHtml: '<p style="margin-top:14px; font-size:9pt; color:#475569; line-height:1.6;">Setiap rekaman yang telah mencapai batas masa simpan wajib ditinjau kembali oleh Penanggung Jawab Bidang bersama Tim Manajemen Mutu untuk menentukan kelayakan perpanjangan retensi atau pemusnahan resmi sesuai FR.UPS.SER3.BMK.01.05.</p>'
    }
  ],

  'Formulir Tambahan': [
    {
      key: 'judul_formulir',
      label: '1. Judul & Nomor Rekaman',
      hint: 'Identitas formulir khusus rekaman mutu tambahan.',
      defaultHtml: '<p><strong>Nama Rekaman:</strong> Formulir Rekaman Mutu Tambahan<br><strong>Kode:</strong> FR.UPS.SER3.BMK.01.XX-00<br><strong>Klasifikasi:</strong> Terkendali / Rahasia</p>'
    },
    {
      key: 'ketentuan_penggunaan',
      label: '2. Ketentuan & Regulasi Acuan',
      hint: 'Dasar aturan penggunaan formulir ini.',
      defaultHtml: '<p>Mengacu pada Prosedur Pengendalian Informasi Terdokumentasi (PR.UPS.SER3.BMK.01-02), Keputusan Direksi tentang Retensi Arsip, serta ketentuan kerahasiaan data.</p>'
    },
    {
      key: 'isian_formulir',
      label: '3. Format Isian / Matriks Bukti Rekaman',
      hint: 'Bentuk matriks atau pernyataan resmi rekaman mutu.',
      defaultHtml: '<table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th>No</th><th>Uraian Rekaman</th><th>Tanggal Pelaksanaan</th><th>Pelaksana / Penanggung Jawab</th><th>Status / Catatan</th></tr></thead><tbody><tr><td>1</td><td>Rekaman Mutu Terkendali</td><td>2026-09-17</td><td>Petugas Mutu</td><td>Arsip Terverifikasi</td></tr></tbody></table>'
    }
  ]
};

// Helper untuk mengambil judul seksi yang ramah dibaca
export function getSectionLabel(key: string, docType?: string): string {
  if (docType && DOCUMENT_SECTIONS[docType as DocumentType]) {
    const found = DOCUMENT_SECTIONS[docType as DocumentType].find(s => s.key === key);
    if (found) return found.label;
  }

  // Fallback map umum
  const globalLabels: Record<string, string> = {
    tujuan: '1. Tujuan',
    ruang_lingkup: '2. Ruang Lingkup',
    referensi: '3. Referensi',
    proses_bisnis: '4. Proses Bisnis',
    istilah_definisi: '5. Istilah dan Definisi',
    alur_prosedur: '6. Alur Prosedur',
    dokumen_pendukung: '7. Dokumen Pendukung',
    dokumen_referensi: '3. Dokumen Referensi',
    personil: '4. Personil',
    peralatan_kerja: '5. Peralatan Kerja',
    perlengkapan_k3: '6. Perlengkapan K3',
    material: '7. Material',
    uraian_kegiatan: '8. Uraian Kegiatan',
    profil_organisasi: '1. Profil Organisasi & Ruang Lingkup',
    kebijakan_mutu: '2. Kebijakan Mutu & Sasaran',
    struktur_organisasi: '3. Struktur Organisasi',
    sistem_manajemen_terintegrasi: '4. Sistem Manajemen Terintegrasi',
    lampiran_referensi: '5. Lampiran & Dokumen Terkait',
    judul_formulir: '1. Judul & Identitas Formulir',
    petunjuk_pengisian: '2. Petunjuk Pengisian',
    isian_formulir: '3. Format Isian / Matriks Formulir',
    ketentuan_penggunaan: '2. Ketentuan & Regulasi Acuan',
    identitas_ba: '1. Identitas Berita Acara & Waktu Pelaksanaan',
    daftar_rekaman: '2. Daftar Rekaman Mutu yang Dimusnahkan',
    penutup_pengesahan: '3. Penutup & Tanda Tangan Manager',
    identitas_pihak: '1. Identitas Penandatangan',
    pernyataan_komitmen: '2. Pernyataan Komitmen Kerahasiaan',
    konsekuensi_penutup: '3. Konsekuensi Hukum & Penutup',
    informasi_bidang: '1. Bidang / Bagian Pengelola Rekaman',
    tabel_rekaman: '2. Matriks Daftar Rekaman Mutu Terkendali',
    keterangan_retensi: '3. Ketentuan Masa Retensi & Pengarsipan',
    definisi: 'Istilah dan Definisi',
    prosedur: 'Alur Prosedur',
    lampiran: 'Dokumen Pendukung / Lampiran',
  };

  return globalLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Helper untuk mengambil default sections object untuk jenis dokumen
export function getDefaultSectionsForType(type: string): Record<string, string> {
  const dt = (DOCUMENT_SECTIONS[type as DocumentType] ? type : 'SOP/Prosedur') as DocumentType;
  const defs = DOCUMENT_SECTIONS[dt] || [];
  const result: Record<string, string> = {};
  for (const s of defs) {
    result[s.key] = s.defaultHtml || '<p>— Belum diisi —</p>';
  }
  return result;
}

export interface DocumentSectionConfig {
  key: string;
  title: string;
  isCustom?: boolean;
}

// Bersihkan nomor prefix hardcoded (misal "1. Tujuan" -> "Tujuan")
export function cleanSectionTitle(label: string): string {
  if (!label) return '';
  return label.replace(/^\d+\.\s*/, '').trim();
}

// Menghasilkan daftar seksi terurut untuk suatu dokumen
export function getOrderedSections(docType: string, sections?: Record<string, string>): DocumentSectionConfig[] {
  // 1. Cek apakah ada metadata _section_order yang tersimpan
  if (sections?._section_order) {
    try {
      const parsed = JSON.parse(sections._section_order);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          key: item.key,
          title: cleanSectionTitle(item.title || getSectionLabel(item.key, docType)),
          isCustom: item.isCustom ?? (item.key.startsWith('sec_') || item.key.startsWith('custom_')),
        }));
      }
    } catch (e) {
      console.error('Error parsing _section_order:', e);
    }
  }

  // 2. Default dari template baku jenis dokumen
  const dt = (DOCUMENT_SECTIONS[docType as DocumentType] ? docType : 'SOP/Prosedur') as DocumentType;
  const defs = DOCUMENT_SECTIONS[dt] || DOCUMENT_SECTIONS['SOP/Prosedur'];
  const result: DocumentSectionConfig[] = defs.map(s => ({
    key: s.key,
    title: cleanSectionTitle(s.label),
    isCustom: false,
  }));

  // 3. Sertakan seksi ekstra jika ada di dalam sections tapi belum ada di template
  if (sections) {
    const knownKeys = new Set(result.map(r => r.key));
    Object.keys(sections).forEach(k => {
      if (!knownKeys.has(k) && k !== 'riwayat_perubahan' && k !== '_section_order') {
        result.push({
          key: k,
          title: cleanSectionTitle(getSectionLabel(k, docType)),
          isCustom: true,
        });
      }
    });
  }

  return result;
}

// Format label berpenomoran dinamis (misal "1. Tujuan", "2. Ruang Lingkup")
export function getDisplaySectionLabel(config: DocumentSectionConfig, index: number, docType?: string): string {
  const clean = cleanSectionTitle(config.title);
  return `${index + 1}. ${clean}`;
}


// Helper untuk mengecek apakah dokumen merupakan varian Formulir Mutu Level 4
export function isFormulirType(jenis?: string): boolean {
  if (!jenis) return false;
  const j = jenis.toLowerCase();
  return (
    j.includes('formulir') ||
    j.includes('rekaman') ||
    j.includes('kerahasiaan') ||
    j.includes('pemusnahan') ||
    j.includes('berita acara')
  );
}

export const FORMULIR_OFFICIAL_HEADERS: Record<string, { title: string; formNo: string }> = {
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
  'Formulir Kerja': {
    title: 'FORMULIR REKAMAN MUTU STANDAR',
    formNo: 'FR.UPS.SER3.BMK.01.04-00'
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
  'Formulir Tambahan': {
    title: 'FORMULIR REKAMAN MUTU TAMBAHAN',
    formNo: 'FR.UPS.SER3.BMK.01.XX-00'
  }
};

