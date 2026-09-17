-- ═══════════════════════════════════════════════════════════════
--  EDMS PLN UP SERTIFIKASI — Database Schema
--  MariaDB 10.5.8+
--  Jalankan: mysql -u <user> -p edms_ups < 001_schema.sql
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS `edms_ups`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `edms_ups`;

-- ─── USERS & ROLES ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `roles` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(60) NOT NULL UNIQUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `users` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username`     VARCHAR(60)  NOT NULL UNIQUE,
  `full_name`    VARCHAR(120) NOT NULL,
  `email`        VARCHAR(120) UNIQUE,
  `password_hash`VARCHAR(255) NOT NULL,
  `role_id`      INT UNSIGNED NOT NULL,
  `bidang`       VARCHAR(80),
  `is_active`    BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB;

-- ─── MASTER REFERENSI ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `references` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `kategori`    ENUM('Regulasi','Standar','Internal') NOT NULL,
  `nomor`       VARCHAR(120) NOT NULL,
  `judul`       VARCHAR(500) NOT NULL,
  `deskripsi`   TEXT,
  `is_active`   BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by`  INT UNSIGNED NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

-- ─── DOCUMENTS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `documents` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `kode`             VARCHAR(80)  NOT NULL UNIQUE,
  `judul`            VARCHAR(500) NOT NULL,
  `bidang`           VARCHAR(80)  NOT NULL,
  `jenis`            ENUM('SOP/Prosedur','Manual Mutu','Instruksi Kerja','Formulir Kerja','Formulir Tambahan','BA Pemusnahan Rekaman','Pernyataan Kerahasiaan','Daftar Rekaman Mutu') NOT NULL,
  `siklus_review`    VARCHAR(20)  NOT NULL DEFAULT '2 tahun',
  `status`           ENUM('Draft','Review','Menunggu Approval','Aktif','Obsolete') NOT NULL DEFAULT 'Draft',
  `current_version`  VARCHAR(20)  NOT NULL DEFAULT '1.0',
  `version_number`   INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Optimistic locking counter',
  `penyusun_id`      INT UNSIGNED NOT NULL,
  `audit_ref`        VARCHAR(120),
  `ack_total`        INT UNSIGNED NOT NULL DEFAULT 0,
  `ack_done`         INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`penyusun_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

-- ─── DOCUMENT VERSIONS (arsip versi lama) ────────────────────

CREATE TABLE IF NOT EXISTS `document_versions` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `document_id` INT UNSIGNED NOT NULL,
  `version`     VARCHAR(20)  NOT NULL,
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'Obsolete',
  `deskripsi`   VARCHAR(500),
  `archived_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_by` INT UNSIGNED,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`archived_by`)  REFERENCES `users`(`id`)
) ENGINE=InnoDB;

-- ─── DOCUMENT SECTIONS (isi terstruktur) ─────────────────────

CREATE TABLE IF NOT EXISTS `document_sections` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `document_id` INT UNSIGNED NOT NULL,
  `section_key` VARCHAR(60)  NOT NULL
                  COMMENT 'tujuan | ruang_lingkup | definisi | prosedur | lampiran',
  `content`     LONGTEXT,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_doc_section` (`document_id`, `section_key`),
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── DOCUMENT ↔ REFERENCES (many-to-many) ───────────────────

CREATE TABLE IF NOT EXISTS `document_references` (
  `document_id`  INT UNSIGNED NOT NULL,
  `reference_id` INT UNSIGNED NOT NULL,
  `linked_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `linked_by`    INT UNSIGNED,
  PRIMARY KEY (`document_id`, `reference_id`),
  FOREIGN KEY (`document_id`)  REFERENCES `documents`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reference_id`) REFERENCES `references`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`linked_by`)    REFERENCES `users`(`id`)
) ENGINE=InnoDB;

-- ─── APPROVALS (workflow berjenjang) ─────────────────────────

CREATE TABLE IF NOT EXISTS `approvals` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `document_id` INT UNSIGNED NOT NULL,
  `stage`       TINYINT UNSIGNED NOT NULL
                  COMMENT '1=review_tim_mutu, 2=mgr_bidang, 3=pimpinan',
  `action`      ENUM('Approve','Reject') NOT NULL,
  `actor_id`    INT UNSIGNED NOT NULL,
  `note`        TEXT,
  `signature_path` VARCHAR(255)
                  COMMENT 'Path relatif ke file gambar TTD, NULL jika tidak ada TTD',
  `doc_version` VARCHAR(20)  NOT NULL COMMENT 'Versi dokumen saat di-approve',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_id`)    REFERENCES `users`(`id`)
) ENGINE=InnoDB;

-- ─── SIGNATURES (metadata TTD per pengguna) ──────────────────

CREATE TABLE IF NOT EXISTS `signatures` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT UNSIGNED NOT NULL UNIQUE,
  `file_path`   VARCHAR(255) NOT NULL,
  `ip_address`  VARCHAR(60),
  `user_agent`  VARCHAR(500),
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

-- ─── AUDIT LOG (immutable) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT UNSIGNED,
  `user_name`   VARCHAR(120) NOT NULL COMMENT 'Snapshot nama saat aksi',
  `action_type` VARCHAR(30)  NOT NULL
                  COMMENT 'CREATE|SUBMIT|REVIEW|APPROVE|REJECT|PUBLISH|GENERATE|LOGIN|LOGOUT',
  `document_id` INT UNSIGNED,
  `doc_kode`    VARCHAR(80)  COMMENT 'Snapshot kode saat aksi',
  `note`        TEXT,
  `ip_address`  VARCHAR(60),
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Revoke UPDATE & DELETE on audit_logs dari application user
-- (Jalankan manual setelah create user aplikasi)
-- REVOKE UPDATE, DELETE ON edms_ups.audit_logs FROM 'edms_app'@'%';
