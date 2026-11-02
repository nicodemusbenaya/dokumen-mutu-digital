CREATE TABLE IF NOT EXISTS v2_folder_nodes (
 id CHAR(36) PRIMARY KEY,
 parent_id CHAR(36) NULL,
 category VARCHAR(500) NOT NULL,
 relative_path VARCHAR(500) NOT NULL DEFAULT '',
 name VARCHAR(500) NOT NULL,
 path_hash CHAR(64) NOT NULL,
 department VARCHAR(80) NULL,
 is_deleted TINYINT NOT NULL DEFAULT 0,
 created_by INT UNSIGNED NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 deleted_at DATETIME(3) NULL,
 UNIQUE KEY uq_v2_folder_path(path_hash),
 INDEX idx_v2_folder_parent(parent_id,is_deleted),
 INDEX idx_v2_folder_category(category(191),is_deleted),
 FOREIGN KEY(parent_id) REFERENCES v2_folder_nodes(id),
 FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_document_folders (
 document_id CHAR(36) CHARACTER SET __DOCUMENT_ID_CHARSET__ COLLATE __DOCUMENT_ID_COLLATION__ PRIMARY KEY,
 folder_id CHAR(36) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_v2_document_folder(folder_id),
 FOREIGN KEY(document_id) REFERENCES v2_documents(id),
 FOREIGN KEY(folder_id) REFERENCES v2_folder_nodes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
