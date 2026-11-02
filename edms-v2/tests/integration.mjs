import {managementIntegration} from './management-integration.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import JSZip from 'jszip';
import {query,withTransaction,rows,pool} from '../src/lib/db.mjs';
import {safePath} from '../src/lib/core.mjs';
import {ensureFolderLocation} from '../src/lib/folder-tree.mjs';
try{process.loadEnvFile('.env.local');}catch{}
if(process.env.RUN_DUMMY_DB_TESTS!=='true')throw new Error('Set RUN_DUMMY_DB_TESTS=true hanya setelah schema, worker dan backup siap');
const base=process.env.TEST_BASE_URL||'http://localhost:3100',tag='DUMMY-'+randomUUID(),password=randomUUID();const createdUsers=[],createdMasters=[];let userId,cookie='';
const requestOrigin=process.env.TEST_ORIGIN||base,generatedFixtures=[];
let currentStep='initialization';
function stage(name){currentStep=name;console.log('DUMMY_STEP: '+name);}
async function request(p,options={}){const r=await fetch(base+'/api/v2/'+p,{...options,headers:{Origin:requestOrigin,Cookie:cookie,...options.headers}});const data=await r.json();return {r,data};}
const post=(p,v)=>request(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)});
async function job(id){for(let n=0;n<45;n++){const {data}=await request('jobs/'+id);if(['done','partial','failed'].includes(data.state))return data;await new Promise(r=>setTimeout(r,1000));}throw new Error('Worker tidak menyelesaikan dummy job');}
async function upload(name,metadata={},fixtureName=name){if(metadata.documentId&&metadata.expectedLockVersion===undefined){metadata.expectedLockVersion=(await request('documents/'+metadata.documentId)).data.lockVersion;}const data=Buffer.isBuffer(fixtureName)?fixtureName:await fs.readFile('tests/output/'+fixtureName);const first=await post('uploads',{name,size:data.length,metadata:{...metadata,testTag:tag}});assert.equal(first.r.status,200,JSON.stringify(first.data));const u=first.data;for(let n=0;n<u.parts;n++){const result=await request('uploads/'+u.id+'/part?number='+n,{method:'PUT',body:data.subarray(n*u.chunkSize,(n+1)*u.chunkSize),headers:{'Content-Type':'application/octet-stream'}});assert.equal(result.r.status,200,JSON.stringify(result.data));}const result=await post('uploads/'+u.id+'/complete',{});const again=await post('uploads/'+u.id+'/complete',{});assert.equal(result.data.jobId,again.data.jobId,'Finalisasi harus idempoten');return job(result.data.jobId);}
try{
 stage('create isolated dummy account');
 const [role]=await query("SELECT id FROM roles WHERE name='Super user'");if(!role)throw new Error('Role admin lama belum ada');const r=await query('INSERT INTO users(username,full_name,password_hash,role_id,bidang,is_active) VALUES(?,?,?,?,?,1)',[tag.slice(0,55),'DUMMY Integration',await bcrypt.hash(password,10),role.id,tag]);userId=r.insertId;
 stage('login');let result=await post('login',{username:tag.slice(0,55),password});assert.equal(result.r.status,200,JSON.stringify(result.data));cookie=result.r.headers.get('set-cookie').split(';')[0];
 stage('create tagged master values');
 for(const [type,value] of [['department',tag],['category',tag],['category',tag+'-bulk'],['kind',tag],['department',tag+'-OTHER']]){const master=await post('masters',{type,value,label:value,isActive:true});assert.equal(master.r.status,200,JSON.stringify(master.data));createdMasters.push(master.data.id);}
 let masterChange=await request('masters/'+createdMasters[3],{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'kind',label:tag+' label',isActive:true,lockVersion:0})});assert.equal(masterChange.r.status,200);
 masterChange=await request('masters/'+createdMasters[3],{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'kind',label:'DUMMY stale',isActive:false,lockVersion:0})});assert.equal(masterChange.r.status,409);
 const invalidMaster=await post('uploads',{name:'DUMMY-invalid-master.pdf',size:100,metadata:{kind:tag+'-unregistered'}});assert.equal(invalidMaster.r.status,409);

 result=await request('uploads',{method:'POST',body:'{}',headers:{Origin:'https://not-authorized.invalid','Content-Type':'application/json'}});assert.equal(result.r.status,403);
 stage('upload PDF and publish');const first=await upload('DUMMY-prosedur.pdf',{code:tag,title:'DUMMY Integration PDF',kind:'SOP/Prosedur'});assert.equal(first.state,'done',JSON.stringify(first));const documentId=first.items.find(i=>i.documentId).documentId;
 const detail=await request('documents/'+documentId);assert.equal(detail.data.testTag,tag,'Jangan mengubah record di luar test run ini');assert.equal(detail.data.activeVersion,1);const source=detail.data.versions[0].files[0];let download=await fetch(base+'/api/v2/files/'+source.id,{headers:{Cookie:cookie}});const original=await fs.readFile('tests/output/DUMMY-prosedur.pdf');assert(Buffer.from(await download.arrayBuffer()).equals(original));
 stage('PDF to DOCX conversion');const conversion=await post('files/'+source.id+'/convert',{target:'docx'});if(conversion.data.jobId){const conversionJob=await job(conversion.data.jobId);assert.equal(conversionJob.state,'done',JSON.stringify(conversionJob));}const updated=await request('documents/'+documentId);const converted=updated.data.versions[0].files.find(f=>f.origin==='converted'&&f.extension==='docx');assert(converted);
 download=await fetch(base+'/api/v2/files/'+converted.id,{headers:{Cookie:cookie}});assert.equal(download.status,403);const ticket=await post('files/'+converted.id+'/ticket',{acknowledged:true});download=await fetch(base+'/api/v2/files/'+converted.id+'?ticket='+encodeURIComponent(ticket.data.ticket),{headers:{Cookie:cookie}});assert.equal(download.status,200);
 stage('automatic filename classification against the naming reference');const classifiedName='PR.UPS.DUMMY.BMK.98-97 DUMMY auto classification.pdf',classifiedPath=null;const classified=await upload(classifiedName,{},'DUMMY-prosedur.pdf');assert.equal(classified.state,'done',JSON.stringify(classified));const classifiedDoc=(await request('documents/'+classified.items[0].documentId)).data;assert.equal(classifiedDoc.code,'PR.UPS.DUMMY.BMK.98-97');assert.equal(classifiedDoc.title,'PR.UPS.DUMMY.BMK.98-97 DUMMY auto classification');assert.equal(classifiedDoc.kind,'SOP/Prosedur');assert.equal(classifiedDoc.department,'Bidang Pengendalian Mutu, Kinerja, Keuangan dan Umum');assert.equal(classifiedDoc.versions[0].revision,'97');
 stage('publish DOCX revision');const revised=await upload('DUMMY-prosedur.docx',{documentId,expectedVersion:1,summary:'DUMMY revisi langsung',revision:'1'});assert.equal(revised.state,'done',JSON.stringify(revised));assert.equal((await request('documents/'+documentId)).data.activeVersion,2);
 const wordDetail=(await request('documents/'+documentId)).data;const wordSource=wordDetail.versions[0].files.find(f=>f.origin==='original'&&f.extension==='docx');
 stage('DOCX to PDF conversion');const wordPdf=await post('files/'+wordSource.id+'/convert',{target:'pdf'});if(wordPdf.data.jobId){const convertedJob=await job(wordPdf.data.jobId);assert.equal(convertedJob.state,'done',JSON.stringify(convertedJob));}
 assert((await request('documents/'+documentId)).data.versions[0].files.some(f=>f.origin==='converted'&&f.extension==='pdf'));
 stage('XLSX upload and PDF conversion');const excelJob=await upload('DUMMY-formulir.xlsx',{code:tag+'-XLSX',title:'DUMMY Excel integration',kind:tag});assert.equal(excelJob.state,'done',JSON.stringify(excelJob));const excelId=excelJob.items.find(i=>i.documentId).documentId;
 const excelDetail=(await request('documents/'+excelId)).data;assert.equal(excelDetail.testTag,tag);const excelSource=excelDetail.versions[0].files.find(f=>f.extension==='xlsx');const excelPdf=await post('files/'+excelSource.id+'/convert',{target:'pdf'});if(excelPdf.data.jobId){const convertedJob=await job(excelPdf.data.jobId);assert.equal(convertedJob.state,'done',JSON.stringify(convertedJob));}
 assert((await request('documents/'+excelId)).data.versions[0].files.some(f=>f.origin==='converted'&&f.extension==='pdf'));
 stage('version conflict');const conflict=await upload('DUMMY-formulir.xlsx',{documentId,expectedVersion:1,summary:'DUMMY konflik',revision:'2'});assert.equal(conflict.state,'partial',JSON.stringify(conflict));assert(conflict.items.some(i=>i.state==='needs_review'));
 stage('same bytes and code accepted as a separate document');
 const repeated=await upload('DUMMY-prosedur.pdf',{code:tag,title:'DUMMY Integration PDF Different Ending',kind:tag,department:tag});
 assert.equal(repeated.state,'done',JSON.stringify(repeated));assert(repeated.items.every(i=>i.state==='success'));
 assert.notEqual(repeated.items[0].documentId,documentId);
 const repeatedDetail=(await request('documents/'+repeated.items[0].documentId)).data;
 assert.equal(repeatedDetail.code,tag);assert.equal(repeatedDetail.versions[0].files[0].sha256,source.sha256);
 stage('automatic ZIP folders, full titles and retry without duplicate publication');
 const structure=await upload('DUMMY-struktur.zip',{category:tag,kind:'Formulir Mutu',department:tag});assert.equal(structure.state,'done',JSON.stringify(structure));
 const structureFiles=structure.items.filter(i=>i.documentId);assert.equal(structureFiles.length,3);
 for(const item of structureFiles){const d=(await request('documents/'+item.documentId)).data;assert.equal(d.category,item.originalPath.includes('DUMMY Mutu/Sub')?'DUMMY Mutu':'');assert.equal(d.title,item.originalPath.split('/').at(-1).replace(/\.pdf$/i,''));}
 const explorer=(await request('folders?catalog=1')).data.folders;assert(explorer.some(f=>f.path==='DUMMY Mutu/Sub'));assert(explorer.some(f=>f.path==='DUMMY Kosong'));const nested=explorer.find(f=>f.path==='DUMMY Mutu/Sub');const opened=(await request('folders?folderId='+nested.id)).data;assert.equal(opened.documents.length,2);assert(opened.documents.every(d=>d.category==='DUMMY Mutu'));const rootExplorer=(await request('folders')).data;assert(rootExplorer.documents.some(d=>d.title==='DUMMY-root'));
 const sameCode=[];for(const item of structureFiles.filter(i=>i.originalPath.includes('/')))sameCode.push((await request('documents/'+item.documentId)).data);
 assert.equal(sameCode[0].code,sameCode[1].code);assert.notEqual(sameCode[0].title,sameCode[1].title);
 const autoFolders=(await request('masters')).data.values.filter(v=>v.type==='category');
 assert(autoFolders.some(v=>v.value==='DUMMY Kosong'));assert(autoFolders.some(v=>v.value==='DUMMY Mutu'));assert(!autoFolders.some(v=>v.value==='DUMMY Mutu/Sub'));
 stage('Explorer folder actions');const created=await post('folders',{name:'DUMMY Explorer Root',department:tag});assert.equal(created.r.status,200,JSON.stringify(created.data));const child=await post('folders',{name:'DUMMY Explorer Child',parentId:created.data.id});assert.equal(child.r.status,200,JSON.stringify(child.data));const moved=await request('folders?folderId='+child.data.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'move',parentId:nested.parentId})});assert.equal(moved.r.status,200,JSON.stringify(moved.data));const deleted=await request('folders?folderId='+child.data.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete'})});assert.equal(deleted.r.status,200,JSON.stringify(deleted.data));const trash=(await request('folders?trash=1')).data.folders;assert(trash.some(f=>f.id===child.data.id));const restored=await request('folders?folderId='+child.data.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restore'})});assert.equal(restored.r.status,200,JSON.stringify(restored.data));
 stage('reuse deleted ZIP category without manual reactivation');
 const emptyFolder=(await request('folders?catalog=1')).data.folders.find(f=>f.path==='DUMMY Kosong');assert(emptyFolder);
 const patchFolder=(folderId,action)=>request('folders?folderId='+folderId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
 assert.equal((await patchFolder(emptyFolder.id,'delete')).r.status,200);
 let [emptyMaster]=await query("SELECT id,is_active,lock_version FROM v2_master_values WHERE type='category' AND value='DUMMY Kosong'");assert.equal(emptyMaster.is_active,0);
 await assert.rejects(withTransaction(c=>ensureFolderLocation(c,{category:'DUMMY Kosong',department:tag+'-OTHER'},{id:userId,role:'Editor',bidang:tag+'-OTHER',fullName:'DUMMY denied'},null)),error=>error.status===403);
 const [stillDeleted]=await query('SELECT is_deleted FROM v2_folder_nodes WHERE id=?',[emptyFolder.id]);assert.equal(stillDeleted.is_deleted,1);
 const [stillInactive]=await query('SELECT is_active FROM v2_master_values WHERE id=?',[emptyMaster.id]);assert.equal(stillInactive.is_active,0);

 const reusedZip=await upload('DUMMY-struktur.zip',{kind:'Formulir Mutu',department:tag});assert.equal(reusedZip.state,'done',JSON.stringify(reusedZip));
 let [reusedFolder]=await query('SELECT id,is_deleted FROM v2_folder_nodes WHERE id=?',[emptyFolder.id]);assert.equal(reusedFolder.is_deleted,0);
 [emptyMaster]=await query("SELECT id,is_active,lock_version FROM v2_master_values WHERE type='category' AND value='DUMMY Kosong'");assert.equal(emptyMaster.is_active,1);
 stage('explicit inactive category remains blocked; active category with deleted folder is reusable');
 await query('UPDATE v2_master_values SET is_active=0 WHERE id=?',[emptyMaster.id]);
 assert.equal((await post('folders',{name:'DUMMY Kosong',department:tag})).r.status,409);
 const blockedZip=await upload('DUMMY-struktur.zip',{kind:'Formulir Mutu',department:tag});assert.equal(blockedZip.state,'partial',JSON.stringify(blockedZip));assert(blockedZip.items.some(item=>item.error?.includes('Kategori dinonaktifkan')));
 const [retryCount]=await query('SELECT COUNT(*) total FROM v2_documents WHERE test_tag=?',[tag]);
 await query('UPDATE v2_master_values SET is_active=1 WHERE id=?',[emptyMaster.id]);
 await post('jobs/'+blockedZip.id+'/retry',{});assert.equal((await job(blockedZip.id)).state,'done');
 const [retryAfter]=await query('SELECT COUNT(*) total FROM v2_documents WHERE test_tag=?',[tag]);assert.equal(retryAfter.total,retryCount.total,'Retry must not duplicate successful files');

 await query('UPDATE v2_master_values SET is_active=1 WHERE id=?',[emptyMaster.id]);
 assert.equal((await patchFolder(emptyFolder.id,'delete')).r.status,200);
 await query('UPDATE v2_master_values SET is_active=1 WHERE id=?',[emptyMaster.id]);
 assert.equal((await post('folders',{name:'DUMMY Kosong',department:tag})).r.status,200);
 const [reuseAudit]=await query("SELECT COUNT(*) total FROM v2_audit WHERE actor_id=? AND action='REUSE_DELETED_FOLDER'",[userId]);assert.equal(Number(reuseAudit.total),2);
 stage('reuse a deleted subfolder');assert.equal((await patchFolder(child.data.id,'delete')).r.status,200);
 const reusedChild=await post('folders',{name:'DUMMY Explorer Child',parentId:nested.parentId});assert.equal(reusedChild.r.status,200);assert.equal(reusedChild.data.id,child.data.id);
 const [beforeRetry]=await query('SELECT COUNT(*) total FROM v2_documents WHERE test_tag=?',[tag]);
 await post('jobs/'+structure.id+'/retry',{});assert.equal((await job(structure.id)).state,'done');
 const [afterRetry]=await query('SELECT COUNT(*) total FROM v2_documents WHERE test_tag=?',[tag]);assert.equal(afterRetry.total,beforeRetry.total);
 stage('mixed ZIP partial success');const zip=await upload('DUMMY-campuran.zip',{category:tag,kind:'Formulir Mutu',department:tag});assert.equal(zip.state,'partial',JSON.stringify(zip));assert(zip.items.some(i=>i.state==='failed'));assert.equal(zip.items.filter(i=>i.documentId&&i.state==='success').length,3);
 stage('manual department applies to one failed ZIP item while bulk stays strict');
 const manualFolder='0. MM - DUMMY '+tag;
 const manualArchive=await new JSZip().file(manualFolder+'/DUMMY manual no code.pdf',await fs.readFile('tests/output/DUMMY-prosedur.pdf')).generateAsync({type:'nodebuffer'});
 const mmJob=await upload('DUMMY-MM-manual.zip',{kind:'Manual Mutu',department:tag},manualArchive);assert.equal(mmJob.state,'done',JSON.stringify(mmJob));
 const mismatchArchive=await new JSZip().file(manualFolder+'/PR.UPS.DUMMY.BMK.97-96 DUMMY mismatch.pdf',await fs.readFile('tests/output/DUMMY-prosedur.pdf')).generateAsync({type:'nodebuffer'});
 const strictJob=await upload('DUMMY-MM-mismatch.zip',{kind:'SOP/Prosedur',department:tag},mismatchArchive);assert.equal(strictJob.state,'partial');
 const mismatch=strictJob.items.find(item=>item.state==='needs_review');assert(mismatch?.error.includes('Bidang dokumen berbeda'));
 const bmk='Bidang Pengendalian Mutu, Kinerja, Keuangan dan Umum';
 const resolved=await post('jobs/'+strictJob.id+'/resolve',{itemId:mismatch.id,metadata:{department:bmk,kind:'SOP/Prosedur'}});assert.equal(resolved.r.status,200,JSON.stringify(resolved.data));
 const resolvedJob=await job(strictJob.id);assert.equal(resolvedJob.state,'done',JSON.stringify(resolvedJob));
 const resolvedDoc=(await request('documents/'+resolvedJob.items.find(item=>item.documentId).documentId)).data;assert.equal(resolvedDoc.department,bmk);
 const [rootBefore]=await query('SELECT department FROM v2_folder_nodes WHERE category=? AND parent_id IS NULL',[manualFolder]);assert.equal(rootBefore.department,tag);
 const singleManual=await upload('PR.UPS.DUMMY.BMK.97-96 DUMMY single manual.pdf',{category:manualFolder,department:tag+'-OTHER',manualDepartment:true},'DUMMY-prosedur.pdf');assert.equal(singleManual.state,'done',JSON.stringify(singleManual));assert.equal((await request('documents/'+singleManual.items[0].documentId)).data.department,tag+'-OTHER');
 const [rootAfter]=await query('SELECT department FROM v2_folder_nodes WHERE category=? AND parent_id IS NULL',[manualFolder]);assert.equal(rootAfter.department,tag);
 const forgedBulk=await post('uploads',{name:'DUMMY-forged-manual.zip',size:100,metadata:{manualDepartment:true,department:bmk,kind:'SOP/Prosedur'}});assert.equal(forgedBulk.r.status,400);
 stage('skip unresolved import items, preserve successful files, and keep skipped items skipped on retry');
 stage('pair one failed ZIP format to an existing document without changing its folder or department');
 const pairTargetJob=await upload('DUMMY-manual-pair.docx',{code:tag+'-PAIR',title:'DUMMY Manual pair',kind:'SOP/Prosedur',department:bmk,revision:'0'},'DUMMY-prosedur.docx');assert.equal(pairTargetJob.state,'done');
 const pairTarget=(await request('documents/'+pairTargetJob.items[0].documentId)).data;
 const pairBlocked=await upload('DUMMY-MM-pair.zip',{kind:'SOP/Prosedur',department:tag},mismatchArchive);assert.equal(pairBlocked.state,'partial');
 const pairItem=pairBlocked.items.find(item=>item.state==='needs_review');assert(pairItem);
 const pairResult=await post('jobs/'+pairBlocked.id+'/resolve',{itemId:pairItem.id,metadata:{documentId:pairTarget.id,expectedVersion:pairTarget.activeVersion,expectedLockVersion:pairTarget.lockVersion,revision:pairTarget.versions[0].revision}});assert.equal(pairResult.r.status,200,JSON.stringify(pairResult.data));assert.equal((await job(pairBlocked.id)).state,'done');
 const paired=(await request('documents/'+pairTarget.id)).data;assert.equal(paired.department,bmk);assert.equal(paired.category,pairTarget.category);assert.equal(paired.activeVersion,pairTarget.activeVersion);assert.equal(paired.versions[0].files.filter(file=>file.origin==='original').length,2);
 const successful=zip.items.find(item=>item.documentId);assert.equal((await post('jobs/'+zip.id+'/skip',{itemId:successful.id})).r.status,409);
 const unresolved=zip.items.filter(item=>['failed','needs_review'].includes(item.state));assert(unresolved.length);
 await query("UPDATE v2_jobs SET state='running',lease_until=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=?",[zip.id]);
 assert.equal((await post('jobs/'+zip.id+'/skip',{itemId:unresolved[0].id})).r.status,409);
 await query("UPDATE v2_jobs SET state='partial',lease_until=NULL WHERE id=?",[zip.id]);
 assert.equal((await post('jobs/'+zip.id+'/skip',{itemId:mismatch.id})).r.status,404);

 for(const [index,item] of unresolved.entries()){const skipped=await post('jobs/'+zip.id+'/skip',{itemId:item.id});assert.equal(skipped.r.status,200,JSON.stringify(skipped.data));assert.equal(skipped.data.state,index===unresolved.length-1?'done':'partial');}
 assert.equal((await post('jobs/'+zip.id+'/skip',{itemId:unresolved[0].id})).r.status,200);
 let skippedJob=(await request('jobs/'+zip.id)).data;assert.equal(skippedJob.state,'done');assert.equal(skippedJob.items.filter(item=>item.state==='skipped').length,unresolved.length);
 const [countBeforeSkipRetry]=await query('SELECT COUNT(*) total FROM v2_documents WHERE test_tag=?',[tag]);
 await post('jobs/'+zip.id+'/retry',{});skippedJob=await job(zip.id);assert.equal(skippedJob.state,'done');assert.equal(skippedJob.items.filter(item=>item.state==='skipped').length,unresolved.length);
 const [countAfterSkipRetry]=await query('SELECT COUNT(*) total FROM v2_documents WHERE test_tag=?',[tag]);assert.equal(countAfterSkipRetry.total,countBeforeSkipRetry.total);
 const [skipAudit]=await query("SELECT COUNT(*) total FROM v2_audit WHERE actor_id=? AND action='SKIP_IMPORT_ITEM'",[userId]);assert.equal(Number(skipAudit.total),unresolved.length);
 await managementIntegration({request,post,upload,documentId,excelId,base,cookie,tag,createdUsers});
 console.log('DUMMY_DB_INTEGRATION_PASS: upload/finalize/download/PDF-to-DOCX/DOCX-to-PDF/XLSX-to-PDF/warning/update/conflict/ZIP partial');
}catch(error){console.error('DUMMY_INTEGRATION_FAILED_AT: '+currentStep);console.error(error.stack||error.message);throw error;}finally{
 if(userId){
  const exports=await query('SELECT id FROM v2_exports WHERE actor_id=?',[userId]);const uploads=await query('SELECT id FROM v2_uploads WHERE actor_id=?',[userId]);const jobs=await query('SELECT id FROM v2_jobs WHERE actor_id=?',[userId]);const files=await query('SELECT f.disk_path FROM v2_files f JOIN v2_versions v ON v.id=f.version_id JOIN v2_documents d ON d.id=v.document_id WHERE d.test_tag=?',[tag]);const folderRows=await query('SELECT id,relative_path,category FROM v2_folder_nodes WHERE created_by=?',[userId]);const folderCategories=[...new Set(folderRows.filter(folder=>!folder.relative_path).map(folder=>folder.category))];
  await withTransaction(async c=>{await rows(c,'DELETE FROM v2_document_folders WHERE document_id IN (SELECT id FROM v2_documents WHERE test_tag=?) OR folder_id IN (SELECT id FROM v2_folder_nodes WHERE created_by=?)',[tag,userId]);await rows(c,'DELETE FROM v2_import_items WHERE job_id IN (SELECT id FROM v2_jobs WHERE actor_id=?)',[userId]);await rows(c,'DELETE FROM v2_jobs WHERE actor_id=?',[userId]);await rows(c,'DELETE FROM v2_exports WHERE actor_id=?',[userId]);await rows(c,'DELETE FROM v2_parts WHERE upload_id IN (SELECT id FROM v2_uploads WHERE actor_id=?)',[userId]);await rows(c,'DELETE FROM v2_uploads WHERE actor_id=?',[userId]);await rows(c,'DELETE f FROM v2_files f JOIN v2_versions v ON v.id=f.version_id JOIN v2_documents d ON d.id=v.document_id WHERE d.test_tag=?',[tag]);await rows(c,'DELETE v FROM v2_versions v JOIN v2_documents d ON d.id=v.document_id WHERE d.test_tag=?',[tag]);await rows(c,'DELETE FROM v2_documents WHERE test_tag=?',[tag]);for(const folder of [...folderRows].sort((a,b)=>b.relative_path.length-a.relative_path.length))await rows(c,'DELETE FROM v2_folder_nodes WHERE id=? AND created_by=?',[folder.id,userId]);await rows(c,'DELETE FROM v2_audit WHERE actor_id=?',[userId]);if(folderCategories.length)await rows(c,"DELETE FROM v2_master_values WHERE type='category' AND value IN ("+folderCategories.map(()=>'?').join(',')+')',folderCategories);await rows(c,"DELETE FROM v2_master_values WHERE type='category' AND value LIKE ?",[tag+'/%']);for(const mid of createdMasters)await rows(c,'DELETE FROM v2_master_values WHERE id=? AND value LIKE ?',[mid,'DUMMY-%']);await rows(c,'DELETE FROM users WHERE id=? AND username LIKE ?',[userId,'DUMMY-%']);for(const uid of createdUsers)await rows(c,"DELETE FROM users WHERE id=? AND username LIKE 'DUMMY-%'",[uid]);});
  for(const e of exports){await fs.unlink(safePath('work/export-'+e.id+'.zip')).catch(()=>{});await fs.unlink(safePath('work/export-'+e.id+'.json')).catch(()=>{});}
  for(const f of files)await fs.unlink(safePath(f.disk_path)).catch(()=>{});
  for(const fixture of generatedFixtures)await fs.unlink(fixture).catch(()=>{});
  // Each recursive target is a generated UUID, resolved by safePath under the private storage root.
  for(const u of uploads)await fs.rm(safePath('staging/'+u.id),{recursive:true,force:true});for(const j of jobs)await fs.rm(safePath('work/'+j.id),{recursive:true,force:true});
  // Production smoke must also remove recovery copies of this run's dummy purge.
  const backupRoot=safePath('backups/permanent-delete');
  for(const entry of await fs.readdir(backupRoot,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
   if(!entry.isDirectory()||!/^[a-f0-9-]{36}$/.test(entry.name))continue;
   const dir=safePath('backups/permanent-delete/'+entry.name);
   const manifest=JSON.parse(await fs.readFile(dir+'/manifest.json','utf8'));
   if(manifest.document?.test_tag!==tag)continue;
   assert.equal(manifest.operationId,entry.name);
   const allowed=new Set(['manifest.json','result.json',...manifest.copies.map(f=>{assert(/^[a-f0-9-]{36}\.(pdf|docx|xlsx)$/.test(f.backup));return f.backup;})]);
   for(const name of await fs.readdir(dir))assert(allowed.has(name),'Unexpected file in tagged dummy recovery directory');
   await fs.rm(dir,{recursive:true});
  }
 }
 await pool().end();
}
