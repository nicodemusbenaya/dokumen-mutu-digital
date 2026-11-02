ALTER TABLE v2_documents ADD COLUMN IF NOT EXISTS map_parent_id CHAR(36) NULL;
ALTER TABLE v2_documents ADD COLUMN IF NOT EXISTS document_date DATE NULL;
ALTER TABLE v2_documents ADD COLUMN IF NOT EXISTS date_status VARCHAR(20) NOT NULL DEFAULT 'missing';
ALTER TABLE v2_documents ADD COLUMN IF NOT EXISTS date_source_file_id CHAR(36) NULL;
ALTER TABLE v2_documents ADD INDEX IF NOT EXISTS idx_v2_map_parent(map_parent_id);
