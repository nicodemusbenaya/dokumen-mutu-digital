-- ═══════════════════════════════════════════════════════════════
--  EDMS PLN UP SERTIFIKASI — Seed Data
--  Jalankan SETELAH 001_schema.sql
--  mysql -u <user> -p edms_ups < 002_seed.sql
-- ═══════════════════════════════════════════════════════════════

USE `edms_ups`;

-- ─── ROLES ───────────────────────────────────────────────────

INSERT INTO `roles` (`name`) VALUES
  ('Penyusun Dokumen'),
  ('Tim Mutu'),
  ('Manager Bidang'),
  ('Pimpinan Unit'),
  ('Admin Sistem')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ─── USERS ───────────────────────────────────────────────────
-- Default passwords: semua 'edms2026' (bcrypt hash)
-- Ganti setelah pertama login

INSERT INTO `users` (`username`, `full_name`, `email`, `password_hash`, `role_id`, `bidang`) VALUES
  ('fakhri',   'Fakhri Aditya',   'fakhri@plnups.internal',
   '$2b$10$/3qMwB2YO/XHEtuvqbEpO.Vb1WHoHgJK6VllLskUcs18Ck.5x5lnm',
   (SELECT id FROM roles WHERE name='Penyusun Dokumen'), 'Manajemen Mutu'),
  ('sari',     'Sari Wulandari',  'sari@plnups.internal',
   '$2b$10$/3qMwB2YO/XHEtuvqbEpO.Vb1WHoHgJK6VllLskUcs18Ck.5x5lnm',
   (SELECT id FROM roles WHERE name='Tim Mutu'), 'Manajemen Mutu'),
  ('riko',     'Riko Ahmad',      'riko@plnups.internal',
   '$2b$10$/3qMwB2YO/XHEtuvqbEpO.Vb1WHoHgJK6VllLskUcs18Ck.5x5lnm',
   (SELECT id FROM roles WHERE name='Manager Bidang'), 'Manajemen Mutu'),
  ('budi',     'Budi Hartono',    'budi@plnups.internal',
   '$2b$10$/3qMwB2YO/XHEtuvqbEpO.Vb1WHoHgJK6VllLskUcs18Ck.5x5lnm',
   (SELECT id FROM roles WHERE name='Pimpinan Unit'), NULL),
  ('admin',    'Administrator',   'admin@plnups.internal',
   '$2b$10$/3qMwB2YO/XHEtuvqbEpO.Vb1WHoHgJK6VllLskUcs18Ck.5x5lnm',
   (SELECT id FROM roles WHERE name='Admin Sistem'), NULL)
ON DUPLICATE KEY UPDATE
  `full_name` = VALUES(`full_name`),
  `password_hash` = VALUES(`password_hash`);

-- ─── MASTER REFERENSI ────────────────────────────────────────

INSERT INTO `references` (`kategori`, `nomor`, `judul`, `deskripsi`, `created_by`) VALUES
  ('Regulasi', 'Permenaker No. 5/2018',
   'Keselamatan dan Kesehatan Kerja Lingkungan Kerja',
   'K3 Lingkungan Kerja', (SELECT id FROM users WHERE username='admin')),
  ('Standar',  'ISO/IEC 17024:2012',
   'Penilaian Kesesuaian — Persyaratan Umum Lembaga Sertifikasi Personel',
   'Sertifikasi personel', (SELECT id FROM users WHERE username='admin')),
  ('Standar',  'ISO 9001:2015',
   'Sistem Manajemen Mutu',
   'SMM berbasis risiko dan peluang', (SELECT id FROM users WHERE username='admin')),
  ('Internal', 'MAN.MUTU.UPS.2025.00',
   'Manual Mutu Terintegrasi v2.1',
   'Panduan sistem manajemen terintegrasi UPS', (SELECT id FROM users WHERE username='admin')),
  ('Regulasi', 'Peraturan BNSP No. 2/2017',
   'Pedoman Sertifikasi Kompetensi',
   'Persyaratan penyelenggaraan LSP', (SELECT id FROM users WHERE username='admin')),
  ('Standar',  'ISO 45001:2018',
   'Sistem Manajemen Keselamatan dan Kesehatan Kerja',
   'OH&S Management System', (SELECT id FROM users WHERE username='admin')),
  ('Regulasi', 'PP No. 50/2012',
   'Penerapan SMK3',
   'Sistem Manajemen Keselamatan Kerja', (SELECT id FROM users WHERE username='admin'));

-- ─── SAMPLE DOCUMENTS ────────────────────────────────────────

INSERT INTO `documents`
  (`kode`, `judul`, `bidang`, `jenis`, `siklus_review`, `status`,
   `current_version`, `version_number`, `penyusun_id`, `audit_ref`, `ack_total`, `ack_done`)
