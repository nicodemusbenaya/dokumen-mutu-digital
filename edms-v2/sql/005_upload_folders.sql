-- Preserve every document code as metadata, including codes shared by different titles.
ALTER TABLE v2_documents DROP INDEX IF EXISTS code;
ALTER TABLE v2_documents ADD INDEX IF NOT EXISTS idx_v2_docs_code(code);
-- Stable archive entry identity allows repeated names and restart without content deduplication.
ALTER TABLE v2_import_items ADD COLUMN IF NOT EXISTS entry_key VARCHAR(64) NULL;
ALTER TABLE v2_import_items ADD UNIQUE INDEX IF NOT EXISTS uq_v2_import_entry(job_id,entry_key);
