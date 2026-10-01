-- ═══════════════════════════════════════════════════════════════
--  EDMS PLN UP SERTIFIKASI — Migrasi 003
--  Kolom untuk import "Formulir Eksisting":
--    - parent_prosedur_id : relasi dokumen → prosedur induk (self FK)
--    - source_path/name/ext: berkas asli yang disimpan di storage/
--    - kop_path           : aset kop surat hasil ekstrak word/header*.xml
--  Jalankan: mysql -u <user> -p edms_ups < 003_migration_import_columns.sql
--  Aman dijalankan berulang (semua ADD COLUMN dibunggu IF NOT EXISTS
--  lewat information_schema check di bawah).
-- ═══════════════════════════════════════════════════════════════

USE `edms_ups`;

SET @db := DATABASE();

-- ─── parent_prosedur_id ──────────────────────────────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD COLUMN `parent_prosedur_id` INT UNSIGNED NULL AFTER `audit_ref`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'parent_prosedur_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD CONSTRAINT `fk_documents_parent` FOREIGN KEY (`parent_prosedur_id`) REFERENCES `documents`(`id`) ON DELETE SET NULL',
    'SELECT 1'
  )
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND CONSTRAINT_NAME = 'fk_documents_parent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── kop_path (harus didahulukan: source_* memakai AFTER kop_path)
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD COLUMN `kop_path` VARCHAR(255) NULL AFTER `parent_prosedur_id`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'kop_path'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── source_path / source_name / source_ext ──────────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD COLUMN `source_path` VARCHAR(255) NULL AFTER `kop_path`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'source_path'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD COLUMN `source_name` VARCHAR(255) NULL AFTER `source_path`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'source_name'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD COLUMN `source_ext` VARCHAR(10) NULL AFTER `source_name`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'source_ext'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── indeks untuk navigasi hierarki ──────────────────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `documents` ADD INDEX `idx_documents_parent` (`parent_prosedur_id`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documents'
    AND INDEX_NAME = 'idx_documents_parent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
