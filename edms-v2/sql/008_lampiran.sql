INSERT IGNORE INTO v2_master_values(id,type,value,label,is_active)
VALUES(UUID(),'kind','Lampiran','Lampiran',1);
UPDATE v2_master_values
SET lock_version=lock_version+1,label='Lampiran',is_active=1,updated_at=NOW(3)
WHERE type='kind' AND value='Lampiran' AND (is_active=0 OR label<>'Lampiran');
