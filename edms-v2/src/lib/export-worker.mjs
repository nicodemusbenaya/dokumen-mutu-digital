import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {query,withTransaction,rows} from './db.mjs';
import {safePath,root,editable} from './core.mjs';
export async function exportTick(){
 await query("UPDATE v2_exports SET state='failed',error='Worker terhenti setelah tiga percobaan. Buat ekspor baru.',lease_until=NULL WHERE state='running' AND lease_until<NOW() AND attempts>=3");
 const expired=await query('SELECT id FROM v2_exports WHERE expires_at<NOW() LIMIT 20');for(const e of expired){await fs.unlink(safePath('work/export-'+e.id+'.zip')).catch(()=>{});await fs.unlink(safePath('work/export-'+e.id+'.json')).catch(()=>{});await query('DELETE FROM v2_exports WHERE id=? AND expires_at<NOW()',[e.id]);}
 const e=await withTransaction(async c=>{const [e]=await rows(c,"SELECT * FROM v2_exports WHERE expires_at>NOW() AND (state='queued' OR (state='running' AND lease_until<NOW())) AND attempts<3 ORDER BY created_at LIMIT 1 FOR UPDATE");if(!e)return null;await rows(c,"UPDATE v2_exports SET state='running',attempts=attempts+1,lease_until=DATE_ADD(NOW(),INTERVAL 6 MINUTE) WHERE id=?",[e.id]);return e;});if(!e)return false;
 const output=safePath('work/export-'+e.id+'.zip'),manifest=safePath('work/export-'+e.id+'.json'),temp=output+'.tmp';
 try{
  const [user]=await query('SELECT u.id,u.bidang,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND u.is_active=1',[e.actor_id]);if(!user)throw new Error('Akun tidak aktif');
  for(const f of JSON.parse(e.manifest_json)){const [d]=await query('SELECT * FROM v2_documents WHERE id=?',[f.documentId]);if(!d||d.status==='Sampah'||(d.active_version!==f.version||d.status!=='Aktif')&&!editable(user,{ownerId:d.owner_id,department:d.department}))throw new Error('Izin atau versi dokumen berubah; buat ekspor baru');}
  const space=await fs.statfs(safePath('work'));let bytes=0;for(const f of JSON.parse(e.manifest_json))bytes+=(await fs.stat(safePath(f.path))).size;if(Number(space.bavail)*Number(space.bsize)<bytes+50*1024*1024)throw new Error('Storage tidak cukup untuk ZIP');
  await fs.writeFile(manifest,e.manifest_json);
  await new Promise((resolve,reject)=>{const child=spawn(process.env.PYTHON_BIN||(process.platform==='win32'?'python':'python3'),[fileURLToPath(new URL('../../scripts/export-zip.py',import.meta.url)),root(),manifest,temp],{windowsHide:true,stdio:'ignore'});const timer=setTimeout(()=>{child.kill();reject(new Error('Ekspor melewati batas waktu'));},300000);child.on('error',err=>{clearTimeout(timer);reject(err);});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Pembuatan ZIP gagal'));});});
  await fs.rename(temp,output);await query("UPDATE v2_exports SET state='done',error=NULL,lease_until=NULL WHERE id=?",[e.id]);
 }catch(err){await fs.unlink(temp).catch(()=>{});await query("UPDATE v2_exports SET state='failed',error=?,lease_until=NULL WHERE id=?",[err.code?'Storage/runtime ekspor belum siap':err.message,e.id]);}finally{await fs.unlink(manifest).catch(()=>{});}
 return true;
}
