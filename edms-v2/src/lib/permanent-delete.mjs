import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {query,rows,withTransaction} from './db.mjs';
import {id,fail,safePath,text,root} from './core.mjs';
import {audit} from './security.mjs';

export function validatePermanentDelete(doc,target,data,user){
 if(user.role!=='Super user')fail('Hanya Super user dapat menghapus permanen',403);
 if(doc.status!=='Sampah')fail('Pindahkan dokumen ke Sampah terlebih dahulu',409);
 if(doc.lock_version!==target.lockVersion||doc.active_version!==target.expectedVersion)fail('Dokumen berubah. Muat ulang sebelum menghapus.',409);
 if(data.confirmation!=='HAPUS PERMANEN')fail('Ketik HAPUS PERMANEN untuk mengonfirmasi');
 return text(data.reason,2000);
}
async function checksum(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}

// Snapshot and file backups must finish before any DB deletion. Originals are
// removed only after commit; an interrupted cleanup remains explicitly recorded.
export async function permanentlyDelete(target,data,user,req){
 if(user.role!=='Super user')fail('Hanya Super user dapat menghapus permanen',403);
 const operationId=id(),directory=safePath('backups/permanent-delete/'+operationId);
 let manifest;
 const result=await withTransaction(async c=>{
  const [doc]=await rows(c,'SELECT * FROM v2_documents WHERE id=? FOR UPDATE',[target.id]);if(!doc)fail('Dokumen tidak ditemukan',404);
  const reason=validatePermanentDelete(doc,target,data,user);
  const versions=await rows(c,'SELECT * FROM v2_versions WHERE document_id=? FOR UPDATE',[doc.id]);
  const files=await rows(c,'SELECT f.* FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=? FOR UPDATE',[doc.id]);
  const jobs=await rows(c,"SELECT j.id FROM v2_jobs j JOIN v2_files f ON f.id=j.source_id JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=? AND j.state IN ('queued','running') FOR UPDATE",[doc.id]);
  if(jobs.length)fail('Tunggu pekerjaan konversi selesai sebelum menghapus permanen',409);
  const external=await rows(c,'SELECT f.id FROM v2_files f JOIN v2_files source ON source.id=f.source_id JOIN v2_versions v ON v.id=source.version_id WHERE v.document_id=? AND f.version_id NOT IN (SELECT id FROM v2_versions WHERE document_id=?) LIMIT 1',[doc.id,doc.id]);
  if(external.length)fail('File masih menjadi sumber dokumen lain. Periksa relasi sebelum menghapus.',409);
  const imports=await rows(c,'SELECT * FROM v2_import_items WHERE document_id=?',[doc.id]);
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  const realRoot=await fs.realpath(root());
  if(!(await fs.realpath(directory)).startsWith(realRoot+path.sep))fail('Folder backup tidak aman',409);
  const copies=[];
  for(const file of files){
   if(copies.some(f=>f.diskPath===file.disk_path))continue;
   if(!/^(originals|derived)\/[a-f0-9-]{36}\.(pdf|docx|xlsx)$/.test(file.disk_path))fail('Path file tidak sesuai; penghapusan dihentikan',409);
   const original=safePath(file.disk_path),backup=file.id+'.'+file.extension;
   const stat=await fs.lstat(original);if(!stat.isFile()||stat.isSymbolicLink())fail('File sumber tidak aman untuk dicadangkan',409);
   if(!(await fs.realpath(original)).startsWith(realRoot+path.sep))fail('File berada di luar storage; penghapusan dihentikan',409);
   await fs.copyFile(original,directory+'/'+backup,fs.constants.COPYFILE_EXCL);
   if(await checksum(directory+'/'+backup)!==file.sha256)fail('Verifikasi backup file gagal; dokumen tidak dihapus',409);
   copies.push({diskPath:file.disk_path,backup,sha256:file.sha256});
  }
  manifest={version:1,operationId,createdAt:new Date().toISOString(),actorId:user.id,reason,document:doc,versions,files,imports,copies,state:'prepared'};
  await fs.writeFile(directory+'/manifest.json',JSON.stringify(manifest),{flag:'wx',mode:0o600});
  await audit(c,user,req,'PERMANENT_DELETE',doc.id,{operationId,reason,code:doc.code,title:doc.title,versions:versions.length,files:files.length,recoveryManifest:'backups/permanent-delete/'+operationId+'/manifest.json'});
  await rows(c,'UPDATE v2_import_items SET document_id=NULL,file_id=NULL WHERE document_id=?',[doc.id]);
  await rows(c,'DELETE f FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=?',[doc.id]);
  await rows(c,'DELETE FROM v2_versions WHERE document_id=?',[doc.id]);
  await rows(c,'DELETE FROM v2_documents WHERE id=?',[doc.id]);
  return {id:doc.id,ok:true,operationId};
 });
 let cleanupPending=false;
 for(const file of manifest.copies){
  try{
   // Restored versions can share physical files. Never unlink a referenced path.
   const [refs]=await query('SELECT COUNT(*) n FROM v2_files WHERE disk_path=?',[file.diskPath]);
   if(Number(refs.n)===0){
    const source=safePath(file.diskPath);
    try{
     if(!(await fs.realpath(source)).startsWith((await fs.realpath(root()))+path.sep)||await checksum(source)!==file.sha256)throw new Error('File berubah; jangan hapus');
     await fs.unlink(source);
    }catch(e){if(e.code!=='ENOENT')throw e;}
   }
  }catch{cleanupPending=true;}
 }
 manifest.state=cleanupPending?'cleanup_pending':'completed';
 try{await fs.writeFile(directory+'/result.json',JSON.stringify({operationId,state:manifest.state,finishedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});}catch{cleanupPending=true;}
 return {...result,cleanupPending};
}
