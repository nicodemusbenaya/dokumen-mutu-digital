import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const prSectionsPath = path.resolve('C:/Users/Nicodemus/.gemini/antigravity-ide/brain/3262de38-3c19-4293-97b9-8545de8c9d2d/scratch/procedure_sections.json');
const prSections = JSON.parse(fs.readFileSync(prSectionsPath, 'utf8'));

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: '12345678',
  database: 'edms_ups',
  multipleStatements: true
});

async function main() {
  console.log('Clearing old tables and seeding fresh official data...');
  
  await pool.query('DELETE FROM document_references');
  await pool.query('DELETE FROM document_sections');
  await pool.query('DELETE FROM approvals');
  await pool.query('DELETE FROM audit_logs');
  await pool.query('DELETE FROM document_versions');
  await pool.query('DELETE FROM documents');
  await pool.query('DELETE FROM `references`');

  const [[adminUser]] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
  const [[fakhriUser]] = await pool.query('SELECT id FROM users WHERE username = ?', ['fakhri']);
  const [[rikoUser]] = await pool.query('SELECT id FROM users WHERE username = ?', ['riko']);
  const [[budiUser]] = await pool.query('SELECT id FROM users WHERE username = ?', ['budi']);

  const refs = [
    ['Standar', 'SNI ISO 9001:2015', 'Sistem Manajemen Mutu — Persyaratan', 'Standar Sistem Manajemen Mutu berbasis risiko dan peluang', adminUser.id],
    ['Standar', 'SNI ISO/IEC 17024:2012', 'Penilaian Kesesuaian — Persyaratan Umum Lembaga Sertifikasi Personel', 'Persyaratan umum akreditasi KAN/BNSP untuk Lembaga Sertifikasi Person', adminUser.id],
    ['Regulasi', 'Pedoman BNSP No. 201 Tahun 2014', 'Pedoman Persyaratan Umum Lembaga Sertifikasi Profesi', 'Pedoman lisensi BNSP klausul 10.3 dan 10.4', adminUser.id],
    ['Regulasi', 'Metodologi Sertifikasi Kompetensi Ketenagalistrikan (MSKK)', 'Standar Operasional Sertifikasi Ketenagalistrikan DJK ESDM', 'Regulasi Ditjen Ketenagalistrikan Kementerian ESDM', adminUser.id],
    ['Internal', 'Peraturan Pelaksana PT PLN No. 0051.E/DIR/2024', 'Standar Prosedur Pengelolaan Informasi Terdokumentasi SMT PT PLN (Persero)', 'Pedoman korporat pengelolaan dokumen', adminUser.id],
    ['Internal', 'Petunjuk Teknis PT PLN No. 0031.PTs/DIR TNK/2025', 'Penyusunan Dokumen Sistem Manajemen Terintegrasi PT PLN (Persero)', 'Format penomoran dan kodifikasi pohon bisnis PLN', adminUser.id],
    ['Internal', 'Keputusan Direksi PT PLN No. 0122.K-DIR-2024', 'Jadwal Retensi Arsip PT PLN (Persero)', 'Ketentuan retensi dokumen dan masa simpan arsip', adminUser.id],
    ['Internal', 'MAN.MUTU.UPS.2025.00', 'Dokumen Mutu Sistem Manajemen Terintegrasi PLN UPS', 'Manual mutu induk unit pelaksana sertifikasi', adminUser.id],
  ];

  for (const r of refs) {
    await pool.query(
      'INSERT INTO `references` (kategori, nomor, judul, deskripsi, created_by) VALUES (?, ?, ?, ?, ?)',
      r
    );
  }

  const [refRows] = await pool.query('SELECT id, nomor FROM `references`');
  const refMap = {};
  for (const row of refRows) {
    refMap[row.nomor] = row.id;
  }

  const docs = [
    {
      kode: 'PR.UPS.SER3.BMK.01-02',
      judul: 'Prosedur Informasi Terdokumentasi',
      bidang: 'Manajemen Mutu',
      jenis: 'SOP/Prosedur',
      siklus_review: '2 tahun',
      status: 'Aktif',
      current_version: '2.0',
      version_number: 2,
      penyusun_id: fakhriUser.id,
      audit_ref: 'ISO/IEC 17024:2012 Klausul 10.7',
      ack_total: 24,
      ack_done: 22,
      refs: ['SNI ISO 9001:2015', 'SNI ISO/IEC 17024:2012', 'Pedoman BNSP No. 201 Tahun 2014', 'Petunjuk Teknis PT PLN No. 0031.PTs/DIR TNK/2025'],
      sections: prSections
    },
    {
      kode: 'MAN.MUTU.UPS.2025.00',
      judul: 'Dokumen Mutu Sistem Manajemen Terintegrasi',
      bidang: 'Manajemen Mutu',
      jenis: 'Manual Mutu',
      siklus_review: '2 tahun',
      status: 'Aktif',
      current_version: '2.1',
      version_number: 5,
      penyusun_id: fakhriUser.id,
      audit_ref: 'Sistem Manajemen Mutu Terintegrasi',
      ack_total: 24,
      ack_done: 24,
      refs: ['SNI ISO 9001:2015', 'SNI ISO/IEC 17024:2012'],
      sections: {
        profil_organisasi: '<p>PT PLN (Persero) Unit Pelaksana Sertifikasi (UPS) menerapkan Sistem Manajemen Terintegrasi berbasis ISO 9001, ISO/IEC 17024, ISO/IEC 17020, dan regulasi ESDM.</p>',
        kebijakan_mutu: '<p>Memberikan layanan sertifikasi kompetensi yang independen, transparan, objektif, dan berorientasi pada keselamatan ketenagalistrikan nasional.</p>',
        struktur_organisasi: '<p>Struktur organisasi dipimpin oleh Senior Manager didukung Manager Bidang Mutu & Kinerja, Manager Sertifikasi, dan Manager Pengembangan Materi.</p>',
        sistem_manajemen_terintegrasi: '<p>Menguraikan pemenuhan klausul standar SMM, manajemen risiko, ketidakberpihakan, dan kerahasiaan data.</p>',
        lampiran_referensi: '<p>Matriks korelasi standar ISO 9001, ISO 17024, dan daftar SOP Level 2 terkendali.</p>'
      }
    },
    {
      kode: 'PR.UPS.PBR3.BST.02-01',
      judul: 'Prosedur Pelaksanaan Asesmen Sertifikasi Kompetensi',
      bidang: 'Pelayanan Sertifikasi',
      jenis: 'SOP/Prosedur',
      siklus_review: '2 tahun',
      status: 'Aktif',
      current_version: '1.2',
      version_number: 3,
      penyusun_id: fakhriUser.id,
      audit_ref: 'MSKK DJK ESDM',
      ack_total: 18,
      ack_done: 16,
      refs: ['SNI ISO/IEC 17024:2012', 'Metodologi Sertifikasi Kompetensi Ketenagalistrikan (MSKK)'],
      sections: {
        tujuan: '<p>Memberikan pedoman pelaksanaan asesmen kompetensi yang objektif, transparan, dan tertelusur.</p>',
        ruang_lingkup: '<p>Mencakup uji kompetensi tulis, lisan, praktik, dan observasi lapangan oleh Asesor Bersertifikat.</p>',
        referensi: '<ul><li>SNI ISO/IEC 17024:2012</li><li>Metodologi Sertifikasi Kompetensi Ketenagalistrikan (MSKK)</li></ul>',
        proses_bisnis: '<p><strong>2.3.9</strong> Pelayanan Sertifikasi Tenaga Teknik Ketenagalistrikan.</p>',
        istilah_definisi: '<p>Asesi, Asesor, Tempat Uji Kompetensi (TUK), Rekomendasi Asesmen.</p>',
        alur_prosedur: '<ol><li>Pra-Asesmen dan verifikasi kelengkapan berkas portofolio asesi.</li><li>Pelaksanaan asesmen kompetensi sesuai skema uji DJK/BNSP.</li><li>Rapat pleno keputusan asesmen oleh komite sertifikasi.</li><li>Penerbitan sertifikat kompetensi bagi peserta yang kompeten.</li></ol>',
        dokumen_pendukung: '<ul><li>FR.UPS.SER3.BMK.01.04-00 Formulir Verifikasi TUK</li><li>Checklist Asesmen Mandiri</li></ul>'
      }
    },
    {
      kode: 'PR.UPS.SER3.BMK.03-01',
      judul: 'Prosedur Penanganan Temuan Audit Internal & Eksternal',
      bidang: 'Manajemen Mutu',
      jenis: 'SOP/Prosedur',
      siklus_review: '2 tahun',
      status: 'Menunggu Approval',
      current_version: '3.0',
      version_number: 3,
      penyusun_id: fakhriUser.id,
      audit_ref: 'AF-2026-014 (BNSP)',
      ack_total: 24,
      ack_done: 18,
      refs: ['SNI ISO 9001:2015'],
      sections: {
        tujuan: '<p>Memastikan tindakan perbaikan atas temuan ketidaksesuaian audit ditindaklanjuti secara tuntas dan efektif.</p>',
        ruang_lingkup: '<p>Berlaku untuk seluruh temuan audit internal SMT, audit survailen KAN, dan survailen BNSP.</p>',
        referensi: '<ul><li>SNI ISO 9001:2015 Klausul 9.2 (Audit Internal) dan Klausul 10.2 (Ketidaksesuaian)</li></ul>',
        proses_bisnis: '<p><strong>2.3.9</strong> Manajemen Ketidaksesuaian dan Peningkatan Berkelanjutan.</p>',
        istilah_definisi: '<p>Tindakan Korektif (Corrective Action), Root Cause Analysis (RCA).</p>',
        alur_prosedur: '<ol><li>Penerbitan formulir Permintaan Tindakan Perbaikan (PTP).</li><li>Auditee melakukan investigasi akar masalah menggunakan metode 5-Why.</li><li>Penyusunan rencana aksi dan batas waktu perbaikan.</li><li>Verifikasi efektivitas tindakan perbaikan oleh Lead Auditor.</li></ol>',
        dokumen_pendukung: '<ul><li>Formulir PTP</li><li>Laporan Hasil Audit Internal</li></ul>'
      }
    },
    {
      kode: 'IK.UPS.SER3.BMK.01.01-00',
      judul: 'Instruksi Kerja Pengunggahan dan Distribusi Dokumen Mutu Digital',
      bidang: 'Manajemen Mutu',
      jenis: 'Instruksi Kerja',
      siklus_review: '1 tahun',
      status: 'Aktif',
      current_version: '1.0',
      version_number: 1,
      penyusun_id: fakhriUser.id,
      audit_ref: 'EDMS System',
      ack_total: 24,
      ack_done: 24,
      refs: ['Peraturan Pelaksana PT PLN No. 0051.E/DIR/2024'],
      sections: {
        tujuan: '<p>Memberikan instruksi teknis pengunggahan, verifikasi seksi, dan penerbitan dokumen resmi Controlled Copy di EDMS.</p>',
        ruang_lingkup: '<p>Digunakan oleh Pengelola Proses Bisnis dan Admin EDMS PLN UP Sertifikasi.</p>',
        dokumen_referensi: '<ul><li>PR.UPS.SER3.BMK.01-02 Prosedur Informasi Terdokumentasi</li></ul>',
        personil: '<p>Staf Bidang / Penyusun Dokumen, Tim Mutu, dan Administrator EDMS.</p>',
        peralatan_kerja: '<ul><li>PC/Laptop terhubung intranet PLN</li><li>Aplikasi EDMS PLN UP Sertifikasi</li></ul>',
        perlengkapan_k3: '<p>Penerapan ergonomi komputer dan pencahayaan kerja yang memadai.</p>',
        material: '<p>Draft dokumen terstruktur dan referensi regulasi terkait.</p>',
        uraian_kegiatan: '<ol><li>Buka menu Editor Dokumen dan pilih jenis dokumen baku yang sesuai.</li><li>Isi metadata (Kode, Judul, Bidang, Siklus Review) dan seksi-seksi baku.</li><li>Klik tombol Simpan dan ajukan ke Tim Mutu untuk peninjauan.</li><li>Setelah disahkan oleh SM UPS, unduh salinan resmi ber-watermark Controlled Copy.</li></ol>'
      }
    },
    {
      kode: 'FR.UPS.SER3.BMK.01.04-00',
      judul: 'Formulir Verifikasi Kelayakan Tempat Uji Kompetensi (TUK)',
      bidang: 'Pelayanan Sertifikasi',
      jenis: 'Formulir Kerja',
      siklus_review: '1 tahun',
      status: 'Draft',
      current_version: '1.0',
      version_number: 1,
      penyusun_id: fakhriUser.id,
      audit_ref: null,
      ack_total: 0,
      ack_done: 0,
      refs: ['SNI ISO/IEC 17024:2012'],
      sections: {
        judul_formulir: '<p><strong>Nama Formulir:</strong> Formulir Verifikasi Kelayakan TUK<br><strong>Kode:</strong> FR.UPS.SER3.BMK.01.04-00<br><strong>Bidang:</strong> Pelayanan Sertifikasi</p>',
        petunjuk_pengisian: '<p>Verifikasi seluruh fasilitas peralatan, K3, dan pencahayaan sebelum kegiatan asesmen dimulai.</p>',
        isian_formulir: '<table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th>No</th><th>Sarana & Prasarana TUK</th><th>Standar Minimum</th><th>Hasil Observasi</th><th>Keterangan</th></tr></thead><tbody><tr><td>1</td><td>Ruang Uji Teori / Komputer</td><td>Kapasitas 20 peserta, AC, Proyektor</td><td>Memenuhi</td><td>Baik</td></tr><tr><td>2</td><td>Peralatan Praktik / Simulator</td><td>Sesuai Skema Sertifikasi DJK</td><td>Memenuhi</td><td>Terkalibrasi</td></tr><tr><td>3</td><td>P3K & APAR</td><td>APAR aktif, Kotak P3K standar</td><td>Memenuhi</td><td>Siap pakai</td></tr></tbody></table>'
      }
    },
    {
      kode: 'FR.UPS.SER3.BMK.01.05-00',
      judul: 'Berita Acara Pemusnahan Rekaman Mutu',
      bidang: 'Manajemen Mutu',
      jenis: 'Formulir Tambahan',
      siklus_review: '3 tahun',
      status: 'Aktif',
      current_version: '1.0',
      version_number: 1,
      penyusun_id: fakhriUser.id,
      audit_ref: 'Retensi Arsip ISO',
      ack_total: 15,
      ack_done: 15,
      refs: ['Keputusan Direksi PT PLN No. 0122.K-DIR-2024'],
      sections: {
        judul_formulir: '<p><strong>BERITA ACARA PEMUSNAHAN REKAMAN MUTU</strong><br><strong>Nomor:</strong> BA.001/MUTU/UPS/2026</p>',
        ketentuan_penggunaan: '<p>Pemusnahan rekaman mutu dilakukan apabila masa retensi telah melampaui 3 (tiga) tahun sesuai klausul 7.6 Prosedur PR.UPS.SER3.BMK.01-02 dan Jadwal Retensi Arsip PLN.</p>',
        isian_formulir: '<table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th>No</th><th>Akreditor / Pemberi Lisensi</th><th>Uraian Rekaman Yang Dimusnahkan</th><th>Tahun Penerbitan</th><th>Metode Pemusnahan</th></tr></thead><tbody><tr><td>1</td><td>BNSP</td><td>Berkas Asesmen Peserta Sertifikasi 2021-2022</td><td>2022</td><td>Pencacahan Fisik & Penghapusan Permanen</td></tr><tr><td>2</td><td>KAN</td><td>Log Sheet Kalibrasi Alat Uji Lapangan 2022</td><td>2022</td><td>Pencacahan Dokumen</td></tr></tbody></table>'
      }
    },
    {
      kode: 'FR.UPS.SER3.BMK.01.06-00',
      judul: 'Formulir Pernyataan Kerahasiaan Personil & Asesor',
      bidang: 'Manajemen Mutu',
      jenis: 'Formulir Tambahan',
      siklus_review: '1 tahun',
      status: 'Aktif',
      current_version: '1.0',
      version_number: 1,
      penyusun_id: fakhriUser.id,
      audit_ref: 'UU PDP & ISO 17024',
      ack_total: 24,
      ack_done: 24,
      refs: ['SNI ISO/IEC 17024:2012'],
      sections: {
        judul_formulir: '<p><strong>SURAT PERNYATAAN KERAHASIAAN INFORMASI & DATA PRIBADI</strong><br><strong>Kode:</strong> FR.UPS.SER3.BMK.01.06-00</p>',
        ketentuan_penggunaan: '<p>Wajib ditandatangani oleh seluruh personil, asesor, penguji, dan auditor yang memiliki akses terhadap dokumen rahasia, materi uji, dan data pribadi asesi sesuai UU No. 27 Tahun 2022 (UU PDP).</p>',
        isian_formulir: '<p>Menyatakan dengan sesungguhnya bersedia menjaga kerahasiaan:</p><ol><li>Tidak mengungkapkan atau memperdagangkan informasi kepada pihak ketiga tanpa izin resmi tertulis;</li><li>Menggunakan data hanya untuk kepentingan penugasan sertifikasi resmi;</li><li>Mengamankan berkas secara fisik maupun digital dari kebocoran;</li><li>Kewajiban kerahasiaan tetap mengikat meskipun penugasan telah selesai.</li></ol>'
      }
    },
    {
      kode: 'FR.UPS.SER3.BMK.01.07-00',
      judul: 'Daftar Rekaman Mutu Terkendali',
      bidang: 'Manajemen Mutu',
      jenis: 'Formulir Tambahan',
      siklus_review: '1 tahun',
      status: 'Aktif',
      current_version: '1.0',
      version_number: 1,
      penyusun_id: fakhriUser.id,
      audit_ref: 'Inventaris Rekaman SMT',
      ack_total: 24,
      ack_done: 24,
      refs: ['Petunjuk Teknis PT PLN No. 0031.PTs/DIR TNK/2025'],
      sections: {
        judul_formulir: '<p><strong>MATRIKS DAFTAR REKAMAN MUTU TERKENDALI</strong><br><strong>Kode:</strong> FR.UPS.SER3.BMK.01.07-00<br><strong>Bidang:</strong> Pengendalian Mutu & Kinerja</p>',
        ketentuan_penggunaan: '<p>Menginventarisasi seluruh bukti aktivitas proses bisnis, lokasi penyimpanan berkas, masa simpan, serta tingkat klasifikasi kerahasiaan.</p>',
        isian_formulir: '<table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th>Bidang Pengelola</th><th>Aktivitas / Proses Bisnis</th><th>Jenis Rekaman / Evidence</th><th>Lokasi Penyimpanan</th><th>Masa Simpan</th><th>Kategori Kerahasiaan</th></tr></thead><tbody><tr><td>Manajemen Mutu</td><td>Pengendalian Informasi Terdokumentasi</td><td>Dokumen Master & SK Pengesahan</td><td>Server EDMS / NAS QNAP</td><td>5 Tahun</td><td>Terkendali Internal</td></tr><tr><td>Pelayanan Sertifikasi</td><td>Pelaksanaan Asesmen Kompetensi</td><td>Formulir Rekaman Asesmen & Uji</td><td>Server EDMS & Ruang Arsip TUK</td><td>3 Tahun</td><td>Rahasia</td></tr><tr><td>Pengembangan Materi</td><td>Penyusunan Materi Uji Kompetensi (MUK)</td><td>Bank Soal & Skema Sertifikasi</td><td>Server Terenkripsi EDMS</td><td>5 Tahun</td><td>Sangat Rahasia</td></tr></tbody></table>'
      }
    }
  ];

  for (const doc of docs) {
    const [res] = await pool.query(
      `INSERT INTO documents (
        kode, judul, bidang, jenis, siklus_review, status,
        current_version, version_number, penyusun_id, audit_ref, ack_total, ack_done
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doc.kode, doc.judul, doc.bidang, doc.jenis, doc.siklus_review, doc.status,
        doc.current_version, doc.version_number, doc.penyusun_id, doc.audit_ref, doc.ack_total, doc.ack_done
      ]
    );
    const docId = res.insertId;

    // Sections
    for (const [secKey, secHtml] of Object.entries(doc.sections)) {
      await pool.query(
        'INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)',
        [docId, secKey, secHtml]
      );
    }

    // Refs
    for (const refNo of doc.refs) {
      if (refMap[refNo]) {
        await pool.query(
          'INSERT INTO document_references (document_id, reference_id) VALUES (?, ?)',
          [docId, refMap[refNo]]
        );
      }
    }

    // Approvals
    if (doc.status === 'Aktif') {
      await pool.query(
        `INSERT INTO approvals (document_id, stage, action, actor_id, note, doc_version, created_at)
         VALUES (?, 2, 'Approve', ?, 'Disetujui oleh Manager Bidang.', ?, DATE_SUB(NOW(), INTERVAL 5 DAY))`,
        [docId, rikoUser.id, doc.current_version]
      );
      await pool.query(
        `INSERT INTO approvals (document_id, stage, action, actor_id, note, doc_version, created_at)
         VALUES (?, 3, 'Approve', ?, 'Disahkan oleh Senior Manager UPS.', ?, DATE_SUB(NOW(), INTERVAL 4 DAY))`,
        [docId, budiUser.id, doc.current_version]
      );
    }
  }

  console.log(`Successfully seeded ${docs.length} official documents!`);
  await pool.end();
}

main().catch(err => {
  console.error('Error seeding real docs:', err);
  process.exit(1);
});
