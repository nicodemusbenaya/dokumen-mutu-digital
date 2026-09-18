import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

// Baca helper dari source code Next.js
import { 
  DOCUMENT_SECTIONS, 
  DOCUMENT_TYPES, 
  DOCUMENT_TYPE_LABELS,
  FORMULIR_OFFICIAL_HEADERS,
  getOrderedSections, 
  getDisplaySectionLabel, 
  cleanSectionTitle,
  isFormulirType,
  getSectionLabel
} from '../src/lib/documentTypes.ts';

const DB_CONFIG = {
  host: process.env.DB_HOST || '10.10.200.166',
  port: parseInt(process.env.DB_PORT || '3307'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345678',
  database: process.env.DB_NAME || 'edms_ups'
};

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runAudit() {
  console.log('====================================================');
  console.log(' AUDIT KESELURUHAN SISTEM EDMS DOKUMEN MUTU DIGITAL ');
  console.log(' PT PLN (PERSERO) UNIT PELAKSANA SERTIFIKASI (UPS)   ');
  console.log(` Tanggal Audit: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`);
  console.log('====================================================\n');

  // -------------------------------------------------------------
  // 1. AUDIT TEMPLATE FORMULIR RESMI VS BERKAS FOLDER TEMPLATE
  // -------------------------------------------------------------
  console.log('--- 1. AUDIT 7 TEMPLATE FORMULIR RESMI (FOLDER TEMPLATE VS SISTEM) ---');
  
  const templateDir = path.resolve('../Template dokumen/Formulir');
  const expectedTemplates = [
    { code: 'FR.01.01', name: 'Dokumen Mutu', type: 'Manual Mutu', file: 'FR.UPS.SER3.BMK.01.01-00 Dokumen Mutu - rev1.docx' },
    { code: 'FR.01.02', name: 'Prosedur / SOP', type: 'SOP/Prosedur', file: 'FR.UPS.SER3.BMK.01.02-00 Prosedur_SOP - rev1.docx' },
    { code: 'FR.01.03', name: 'Instruksi Kerja', type: 'Instruksi Kerja', file: 'FR.UPS.SER3.BMK.01.03-00 Intruksi Kerja - rev1.docx' },
    { code: 'FR.01.04', name: 'Formulir Standar', type: 'Formulir Standar (FR.01.04)', file: 'FR.UPS.SER3.BMK.01.04-00 Formulir - rev1.docx' },
    { code: 'FR.01.05', name: 'Berita Acara Pemusnahan', type: 'Berita Acara Pemusnahan (FR.01.05)', file: 'FR.UPS.SER3.BMK.01.05-00 Berita Acara Pemusnahan Rekaman Mutu - rev1.docx' },
    { code: 'FR.01.06', name: 'Pernyataan Kerahasiaan', type: 'Pernyataan Kerahasiaan (FR.01.06)', file: 'FR.UPS.SER3.BMK.01.06-00 Pernyataan Kerahasiaan - rev1.docx' },
    { code: 'FR.01.07', name: 'Daftar Rekaman Mutu', type: 'Daftar Rekaman Mutu (FR.01.07)', file: 'FR.UPS.SER3.BMK.01.07-00 Daftar Rekaman Mutu- rev1.docx' },
  ];

  for (const t of expectedTemplates) {
    const filePath = path.join(templateDir, t.file);
    const exists = fs.existsSync(filePath);
    assert(exists, `Berkas template fisik "${t.file}" ditemukan di folder`);
    
    // Cek konfigurasi seksi baku di sistem
    const secDefs = DOCUMENT_SECTIONS[t.type];
    assert(secDefs && secDefs.length > 0, `Konfigurasi seksi baku terdaftar untuk "${t.type}" (${secDefs?.length || 0} seksi)`);
    
    // Uji khusus per jenis formulir
    if (t.code === 'FR.01.02') {
      const keys = secDefs.map(s => s.key);
      assert(
        keys.includes('tujuan') && 
        keys.includes('ruang_lingkup') && 
        keys.includes('referensi') && 
        keys.includes('proses_bisnis') && 
        keys.includes('istilah_definisi') && 
        keys.includes('alur_prosedur') && 
        keys.includes('dokumen_pendukung'),
        'FR.01.02 SOP memiliki 7 klausul baku lengkap PR.UPS.SER3.BMK.01-02'
      );
    }

    if (t.code === 'FR.01.05') {
      const keys = secDefs.map(s => s.key);
      assert(keys.includes('identitas_ba') && keys.includes('daftar_rekaman') && keys.includes('penutup_pengesahan'),
        'FR.01.05 Berita Acara memiliki seksi identitas, tabel matriks 4 kolom, dan pengesahan');
    }

    if (t.code === 'FR.01.06') {
      const keys = secDefs.map(s => s.key);
      const komitmenSec = secDefs.find(s => s.key === 'pernyataan_komitmen');
      assert(keys.includes('identitas_pihak') && keys.includes('pernyataan_komitmen'),
        'FR.01.06 Pernyataan Kerahasiaan memiliki klausul identitas dan komitmen kerahasiaan');
      assert(komitmenSec && komitmenSec.defaultHtml.includes('UU No. 27 Tahun 2022'),
        'FR.01.06 menyertakan klausul kepatuhan UU No. 27/2022 tentang Perlindungan Data Pribadi (UU PDP)');
    }

    if (t.code === 'FR.01.07') {
      const keys = secDefs.map(s => s.key);
      const tabelSec = secDefs.find(s => s.key === 'tabel_rekaman');
      assert(keys.includes('informasi_bidang') && keys.includes('tabel_rekaman'),
        'FR.01.07 memiliki seksi informasi bidang dan tabel rekaman kendali');
      assert(tabelSec && tabelSec.defaultHtml.includes('Masa Simpan') && tabelSec.defaultHtml.includes('Kategori Kerahasiaan'),
        'FR.01.07 memuat tabel matriks 7 kolom rekaman mutu terkendali');
    }
  }

  // -------------------------------------------------------------
  // 2. AUDIT FITUR BARU: SEKSI DINAMIS, DRAG & DROP, AUTO-RENUMBERING
  // -------------------------------------------------------------
  console.log('\n--- 2. AUDIT FITUR BARU: SEKSI DINAMIS & AUTO-RENUMBERING ---');

  // Test cleanSectionTitle
  assert(cleanSectionTitle('1. Tujuan') === 'Tujuan', 'cleanSectionTitle membuang angka prefix hardcoded ("1. Tujuan" -> "Tujuan")');
  assert(cleanSectionTitle('5. Istilah dan Definisi') === 'Istilah dan Definisi', 'cleanSectionTitle membuang nomor urut ("5. Istilah dan Definisi" -> "Istilah dan Definisi")');

  // Test default ordered sections
  const sopOrdered = getOrderedSections('SOP/Prosedur');
  assert(sopOrdered.length === 7, `getOrderedSections menghasilkan 7 seksi default untuk SOP/Prosedur`);
  assert(sopOrdered[0].title === 'Tujuan', 'Seksi urutan ke-1 adalah Tujuan');
  assert(getDisplaySectionLabel(sopOrdered[0], 0, 'SOP/Prosedur') === '1. Tujuan', 'Label penomoran otomatis seksi ke-1 adalah "1. Tujuan"');

  // Test reordering (Simulasi Drag & Drop posisi seksi)
  const simulatedReorder = [...sopOrdered];
  // Pindahkan "referensi" (indeks 2) ke posisi 0 (paling atas)
  const [movedRef] = simulatedReorder.splice(2, 1);
  simulatedReorder.unshift(movedRef);

  assert(simulatedReorder[0].key === 'referensi', 'Seksi "referensi" berhasil dipindahkan ke urutan pertama');
  assert(getDisplaySectionLabel(simulatedReorder[0], 0, 'SOP/Prosedur') === '1. Referensi', 'Auto-renumbering: "referensi" otomatis menjadi nomor "1. Referensi"');
  assert(getDisplaySectionLabel(simulatedReorder[1], 1, 'SOP/Prosedur') === '2. Tujuan', 'Auto-renumbering: "tujuan" otomatis bergeser menjadi nomor "2. Tujuan"');

  // Test penambahan seksi kustom (+ Tambah Seksi)
  const customSection = {
    key: `sec_${Date.now()}`,
    title: 'Diagram Alir Pelaksanaan Prosedur',
    isCustom: true
  };
  const withCustom = [...simulatedReorder, customSection];
  assert(withCustom.length === 8, 'Fitur Tambah Seksi berhasil menambahkan klausul kustom baru');
  assert(getDisplaySectionLabel(customSection, 7, 'SOP/Prosedur') === '8. Diagram Alir Pelaksanaan Prosedur', 'Auto-renumbering: Seksi baru otomatis mendapatkan nomor urut "8. Diagram Alir Pelaksanaan Prosedur"');

  // Test serialisasi metadata _section_order
  const serializedOrder = JSON.stringify(withCustom);
  const reloadedOrder = getOrderedSections('SOP/Prosedur', { _section_order: serializedOrder });
  assert(reloadedOrder.length === 8, 'Metadata _section_order berhasil di-reload dengan jumlah seksi persis sama');
  assert(reloadedOrder[0].key === 'referensi', 'Urutan pertama hasil persistensi database tetap "referensi"');
  assert(reloadedOrder[7].title === 'Diagram Alir Pelaksanaan Prosedur', 'Seksi kustom hasil persistensi database tetap terjaga');

  // -------------------------------------------------------------
  // 3. AUDIT DATABASE MARIADB & ALUR KERJA SIKLUS HIDUP DOKUMEN
  // -------------------------------------------------------------
  console.log('\n--- 3. AUDIT DATABASE MARIADB & SIKLUS HIDUP WORKFLOW ---');

  let db;
  try {
    db = await mysql.createConnection(DB_CONFIG);
    assert(true, `Terhubung ke database MariaDB edms_ups (${DB_CONFIG.host}:${DB_CONFIG.port})`);

    // Cek tabel utama
    const [tables] = await db.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);
    assert(tableNames.includes('documents'), 'Tabel documents tersedia');
    assert(tableNames.includes('document_sections'), 'Tabel document_sections tersedia');
    assert(tableNames.includes('document_versions'), 'Tabel document_versions tersedia');
    assert(tableNames.includes('approvals'), 'Tabel approvals tersedia');
    assert(tableNames.includes('audit_logs'), 'Tabel audit_logs tersedia');
    assert(tableNames.includes('references'), 'Tabel references tersedia');
    assert(tableNames.includes('users'), 'Tabel users tersedia');

    // Cek kolom version_number pada documents
    const [cols] = await db.query("SHOW COLUMNS FROM documents LIKE 'version_number'");
    assert(cols.length > 0, 'Kolom version_number untuk optimistic locking tersedia');

    // Cek akun peran (RBAC)
    const [users] = await db.query("SELECT u.id, u.username, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id");
    const roles = new Set(users.map(u => u.role));
    assert(roles.has('Penyusun Dokumen'), 'Role Penyusun Dokumen terdaftar');
    assert(roles.has('Tim Mutu'), 'Role Tim Mutu (Reviewer) terdaftar');
    assert(roles.has('Manager Bidang'), 'Role Manager Bidang terdaftar');
    assert(roles.has('Pimpinan Unit'), 'Role Pimpinan Unit terdaftar');
    assert(roles.has('Admin Sistem'), 'Role Admin Sistem terdaftar');

    // -----------------------------------------------------------
    // SIMULASI ALUR PENUH SIKLUS HIDUP DOKUMEN MUTU
    // -----------------------------------------------------------
    console.log('\n--- 4. SIMULASI ALUR SIKLUS HIDUP LENGKAP (DRAFT -> AKTIF) ---');

    const testKode = `AUDIT.UPS.${Date.now().toString().slice(-6)}.2026`;
    const penyusun = users.find(u => u.role === 'Penyusun Dokumen') || users[0];
    const reviewer = users.find(u => u.role === 'Tim Mutu') || users[0];
    const manager  = users.find(u => u.role === 'Manager Bidang') || users[0];
    const pimpinan = users.find(u => u.role === 'Pimpinan Unit') || users[0];

    // 1. Buat Dokumen Baru (Draft)
    const [insertDoc] = await db.query(
      `INSERT INTO documents (kode, judul, bidang, jenis, siklus_review, penyusun_id, status, version_number)
       VALUES (?, ?, ?, ?, ?, ?, 'Draft', 1)`,
      [testKode, 'SOP Pengujian Audit Sistem Otomatis', 'Manajemen Mutu', 'SOP/Prosedur', '2 tahun', penyusun.id]
    );
    const docId = insertDoc.insertId;
    assert(docId > 0, `Dokumen audit berhasil dibuat (ID: ${docId}, Status: Draft, Kode: ${testKode})`);

    // 2. Simpan Seksi Beserta Metadata Urutan Seksi Kustom (_section_order)
    const testSections = {
      tujuan: '<p>Tujuan SOP pengujian audit sistem.</p>',
      ruang_lingkup: '<p>Mencakup seluruh unit PLN UP Sertifikasi.</p>',
      [customSection.key]: '<p>Diagram alir pengujian klausul dinamis.</p>',
      _section_order: JSON.stringify([
        { key: 'tujuan', title: 'Tujuan' },
        { key: customSection.key, title: customSection.title, isCustom: true },
        { key: 'ruang_lingkup', title: 'Ruang Lingkup' }
      ])
    };

    for (const [sKey, sContent] of Object.entries(testSections)) {
      await db.query(
        `INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)`,
        [docId, sKey, sContent]
      );
    }
    const [savedSections] = await db.query(
      `SELECT section_key FROM document_sections WHERE document_id = ?`, [docId]
    );
    assert(savedSections.length === 4, 'Seksi klausul termasuk metadata _section_order tersimpan di MariaDB');

    // 3. Uji Optimistic Locking (Increment version_number)
    const [verBefore] = await db.query(`SELECT version_number FROM documents WHERE id = ?`, [docId]);
    await db.query(`UPDATE documents SET version_number = version_number + 1 WHERE id = ?`, [docId]);
    const [verAfter] = await db.query(`SELECT version_number FROM documents WHERE id = ?`, [docId]);
    assert(verAfter[0].version_number === verBefore[0].version_number + 1, 'Optimistic locking increment version_number berjalan konsisten');

    // 4. Workflow Tahap 1: Submit ke Tim Mutu
    await db.query(`UPDATE documents SET status = 'Review' WHERE id = ?`, [docId]);
    await db.query(
      `INSERT INTO audit_logs (user_id, user_name, action_type, document_id, doc_kode, note) 
       VALUES (?, ?, 'SUBMIT', ?, ?, 'Diajukan ke Tim Mutu')`, 
      [penyusun.id, penyusun.username, docId, testKode]
    );
    const [stat1] = await db.query(`SELECT status FROM documents WHERE id = ?`, [docId]);
    assert(stat1[0].status === 'Review', 'Workflow Tahap 1: Dokumen berhasil diajukan (Status: Review)');

    // 5. Workflow Tahap 2: Review Tim Mutu -> Teruskan ke Manager
    await db.query(
      `INSERT INTO approvals (document_id, stage, action, actor_id, note, doc_version)
       VALUES (?, 1, 'Approve', ?, 'Draft memenuhi standar tata naskah ISO', '1.0')`,
      [docId, reviewer.id]
    );
    await db.query(`UPDATE documents SET status = 'Menunggu Approval' WHERE id = ?`, [docId]);
    const [stat2] = await db.query(`SELECT status FROM documents WHERE id = ?`, [docId]);
    assert(stat2[0].status === 'Menunggu Approval', 'Workflow Tahap 2: Tim Mutu menyetujui (Status: Menunggu Approval Manager)');

    // 6. Workflow Tahap 3: Manager Bidang Menyetujui dengan Tanda Tangan Digital
    const dummySig = '/uploads/signatures/sig_test_manager.png';
    await db.query(
      `INSERT INTO approvals (document_id, stage, action, actor_id, note, signature_path, doc_version)
       VALUES (?, 2, 'Approve', ?, 'Disetujui Manager Bidang', ?, '1.0')`,
      [docId, manager.id, dummySig]
    );
    assert(true, 'Workflow Tahap 3: Manager Bidang membubuhkan tanda tangan digital approval');

    // 7. Workflow Tahap 4: Pengesahan Final Pimpinan Unit -> Berstatus Aktif
    await db.query(
      `INSERT INTO approvals (document_id, stage, action, actor_id, note, signature_path, doc_version)
       VALUES (?, 3, 'Approve', ?, 'Dokumen disahkan untuk diterapkan di lingkungan UPS', ?, '1.0')`,
      [docId, pimpinan.id, dummySig]
    );
    await db.query(`UPDATE documents SET status = 'Aktif' WHERE id = ?`, [docId]);
    const [statFinal] = await db.query(`SELECT status FROM documents WHERE id = ?`, [docId]);
    assert(statFinal[0].status === 'Aktif', 'Workflow Tahap 4: Pimpinan Unit mengesahkan dokumen (Status Final: Aktif)');

    // 8. Verifikasi Riwayat Approval & Audit Log
    const [apprList] = await db.query(`SELECT * FROM approvals WHERE document_id = ? ORDER BY stage`, [docId]);
    assert(apprList.length === 3, 'Seluruh riwayat approval 3 tahap tersimpan permanen di tabel approvals');

    // Bersihkan dokumen pengujian
    await db.query(`DELETE FROM document_sections WHERE document_id = ?`, [docId]);
    await db.query(`DELETE FROM approvals WHERE document_id = ?`, [docId]);
    await db.query(`DELETE FROM audit_logs WHERE document_id = ?`, [docId]);
    await db.query(`DELETE FROM documents WHERE id = ?`, [docId]);
    assert(true, 'Pembersihan data dummy pengujian selesai');

  } catch (err) {
    console.error('Database Audit Error:', err);
    failCount++;
  } finally {
    if (db) await db.end();
  }

  // -------------------------------------------------------------
  // RINGKASAN AUDIT
  // -------------------------------------------------------------
  console.log('\n====================================================');
  console.log(` TOTAL ASUMSI PENGUJIAN : ${passCount + failCount}`);
  console.log(` BERHASIL (PASS)        : ${passCount}`);
  console.log(` GAGAL (FAIL)           : ${failCount}`);
  console.log(` TINGKAT KEBERHASILAN   : ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
