import {withTransaction,rows} from './db.mjs';
import {fail,editable,importCompletion} from './core.mjs';
import {requireEditor,audit} from './security.mjs';
import {requireMaster} from './masters.mjs';
import {document} from './documents.mjs';

async function lockJob(c,jobId,user){
 const [job]=await rows(c,'SELECT * FROM v2_jobs WHERE id=? FOR UPDATE',[jobId]);
 if(!job||job.actor_id!==user.id&&user.role!=='Super user')fail('Job tidak ditemukan',404);
 if(job.kind!=='import')fail('Aksi hanya tersedia untuk impor',409);
 if(!['done','failed','partial'].includes(job.state))fail('Tunggu proses selesai sebelum mengubah item',409);
 return job;
}
function itemId(value){if(!/^[a-f0-9-]{36}$/i.test(value||''))fail('ID item tidak valid');return value;}

export async function skipImportItem(jobId,data,user,req){
 requireEditor(user);
 return withTransaction(async c=>{
  await lockJob(c,jobId,user);
  const [item]=await rows(c,'SELECT * FROM v2_import_items WHERE id=? AND job_id=? FOR UPDATE',[itemId(data.itemId),jobId]);
  if(!item)fail('Item tidak ditemukan',404);
  if(item.state==='skipped')return {ok:true};
  if(!['failed','needs_review'].includes(item.state)||item.document_id||item.file_id)fail('Hanya item gagal yang belum diterbitkan dapat dilewati',409);
  await rows(c,"UPDATE v2_import_items SET state='skipped' WHERE id=?",[item.id]);
  const [count]=await rows(c,"SELECT COUNT(*) total,SUM(state NOT IN ('success','duplicate','skipped')) failed FROM v2_import_items WHERE job_id=?",[jobId]);
  const completion=importCompletion(count.total,count.failed);
  await rows(c,'UPDATE v2_jobs SET state=?,progress=100,error=NULL,updated_at=NOW(3) WHERE id=?',[completion.state,jobId]);
  await audit(c,user,req,'SKIP_IMPORT_ITEM',null,{jobId,itemId:item.id,originalPath:item.original_path,previousState:item.state,previousError:item.error});
  return {ok:true,state:completion.state};
 });
}

export async function resolveImportItem(jobId,data,user,req){
 requireEditor(user);
 return withTransaction(async c=>{
  await lockJob(c,jobId,user);
  const [item]=await rows(c,"SELECT * FROM v2_import_items WHERE id=? AND job_id=? AND state IN ('needs_review','failed') FOR UPDATE",[itemId(data.itemId),jobId]);
  if(!item?.payload_json)fail('Item tidak dapat diperbaiki; upload ulang file individual');
  if(item.stage==='folder')fail('Perbaiki folder atau lewati item folder ini',409);
  const payload=JSON.parse(item.payload_json),patch=data.metadata||{};
  if(typeof patch!=='object'||Array.isArray(patch))fail('Metadata tidak valid');
  const manualDepartment=!patch.documentId&&typeof patch.department==='string'&&!!patch.department.trim();
  if(manualDepartment){
   patch.department=patch.department.trim();
   if(!editable(user,{department:patch.department}))fail('Bidang berada di luar lingkup akun Anda',403);
   await requireMaster('department',patch.department,(sql,args)=>rows(c,sql,args));
  }
  payload.metadata={...payload.metadata,code:patch.code||payload.metadata.code,title:patch.title||payload.metadata.title,kind:patch.kind||payload.metadata.kind,department:patch.department||payload.metadata.department,manualDepartment,documentId:patch.documentId||null,mode:patch.documentId?'attach':undefined,expectedVersion:patch.expectedVersion,expectedLockVersion:patch.expectedLockVersion,revision:patch.revision||payload.metadata.revision};
  if(payload.metadata.documentId){const target=await document(itemId(payload.metadata.documentId));requireEditor(user,target);payload.metadata.department=target.department;payload.metadata.kind=target.kind;}
  await rows(c,"UPDATE v2_import_items SET state='retry',payload_json=? WHERE id=?",[JSON.stringify(payload),item.id]);
  await rows(c,"UPDATE v2_jobs SET state='queued',attempts=0,error=NULL,lease_until=NULL WHERE id=?",[jobId]);
  await audit(c,user,req,'RESOLVE_IMPORT_ITEM',null,{jobId,itemId:item.id,manualDepartment,department:payload.metadata.department,previousError:item.error});
  return {ok:true};
 });
}
