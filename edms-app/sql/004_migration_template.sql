-- ═══════════════════════════════════════════════════════════════
--  EDMS PLN UP SERTIFIKASI — Migrasi 004
--  Fitur Template Dokumen (RENCANA_FITUR_TEMPLATE_DOKUMEN.md §4.1):
--    - is_template         : 1 = dokumen menjadi master template,
--                             disembunyikan dari register /documents
--    - template_source_id  : FK self → template asal (hasil "Buat dari Template")
--    - Penandaan massal 143 blanko (Formulir Kerja + Formulir Tambahan)
--  Jalankan: mysql -u <user> -p edms_ups < 004_migration_template.sql
--
--  IDEMPOTEN:
--  * ADD COLUMN / ADD CONSTRAINT / ADD INDEX dibungkus guard
--    information_schema (sama seperti 003) — aman dijalankan berulang.
--  * UPDATE massal HANYA berjalan saat kolom `is_template` baru saja
--    dibuat pada eksekusi ini (@newcol = 1). Jika kolom sudah ada
--    (migrasi pernah dijalankan / penandaan manual sudah dilakukan),
--    dilewati agar tidak menimpa flag yang sudah diubah admin.
-- ═══════════════════════════════════════════════════════════════

USE `edms_ups`;

SET @db := DATABASE();

-- Catat apakah kolom masih belum ada SEBELUM ALTER di bawah dijalankan
SET @newcol := (
  SELECT COUNT(*) = 0
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'is_template'
);

-- ─── is_template ─────────────────────────────────────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD COLUMN `is_template` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = dokumen ini dipakai sebagai template, disembunyikan dari daftar Dokumen'' AFTER `source_ext`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'is_template'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── template_source_id (harus setelah is_template) ──────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD COLUMN `template_source_id` INT UNSIGNED NULL COMMENT ''FK self → template asal dokumen ini (hasil Buat dari Template)'' AFTER `is_template`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'template_source_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── FK self ON DELETE SET NULL ──────────────────────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD CONSTRAINT `fk_documents_template_source` FOREIGN KEY (`template_source_id`) REFERENCES `documents`(`id`) ON DELETE SET NULL',
    'SELECT 1'
  )
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND CONSTRAINT_NAME = 'fk_documents_template_source'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── indeks untuk pustaka template ───────────────────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD INDEX `idx_documents_is_template` (`is_template`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND INDEX_NAME = 'idx_documents_is_template'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── Penandaan massal 143 blanko — SEKALI JALAN ─────────────
-- Hanya ketika kolom baru dibuat pada eksekusi ini.
-- `updated_at = updated_at` mencegah ON UPDATE CURRENT_TIMESTAMP
-- agar timestamp dokumen tidak ikut berubah (konsisten untuk audit).
SET @sql := IF(
  @newcol = 1,
  'UPDATE `documents` SET `is_template` = 1, `updated_at` = `updated_at` WHERE `jenis` IN (''Formulir Kerja'', ''Formulir Tambahan'')',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── Verifikasi ──────────────────────────────────────────────
SELECT `jenis`, COUNT(*) AS jumlah_template
FROM `documents`
WHERE `is_template` = 1
GROUP BY `jenis`
ORDER BY `jenis`;
