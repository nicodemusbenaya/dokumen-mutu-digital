import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {query,withTransaction,rows,pool} from '../src/lib/db.mjs';
import {id,hash,safePath,ensure,extension,editable,importCompletion} from '../src/lib/core.mjs';
import {publish,assemble,validateFile} from '../src/lib/documents.mjs';
import {importFolders,ensureImportFolders,shouldRetryFolder} from '../src/lib/import-folders.mjs';
import {filenameIdentity} from '../src/lib/filename-identity.mjs';
import {shouldRecheckClassification} from '../src/lib/import-classification.mjs';
import {departmentCode,departmentLabels} from '../src/lib/document-classification.mjs';
import {audit} from '../src/lib/security.mjs';
import {exportTick} from '../src/lib/export-worker.mjs';
try{process.loadEnvFile('.env.local');}catch{}
const workerId=id(),scripts=path.dirname(fileURLToPath(import.meta.url));let stopped=false;
async function userById(uid){const [u]=await query('SELECT u.id,u.full_name fullName,u.bidang,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND is_active=1',[uid]);if(!u)throw new Error('Pengunggah tidak aktif');return u;}
async function addItem(job,file,metadata,user,location){
 const entryKey=hash(String(file.index??'single'));
 let [existing]=await query('SELECT * FROM v2_import_items WHERE job_id=? AND entry_key=? LIMIT 1',[job.id,entryKey]);
 // Preserve checkpoints of jobs created before entry identities were introduced.
 if(!existing)[existing]=await query('SELECT * FROM v2_import_items WHERE job_id=? AND original_path=? AND entry_key IS NULL LIMIT 1',[job.id,file.path]);
 const recheck=shouldRecheckClassification(existing)||shouldRetryFolder(existing);
 if(existing&&(['success','duplicate','skipped'].includes(existing.state)||existing.state==='needs_review'&&!recheck))return;
  const itemId=existing?.id||id();let payload={file:file.file,metadata:{...metadata,originalPath:file.path}};
 if((existing?.state==='retry'||recheck)&&existing.payload_json){payload=JSON.parse(existing.payload_json);payload.file=file.file;}
 if(existing)await query('UPDATE v2_import_items SET entry_key=? WHERE id=?',[entryKey,itemId]);
 else await query("INSERT INTO v2_import_items(id,job_id,original_path,entry_key,state,stage,payload_json) VALUES(?,?,?,?,'running',?,?)",[itemId,job.id,file.path.slice(0,1100),entryKey,file.directory?'folder':'import',JSON.stringify(payload)]);
 let state='success',error=file.error||null,result={};
 try{
  if(error)throw new Error(error);
  const request={headers:new Headers({'x-forwarded-for':metadata._request?.ip||'','user-agent':metadata._request?.device||''})};
   if(location?.category){const code=departmentCode(location.category);location.inferredDepartment=code?departmentLabels[code]:(metadata.department||(user.role==='Editor'?user.bidang:null)||null);location.department=payload.metadata.manualDepartment?payload.metadata.department:location.inferredDepartment;}
  if(file.directory)await withTransaction(async c=>{
   await rows(c,'SELECT id FROM v2_import_items WHERE id=? FOR UPDATE',[itemId]);
    if(location.category)await ensureImportFolders(c,location,user,request);
   await rows(c,"UPDATE v2_import_items SET state='success',error=NULL WHERE id=?",[itemId]);
  });
   else {
    const name=path.posix.basename(file.path.replaceAll('\\','/')),identified=filenameIdentity(name);
    if(identified.kind&&!payload.metadata.documentId)payload.metadata.kind=identified.kind;
    if(identified.recognized&&!payload.metadata.documentId){payload.metadata.code=identified.code;payload.metadata.revision=identified.revision;payload.metadata.kind=identified.kind;if(!payload.metadata.manualDepartment)payload.metadata.department=identified.department||payload.metadata.department;}
    if(!payload.metadata.documentId&&(!payload.metadata.kind||!payload.metadata.department)){
     await query("UPDATE v2_import_items SET state='needs_review',stage='classification',error=?,payload_json=? WHERE id=?",['Jenis dokumen dan bidang perlu dipilih karena kode nama file tidak dikenali.',JSON.stringify(payload),itemId]);return;
    }
    payload.metadata.category=location?.category||'';
    result=await publish(payload.file,name,payload.metadata,user,request,{itemId,location});
   }
 }
 catch(e){state=e.status===409||e.code==='ER_DUP_ENTRY'?'needs_review':'failed';error=e.status||!e.code?e.message:'Penyimpanan gagal; coba lagi atau periksa log server';}
 const args=[state,error,result.documentId||null,result.fileId||null,JSON.stringify(payload),itemId];
 await query('UPDATE v2_import_items SET state=?,error=?,document_id=?,file_id=?,payload_json=? WHERE id=?',args);
}
async function importJob(job){const user=await userById(job.actor_id);if(!editable(user))throw new Error('Hak upload telah dicabut');const [upload]=await query('SELECT * FROM v2_uploads WHERE id=?',[job.upload_id]);const metadata=JSON.parse(upload.metadata);const source=await assemble(upload);const work=safePath('work/'+job.id);await fs.mkdir(work,{recursive:true});
 if(extension(upload.name)==='zip'){
  const child=spawn(process.env.PYTHON_BIN||(process.platform==='win32'?'python':'python3'),[path.join(scripts,'extract.py'),source,work],{stdio:['ignore','pipe','pipe'],windowsHide:true});let childError;child.on('error',e=>{childError=e;});const completion=new Promise(resolve=>child.on('close',resolve));const timer=setTimeout(()=>child.kill('SIGKILL'),300000);let count=0;
   try{for await(const line of readline.createInterface({input:child.stdout})){let file;try{file=JSON.parse(line);}catch{continue;}let location;try{location=importFolders(file.path,!!file.directory);}catch(e){file.error=e.message;location={category:'',relativePath:''};}await addItem(job,file,metadata,user,location);count++;await query('UPDATE v2_jobs SET progress=?,updated_at=NOW(3) WHERE id=?',[Math.min(95,count),job.id]);}const code=await completion;if(childError||code!==0&&count===0)throw new Error('Ekstraksi tidak selesai; periksa Python/arsip dan coba lagi');}finally{clearTimeout(timer);if(child.exitCode===null)child.kill();}
  }else await addItem(job,{path:upload.name,file:source},metadata,user,{category:metadata.category||'',relativePath:'',department:metadata.department||user.bidang||null});
 const [count]=await query("SELECT COUNT(*) total,SUM(state IN ('failed','needs_review','retry')) failed FROM v2_import_items WHERE job_id=?",[job.id]);const completion=importCompletion(count.total,count.failed);await query('UPDATE v2_jobs SET state=?,progress=100,error=NULL,lease_until=NULL,updated_at=NOW(3) WHERE id=?',[completion.state,job.id]);await query("UPDATE v2_uploads SET state='done' WHERE id=?",[upload.id]);await audit(null,user,null,'IMPORT_FINISHED',null,{jobId:job.id,total:completion.total,failed:completion.failed});
}
async function convertJob(job){const user=await userById(job.actor_id);const [source]=await query('SELECT f.*,v.document_id,v.number,d.active_version,d.owner_id,d.department,d.status FROM v2_files f JOIN v2_versions v ON v.id=f.version_id JOIN v2_documents d ON d.id=v.document_id WHERE f.id=?',[job.source_id]);if(!source)throw new Error('Sumber tidak ditemukan');if(source.status==='Sampah')throw new Error('Pulihkan dokumen dari Sampah dahulu');if(source.number!==source.active_version&&!editable(user,{ownerId:source.owner_id,department:source.department}))throw new Error('Tidak berhak mengonversi versi arsip');const [cached]=await query('SELECT id FROM v2_files WHERE source_id=? AND extension=?',[source.id,job.target]);if(!cached){
 const fileId=id(),relative='derived/'+fileId+'.'+job.target,output=safePath(relative),work=safePath('work/'+job.id);await fs.mkdir(work,{recursive:true});let note='Hasil konversi';
 try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--max-old-space-size=384',path.join(scripts,'convert.mjs'),safePath(source.disk_path),output,job.target,work],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout=(stdout+b).slice(-4000));child.stderr.on('data',b=>stderr=(stderr+b).slice(-1000));const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Konversi melewati 180 detik; coba file lebih kecil'));},180000);child.on('error',()=>{clearTimeout(timer);reject(new Error('Worker konversi tidak dapat dimulai'));});child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error(stderr.trim()||'Konversi gagal'));try{note=JSON.parse(stdout.trim().split('\n').pop()).note;}catch{}resolve();});});const info=await validateFile(output,'converted.'+job.target);await withTransaction(async c=>{await rows(c,'INSERT INTO v2_files(id,version_id,name,original_path,extension,origin,source_id,disk_path,sha256,size,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[fileId,source.version_id,path.basename(source.name,path.extname(source.name))+'-hasil-konversi.'+job.target,source.original_path,job.target,'converted',source.id,relative,info.sha256,info.size,note]);await audit(c,user,null,'CONVERSION_FINISHED',source.document_id,{sourceId:source.id,fileId,target:job.target});});}catch(e){await fs.unlink(output).catch(()=>{});throw e;}
 }await query("UPDATE v2_jobs SET state='done',progress=100,lease_until=NULL,updated_at=NOW(3) WHERE id=?",[job.id]);}
async function tick(){await ensure();if(await exportTick())return;const job=await withTransaction(async c=>{const [j]=await rows(c,"SELECT * FROM v2_jobs WHERE (state='queued' OR (state='running' AND lease_until<NOW())) AND attempts<3 ORDER BY created_at LIMIT 1 FOR UPDATE");if(!j)return null;await rows(c,"UPDATE v2_jobs SET state='running',worker_id=?,attempts=attempts+1,lease_until=DATE_ADD(NOW(),INTERVAL 90 SECOND),updated_at=NOW(3) WHERE id=?",[workerId,j.id]);return j;});if(!job)return;
 const heartbeat=setInterval(()=>{query("UPDATE v2_jobs SET lease_until=DATE_ADD(NOW(),INTERVAL 90 SECOND) WHERE id=? AND worker_id=? AND state='running'",[job.id,workerId]).catch(()=>{});},15000);
 try{await ensure();await(job.kind==='import'?importJob(job):convertJob(job));}catch(e){console.error('Worker job failed',job.id,e.code||e.name);await query("UPDATE v2_jobs SET state='failed',error=?,lease_until=NULL,updated_at=NOW(3) WHERE id=?",[e.code?'Pekerjaan gagal; periksa kesiapan runtime/database dan coba ulang':e.message.slice(0,1000),job.id]);}finally{clearInterval(heartbeat);}}
async function loop(){while(!stopped){try{await tick();}catch(e){console.error('Worker unavailable',e.code||e.name);}await new Promise(r=>setTimeout(r,2000));}await pool().end();}
process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});await loop();