VALUES
  ('SOP.UPS.05.2026', 'Prosedur Penanganan Temuan Audit Internal',
   'Manajemen Mutu', 'SOP/Prosedur', '2 tahun', 'Menunggu Approval',
   '3.0', 3, (SELECT id FROM users WHERE username='fakhri'), 'AF-2026-014 (BNSP)', 24, 18),

  ('MAN.MUTU.UPS.2025.00', 'Manual Mutu Terintegrasi',
   'Manajemen Mutu', 'Manual Mutu', '2 tahun', 'Aktif',
   '2.1', 5, (SELECT id FROM users WHERE username='fakhri'), NULL, 24, 24),

  ('SOP.UPS.02.2024', 'Pelaksanaan Asesmen Kompetensi',
   'Sertifikasi', 'SOP/Prosedur', '2 tahun', 'Aktif',
   '4.2', 8, (SELECT id FROM users WHERE username='fakhri'), NULL, 15, 12),

  ('FORM.UPS.11.2023', 'Formulir Verifikasi TUK',
   'Sertifikasi', 'Formulir Kerja', '1 tahun', 'Draft',
   '1.3', 1, (SELECT id FROM users WHERE username='fakhri'), NULL, 0, 0),

  ('SOP.UPS.01.2022', 'Pengendalian Dokumen & Rekaman',
   'Manajemen Mutu', 'SOP/Prosedur', '2 tahun', 'Obsolete',
   '2.0', 4, (SELECT id FROM users WHERE username='fakhri'), NULL, 24, 24),

  ('SOP.UPS.03.2026', 'Pengelolaan Keluhan Peserta Sertifikasi',
   'Sertifikasi', 'SOP/Prosedur', '2 tahun', 'Review',
   '1.0', 1, (SELECT id FROM users WHERE username='fakhri'), NULL, 0, 0)
ON DUPLICATE KEY UPDATE `judul` = VALUES(`judul`);

-- ─── DOCUMENT SECTIONS ───────────────────────────────────────

-- SOP.UPS.05.2026
INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'tujuan',
  'Mengatur mekanisme tindak lanjut atas temuan audit internal agar setiap ketidaksesuaian ditangani secara tepat waktu dan terdokumentasi.'
FROM documents d WHERE d.kode = 'SOP.UPS.05.2026'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'ruang_lingkup',
  'Berlaku untuk seluruh bidang di lingkungan PLN UP Sertifikasi yang menjadi objek audit internal maupun eksternal (BNSP, KAN, DJK).'
FROM documents d WHERE d.kode = 'SOP.UPS.05.2026'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'definisi',
  '<p><strong>Temuan Audit:</strong> Hasil audit yang mengidentifikasi ketidaksesuaian.</p><p><strong>CAPA:</strong> Corrective Action and Preventive Action.</p><p><strong>Auditee:</strong> Pihak yang diaudit.</p>'
FROM documents d WHERE d.kode = 'SOP.UPS.05.2026'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'prosedur',
  '<ol><li>Auditee menerima laporan temuan dari tim audit.</li><li>Auditee menyusun rencana tindak lanjut (CAPA) maksimal 5 hari kerja.</li><li>Manager Bidang meninjau dan menyetujui rencana tindak lanjut.</li><li>Tim Mutu memverifikasi bukti penyelesaian.</li><li>Temuan ditutup dan dicatat pada log dokumen.</li></ol>'
FROM documents d WHERE d.kode = 'SOP.UPS.05.2026'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'lampiran',
  '<p>Form CAPA-01: Formulir Rencana Tindak Lanjut<br>Form CAPA-02: Formulir Verifikasi Penutupan Temuan</p>'
FROM documents d WHERE d.kode = 'SOP.UPS.05.2026'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

-- MAN.MUTU.UPS.2025.00
INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'tujuan',
  'Menyediakan panduan sistem manajemen terintegrasi PLN UP Sertifikasi mencakup ISO 9001, ISO/IEC 17024, dan ISO 45001.'
FROM documents d WHERE d.kode = 'MAN.MUTU.UPS.2025.00'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'ruang_lingkup',
  'Berlaku untuk seluruh kegiatan operasional PLN UP Sertifikasi.'
FROM documents d WHERE d.kode = 'MAN.MUTU.UPS.2025.00'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

-- SOP.UPS.02.2024
INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'tujuan',
  'Mengatur tata cara pelaksanaan asesmen kompetensi peserta uji oleh asesor.'
FROM documents d WHERE d.kode = 'SOP.UPS.02.2024'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

INSERT INTO `document_sections` (`document_id`, `section_key`, `content`)
SELECT d.id, 'prosedur',
  '<ol><li>Penjadwalan asesmen dikoordinasikan oleh Bidang Sertifikasi.</li><li>Asesi dipanggil dan diverifikasi identitasnya.</li><li>Asesmen dilaksanakan sesuai metode yang ditetapkan.</li><li>Asesor mengisi form penilaian dan memberikan rekomendasi.</li><li>Hasil asesmen direkap dan dilaporkan ke Ketua LSP.</li></ol>'
