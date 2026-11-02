import fs from 'node:fs/promises';
import path from 'node:path';
import {query,withTransaction,rows,pool} from '../src/lib/db.mjs';
import {safePath,root,hash} from '../src/lib/core.mjs';
try{process.loadEnvFile('.env.local');}catch{}
const apply=process.argv.includes('--apply');const receiptArgument=process.argv.find(x=>x.startsWith('--receipt='));
const legacyChildren=new Set(['document_sections','document_versions','document_references','approvals','audit_logs','documents']);
try{
 const [database]=await query('SELECT DATABASE() name');if(database.name!=='edms_ups')throw new Error('Cleanup hanya untuk database edms_ups yang telah diverifikasi');
 const refs=await query("SELECT TABLE_NAME tableName,COLUMN_NAME columnName FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='documents'");for(const r of refs)if(!legacyChildren.has(r.tableName))throw new Error('Relasi tambahan perlu dipetakan sebelum cleanup: '+r.tableName);
 const legacy=await query('SELECT id,source_path,kop_path FROM documents ORDER BY id');const files=new Set();
 const remember=p=>{if(!p)return;let relative=String(p).replaceAll('\\','/').replace(/^\/uploads\//,'').replace(/^storage\//,'');if(relative.includes('..')||path.isAbsolute(relative))throw new Error('Path legacy tidak aman; periksa manifest');files.add(relative);};
 for(const d of legacy){remember(d.source_path);remember(d.kop_path);}
 const manifest={database:database.name,legacyDocumentIds:legacy.map(d=>d.id),files:[...files],storageRoot:root(),sharedFilesNotIncluded:true,generatedMediaPendingInventory:true};
 await fs.mkdir('backups',{recursive:true});await fs.writeFile('backups/legacy-cleanup-plan.json',JSON.stringify(manifest,null,2));
 if(!apply){console.log(JSON.stringify({mode:'plan-only',documents:legacy.length,knownFiles:files.size,requires:'Storage inventory, DB+storage backup, verified restore, and maintenance before apply'},null,2));}
 else{
  if(!receiptArgument)throw new Error('Wajib receipt backup/restore untuk apply');const receipt=JSON.parse(await fs.readFile(path.resolve(receiptArgument.slice(10)),'utf8'));
  if(!receipt.restoreVerified||!receipt.storageBackupVerified||!receipt.maintenanceConfirmed||!receipt.storageInventoryVerified||receipt.database!=='edms_ups')throw new Error('Backup/restore/maintenance/inventaris storage belum lengkap');
  const dump=await fs.readFile(path.resolve(receipt.dumpPath));if(hash(dump)!==receipt.sha256)throw new Error('Checksum backup tidak cocok');
  if(JSON.stringify(receipt.legacyDocumentIds)!==JSON.stringify(manifest.legacyDocumentIds))throw new Error('Daftar dokumen telah berubah; buat backup/manifest baru');
  const auditedFiles=receipt.documentOwnedFiles;if(!Array.isArray(auditedFiles))throw new Error('Daftar file dokumen khusus belum diverifikasi');
  for(const relative of auditedFiles){const full=safePath(relative);const stat=await fs.lstat(full);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Sasaran cleanup harus file biasa pada storage, bukan folder/symlink');if(/^(backups|brand|logos|config)\//i.test(relative))throw new Error('Path terlindungi');}
  await withTransaction(async c=>{const [lock]=await rows(c,'SELECT GET_LOCK(?,10) locked',['edms-v2-transition']);if(!lock.locked)throw new Error('Transisi lain sedang berjalan');try{const current=await rows(c,'SELECT id FROM documents ORDER BY id FOR UPDATE');if(JSON.stringify(current.map(d=>d.id))!==JSON.stringify(manifest.legacyDocumentIds))throw new Error('Dokumen berubah saat transisi');await rows(c,'DELETE FROM audit_logs WHERE document_id IS NOT NULL');for(const table of ['document_references','document_sections','document_versions','approvals'])await rows(c,'DELETE FROM `'+table+'` WHERE document_id IN (SELECT id FROM documents)');await rows(c,'DELETE FROM documents');await rows(c,"INSERT INTO v2_migrations(version,detail) VALUES('legacy-document-cleanup',?)",[JSON.stringify({documents:legacy.length,receiptHash:hash(Buffer.from(JSON.stringify(receipt)))})]);}finally{await rows(c,'SELECT RELEASE_LOCK(?)',['edms-v2-transition']);}});
  for(const relative of auditedFiles)await fs.unlink(safePath(relative));console.log('LEGACY_DOCUMENTS_CLEANED; akun, konfigurasi dan master independen dipertahankan');
 }
}catch(e){console.error('TRANSITION_BLOCKED',e.code||e.message);process.exitCode=1;}finally{await pool().end();}
