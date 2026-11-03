CREATE TABLE IF NOT EXISTS v2_forms (
 id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, department VARCHAR(160) NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'draft', access VARCHAR(20) NOT NULL DEFAULT 'login',
 public_token CHAR(32) NOT NULL UNIQUE, definition_json LONGTEXT NOT NULL,
 published_version INT NULL, lock_version INT NOT NULL DEFAULT 1,
 created_by INT UNSIGNED NOT NULL, updated_by INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(created_by) REFERENCES users(id), FOREIGN KEY(updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS v2_form_versions (
 form_id CHAR(36) NOT NULL, version INT NOT NULL, definition_json LONGTEXT NOT NULL, title VARCHAR(255) NOT NULL,
 published_by INT UNSIGNED NOT NULL, published_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(form_id,version), FOREIGN KEY(form_id) REFERENCES v2_forms(id) ON DELETE CASCADE,
 FOREIGN KEY(published_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS v2_form_submissions (
 id CHAR(36) PRIMARY KEY, form_id CHAR(36) NOT NULL, form_version INT NOT NULL, answers_json LONGTEXT NOT NULL,
 submitter_id INT UNSIGNED NULL, submitter_label VARCHAR(160) NOT NULL, ip VARCHAR(80) NULL,
 flagged TINYINT(1) NOT NULL DEFAULT 0, flag_note VARCHAR(500) NULL,
 deleted_at DATETIME(3) NULL, deleted_by INT UNSIGNED NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_v2_form_sub(form_id,deleted_at,created_at),
 FOREIGN KEY(form_id,form_version) REFERENCES v2_form_versions(form_id,version),
 FOREIGN KEY(submitter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