FROM documents d WHERE d.kode = 'SOP.UPS.02.2024'
ON DUPLICATE KEY UPDATE `content` = VALUES(`content`);

-- ─── DOCUMENT REFERENCES (many-to-many) ──────────────────────

-- SOP.UPS.05.2026 → Permenaker, ISO 17024, Manual Mutu
INSERT IGNORE INTO `document_references` (`document_id`, `reference_id`, `linked_by`)
SELECT d.id, r.id, (SELECT id FROM users WHERE username='fakhri')
FROM documents d, `references` r
WHERE d.kode = 'SOP.UPS.05.2026'
  AND r.nomor IN ('Permenaker No. 5/2018', 'ISO/IEC 17024:2012', 'MAN.MUTU.UPS.2025.00');

-- MAN.MUTU.UPS.2025.00 → ISO 17024, ISO 9001, BNSP
INSERT IGNORE INTO `document_references` (`document_id`, `reference_id`, `linked_by`)
SELECT d.id, r.id, (SELECT id FROM users WHERE username='fakhri')
FROM documents d, `references` r
WHERE d.kode = 'MAN.MUTU.UPS.2025.00'
  AND r.nomor IN ('ISO/IEC 17024:2012', 'ISO 9001:2015', 'Peraturan BNSP No. 2/2017');

-- ─── APPROVALS (sample workflow history) ─────────────────────

-- SOP.UPS.05.2026: reviewed by Tim Mutu, waiting mgr approval
INSERT INTO `approvals` (`document_id`, `stage`, `action`, `actor_id`, `note`, `doc_version`)
SELECT d.id, 1, 'Approve', (SELECT id FROM users WHERE username='sari'),
  'Disetujui, tidak ada catatan revisi.', '3.0'
FROM documents d WHERE d.kode = 'SOP.UPS.05.2026';

-- MAN.MUTU.UPS.2025.00: fully approved
INSERT INTO `approvals` (`document_id`, `stage`, `action`, `actor_id`, `note`, `doc_version`)
SELECT d.id, 1, 'Approve', (SELECT id FROM users WHERE username='sari'),
  'Disetujui.', '2.1'
FROM documents d WHERE d.kode = 'MAN.MUTU.UPS.2025.00';

INSERT INTO `approvals` (`document_id`, `stage`, `action`, `actor_id`, `note`, `doc_version`)
SELECT d.id, 2, 'Approve', (SELECT id FROM users WHERE username='riko'),
  'Disetujui Manager Bidang Mutu.', '2.1'
FROM documents d WHERE d.kode = 'MAN.MUTU.UPS.2025.00';

INSERT INTO `approvals` (`document_id`, `stage`, `action`, `actor_id`, `note`, `doc_version`)
SELECT d.id, 3, 'Approve', (SELECT id FROM users WHERE username='budi'),
  'Disahkan Pimpinan Unit.', '2.1'
FROM documents d WHERE d.kode = 'MAN.MUTU.UPS.2025.00';

-- ─── AUDIT LOG SAMPLES ───────────────────────────────────────

INSERT INTO `audit_logs` (`user_id`, `user_name`, `action_type`, `document_id`, `doc_kode`, `note`)
SELECT u.id, u.full_name, 'CREATE', d.id, d.kode, 'Dokumen baru dibuat'
FROM users u, documents d
WHERE u.username = 'fakhri' AND d.kode = 'SOP.UPS.05.2026';

INSERT INTO `audit_logs` (`user_id`, `user_name`, `action_type`, `document_id`, `doc_kode`, `note`)
SELECT u.id, u.full_name, 'SUBMIT', d.id, d.kode, 'Diajukan untuk review Tim Mutu'
FROM users u, documents d
WHERE u.username = 'fakhri' AND d.kode = 'SOP.UPS.05.2026';

INSERT INTO `audit_logs` (`user_id`, `user_name`, `action_type`, `document_id`, `doc_kode`, `note`)
SELECT u.id, u.full_name, 'REVIEW', d.id, d.kode, 'Disetujui Tim Mutu, tidak ada catatan'
FROM users u, documents d
WHERE u.username = 'sari' AND d.kode = 'SOP.UPS.05.2026';

INSERT INTO `audit_logs` (`user_id`, `user_name`, `action_type`, `document_id`, `doc_kode`, `note`)
SELECT u.id, u.full_name, 'PUBLISH', d.id, d.kode, 'Dokumen terbit dan aktif v2.1'
FROM users u, documents d
WHERE u.username = 'budi' AND d.kode = 'MAN.MUTU.UPS.2025.00';
