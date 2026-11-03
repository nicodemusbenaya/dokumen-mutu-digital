CREATE TABLE IF NOT EXISTS v2_zoho_forms (
 slug VARCHAR(80) PRIMARY KEY, title VARCHAR(255) NOT NULL, zoho_url VARCHAR(500) NULL,
 webhook_key CHAR(64) NULL, sort_order INT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS v2_zoho_entries (
 id CHAR(36) PRIMARY KEY, form_slug VARCHAR(80) NOT NULL, payload_hash CHAR(64) NOT NULL, payload_json LONGTEXT NOT NULL,
 source VARCHAR(10) NOT NULL DEFAULT 'webhook', received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_v2_zoho_entry(form_slug,payload_hash), INDEX idx_v2_zoho_entry(form_slug,received_at),
 FOREIGN KEY(form_slug) REFERENCES v2_zoho_forms(slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO v2_zoho_forms(slug,title,zoho_url,sort_order) VALUES
 ('ceklis-pengawasan','FR.UPS.2026.BST.01.01-00 Ceklis Pengawasan Pelaksanaan Uji Kompetensi',NULL,1),
 ('berita-acara-kecurangan','FR.UPS.2026.BST.01.02-00 Berita Acara Kejadian/Dugaan Kecurangan',NULL,2),
 ('matriks-potensi-kecurangan','FR.UPS.2026.BST.01.03-00 Matriks Potensi Kecurangan dan Pengendaliannya','https://forms.zoho.com/plnups/form/FRUPS2026BST010300MatriksPotensiKecurangandanPenge',3),
 ('kode-etik-deklarasi','Kode Etik & Deklarasi Ketidakberpihakan','https://forms.zoho.com/plnups/form/KodeEtikDeklarasiKetidakberpihakan',4);
DROP TABLE IF EXISTS v2_form_submissions;
DROP TABLE IF EXISTS v2_form_versions;
DROP TABLE IF EXISTS v2_forms
