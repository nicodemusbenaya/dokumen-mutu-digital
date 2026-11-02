CREATE TABLE IF NOT EXISTS v2_master_values (
 id CHAR(36) PRIMARY KEY, type VARCHAR(20) NOT NULL, value VARCHAR(500) NOT NULL,
 label VARCHAR(500) NOT NULL, is_active TINYINT NOT NULL DEFAULT 1,
 lock_version INT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_v2_master(type,value)
) ENGINE=InnoDB;
INSERT IGNORE INTO v2_master_values(id,type,value,label) VALUES
 (UUID(),'kind','Manual Mutu','Manual Mutu'),
 (UUID(),'kind','SOP/Prosedur','SOP/Prosedur'),
 (UUID(),'kind','Instruksi Kerja','Instruksi Kerja'),
 (UUID(),'kind','Formulir Kerja','Formulir Kerja'),
 (UUID(),'kind','Lampiran','Lampiran'),
 (UUID(),'department','Umum','Umum');
INSERT IGNORE INTO v2_master_values(id,type,value,label) SELECT UUID(),'department',TRIM(bidang),TRIM(bidang) FROM users WHERE bidang IS NOT NULL AND TRIM(bidang)<>'';
INSERT IGNORE INTO v2_master_values(id,type,value,label) SELECT UUID(),'department',department,department FROM v2_documents WHERE department<>'';
INSERT IGNORE INTO v2_master_values(id,type,value,label) SELECT UUID(),'kind',kind,kind FROM v2_documents WHERE kind<>'';
INSERT IGNORE INTO v2_master_values(id,type,value,label) SELECT UUID(),'category',category,category FROM v2_documents WHERE category<>'';
