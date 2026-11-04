import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {query,withTransaction,rows} from './db.mjs';
import {id,hash,safePath,ensure,fail,text,validName,extension,editable,mime} from './core.mjs';
import {actor,origin,rate,audit,requireEditor,cookie,token,verify} from './security.mjs';
import {document,detail,listDocuments,uploadedFile,assemble} from './documents.mjs';
import {management} from './management-api.mjs';
import {mutateDocument} from './management.mjs';
import {requireMaster} from './masters.mjs';
import {filenameIdentity} from './filename-identity.mjs';
import {skipImportItem,resolveImportItem} from './import-actions.mjs';
import {departmentsMatch} from './document-classification.mjs';
import {listDocumentMap,updateDocumentMap,readRegisteredDocumentDate} from './document-map.mjs';
import {zohoWebhook,zohoForms} from './zoho.mjs';
const MAX_CHUNK=4*1024*1024;
async function body(req,max=32768){const reader=req.body?.getReader();if(!reader)return Buffer.alloc(0);let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('Payload terlalu besar',413);}chunks.push(value);}return Buffer.concat(chunks);}
const json=async req=>{try{return JSON.parse((await body(req,131072)).toString());}catch(e){if(e.status)throw e;fail('JSON tidak valid');}};
function response(value,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});}
function uuid(value){if(!/^[a-f0-9-]{36}$/i.test(value||''))fail('ID tidak valid');return value;}
async function getFile(fileId,user){const [f]=await query('SELECT f.*,v.document_id,v.number,d.active_version,d.owner_id,d.department,d.status FROM v2_files f JOIN v2_versions v ON v.id=f.version_id JOIN v2_documents d ON d.id=v.document_id WHERE f.id=?',[uuid(fileId)]);if(!f)fail('File tidak ditemukan',404);if(f.status==='Sampah')fail('Pulihkan dokumen dari Sampah sebelum download',403);if((f.number!==f.active_version||f.status!=='Aktif')&&!editable(user,{ownerId:f.owner_id,department:f.department}))fail('Tidak memiliki akses versi arsip',403);return f;}
export async function handle(req,segments){try{
 const method=req.method,url=new URL(req.url),[area,key,operation]=segments;
 // Webhook Zoho datang dari server Zoho (tanpa Origin/sesi); dilindungi kunci per form.
 const hook=await zohoWebhook(req,segments,{body,response});if(hook)return hook;
 if(method!=='GET'&&method!=='HEAD')origin(req);
 if(area==='health'&&method==='GET'){try{await query('SELECT 1');await ensure();return response({ok:true,version:'2.1.10',database:true});}catch{return response({ok:false,error:'Database atau storage belum siap'},503);}}
 if(area==='login'&&method==='POST'){
  await rate(req,'login',20);const data=await json(req),username=text(data.username,60);const [u]=await query('SELECT u.id,u.username,u.full_name fullName,u.password_hash,u.bidang,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username=? AND u.is_active=1',[username]);
  if(!u||typeof data.password!=='string'||data.password.length>200||!await bcrypt.compare(data.password,u.password_hash))fail('Username atau password salah',401);
  const result=response({user:{id:u.id,username:u.username,fullName:u.fullName,role:u.role,bidang:u.bidang}});result.cookies.set(cookie(),await token({uid:u.id}),{httpOnly:true,secure:process.env.COOKIE_SECURE==='true'||url.protocol==='https:',sameSite:'lax',path:'/',maxAge:28800});await audit(null,u,req,'LOGIN');return result;
 }
 const user=await actor(req);
 if(area==='document-map'){
  if(method==='GET'&&!key)return response(await listDocumentMap());
  if(method==='PATCH'&&key)return response(await updateDocumentMap(key,await json(req),user,req));
  if(method==='POST'&&key&&operation==='read-date')return response(await readRegisteredDocumentDate(key,user,req));
  fail('Aksi Peta Dokumen tidak didukung',405);
 }
 const managed=await management(req,segments,user,json,response);if(managed)return managed;
 const formResult=await zohoForms(req,segments,user,{body,response});if(formResult)return formResult;
 if(area==='me')return response({user,canUpload:editable(user)});
 if(area==='logout'&&method==='POST'){await audit(null,user,req,'LOGOUT');const r=response({ok:true});r.cookies.set(cookie(),'',{httpOnly:true,path:'/',maxAge:0});return r;}
 if(area==='stats'&&method==='GET'){const [stats]=await query("SELECT COUNT(*) documents,COALESCE(SUM(active_version-1),0) revisions,COUNT(DISTINCT department) departments FROM v2_documents WHERE status='Aktif'");const [files]=await query('SELECT COUNT(*) files,COALESCE(SUM(size),0) bytes FROM v2_files');const recent=await query("SELECT id,code,title,department,active_version activeVersion,updated_at updatedAt FROM v2_documents WHERE status='Aktif' ORDER BY updated_at DESC LIMIT 5");return response({...stats,...files,recent});}
 if(area==='documents'){
  if(!key&&method==='GET')return response(await listDocuments(url,user));
  if(key&&method==='GET')return response(await detail(uuid(key),user));
  if(key&&method==='PATCH'){const data=await json(req);if(!['Aktif','Diarsipkan'].includes(data.status))fail('Status tidak valid');return response(await mutateDocument({id:uuid(key),lockVersion:data.lockVersion,expectedVersion:data.expectedVersion},data.status==='Aktif'?'unarchive':'archive',data,user,req));}
 }
 if(area==='uploads'){
  requireEditor(user);
  if(!key&&method==='POST'){
   await rate(req,'upload:'+user.id,150);const data=await json(req),name=validName(data.name);if(!['pdf','docx','xlsx','zip'].includes(extension(name)))fail('Pilih PDF, DOCX, XLSX atau ZIP');const size=Number(data.size),max=Number(process.env.MAX_UPLOAD_BYTES||524288000);if(!Number.isSafeInteger(size)||size<=0||size>max)fail('Ukuran upload melebihi batas '+Math.round(max/1048576)+' MB');
   const metadata=data.metadata||{};if(typeof metadata!=='object'||Array.isArray(metadata))fail('Metadata tidak valid');if(metadata.documentId){const d=await document(uuid(metadata.documentId));requireEditor(user,d);if(extension(name)==='zip')fail('Revisi menggunakan file individual, bukan ZIP');}
   if(metadata.mode&&!metadata.documentId)fail('Mode update memerlukan dokumen tujuan');if(metadata.mode&&!['update','attach'].includes(metadata.mode))fail('Mode update tidak valid');
   if(!metadata.documentId){
    const zip=extension(name)==='zip',identified=zip?null:filenameIdentity(name);
    if(zip&&metadata.manualDepartment)fail('Bidang manual hanya dapat dipilih untuk file individual',400);
    metadata.manualDepartment=metadata.manualDepartment===true;
    const selectedDepartment=metadata.manualDepartment?text(metadata.department,80):null;
    if(identified?.recognized){metadata.code=identified.code;metadata.revision=identified.revision;metadata.kind=identified.kind;metadata.department=selectedDepartment||identified.department||metadata.department;
     if(!editable(user,{department:metadata.department}))fail('Kode dokumen berada di luar bidang akun Anda',403);
    }else if(!zip){metadata.kind=identified?.kind||text(metadata.kind,80);metadata.department=text(user.role==='Super user'?(metadata.department||user.bidang||'Umum'):(user.bidang||'Umum'),80);}
    else{metadata.kind=metadata.kind?text(metadata.kind,80):null;metadata.department=metadata.department?text(metadata.department,80):(user.role==='Editor'?user.bidang:null);}
    metadata.category=metadata.category?text(metadata.category,500):'';
    if(metadata.kind)await requireMaster('kind',metadata.kind);
    if(metadata.department){if(user.role==='Editor'&&!departmentsMatch(metadata.department,user.bidang))fail('Bidang berada di luar lingkup akun Anda',403);await requireMaster('department',metadata.department);}
    if(metadata.category)await requireMaster('category',metadata.category);
   }
   if(metadata.testTag&&!/^DUMMY-[A-Za-z0-9_-]{1,70}$/.test(metadata.testTag))fail('Penanda dummy tidak valid');delete metadata.originalPath;metadata._request={ip:req.headers.get('x-forwarded-for')||'',device:req.headers.get('user-agent')||''};
   await ensure();const stat=await fs.statfs(safePath('staging'));if(Number(stat.bavail)*Number(stat.bsize)<size+100*1024*1024)fail('Storage tidak cukup',507);const uploadId=id();await fs.mkdir(safePath('staging/'+uploadId));const parts=Math.ceil(size/MAX_CHUNK);
   await withTransaction(async c=>{await rows(c,'SELECT id FROM users WHERE id=? FOR UPDATE',[user.id]);const [quota]=await rows(c,"SELECT COALESCE(SUM(size),0) size FROM v2_uploads WHERE actor_id=? AND state IN ('uploading','queued') AND expires_at>NOW()",[user.id]);if(Number(quota.size)+size>2*1024**3)fail('Kuota upload sementara 2 GB terlampaui',429);await rows(c,'INSERT INTO v2_uploads(id,actor_id,name,size,parts,metadata,expires_at) VALUES(?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 24 HOUR))',[uploadId,user.id,name,size,parts,JSON.stringify(metadata)]);await audit(c,user,req,'BEGIN_UPLOAD',metadata.documentId||null,{uploadId,name,size});});return response({id:uploadId,name,parts,chunkSize:MAX_CHUNK});
  }
  const u=await uploadedFile(user,uuid(key));
  if(method==='GET'){const parts=await query('SELECT number FROM v2_parts WHERE upload_id=?',[u.id]);return response({id:u.id,state:u.state,name:u.name,parts:u.parts,chunkSize:MAX_CHUNK,received:parts.map(p=>p.number)});}
  if(operation==='part'&&method==='PUT'){
   if(u.state!=='uploading')fail('Sesi tidak menerima potongan lagi',409);const n=Number(url.searchParams.get('number'));if(!Number.isInteger(n)||n<0||n>=u.parts)fail('Nomor potongan tidak valid');const data=await body(req,MAX_CHUNK);const expected=n===u.parts-1?Number(u.size)-n*MAX_CHUNK:MAX_CHUNK;if(data.length!==expected)fail('Ukuran potongan tidak cocok');const digest=hash(data);const temp=safePath('staging/'+u.id+'/'+n+'-'+id());await fs.writeFile(temp,data,{flag:'wx'});
   try{await withTransaction(async c=>{const [lock]=await rows(c,'SELECT state FROM v2_uploads WHERE id=? FOR UPDATE',[u.id]);if(lock.state!=='uploading')fail('Sesi telah difinalisasi',409);const [old]=await rows(c,'SELECT sha256 FROM v2_parts WHERE upload_id=? AND number=?',[u.id,n]);if(old&&old.sha256!==digest)fail('Potongan sebelumnya berbeda',409);if(!old){await fs.rename(temp,safePath('staging/'+u.id+'/'+n));await rows(c,'INSERT INTO v2_parts(upload_id,number,size,sha256) VALUES(?,?,?,?)',[u.id,n,data.length,digest]);}});}finally{await fs.unlink(temp).catch(()=>{});}return response({ok:true,number:n});
  }
  if(operation==='complete'&&method==='POST'){
   const result=await withTransaction(async c=>{const [locked]=await rows(c,'SELECT * FROM v2_uploads WHERE id=? FOR UPDATE',[u.id]);const [existing]=await rows(c,"SELECT id FROM v2_jobs WHERE upload_id=? AND kind='import' LIMIT 1",[u.id]);if(existing)return existing.id;if(locked.state!=='uploading')fail('Sesi tidak dapat difinalisasi',409);const [count]=await rows(c,'SELECT COUNT(*) total FROM v2_parts WHERE upload_id=?',[u.id]);if(count.total!==u.parts)fail('Potongan belum lengkap',409);const jobId=id();await rows(c,"UPDATE v2_uploads SET state='queued' WHERE id=?",[u.id]);await rows(c,"INSERT INTO v2_jobs(id,actor_id,kind,upload_id) VALUES(?,?,'import',?)",[jobId,user.id,u.id]);return jobId;});return response({jobId:result});
  }
  if(method==='DELETE'){await query("UPDATE v2_uploads SET state='cancelled' WHERE id=? AND state='uploading'",[u.id]);return response({ok:true});}
 }
 if(area==='jobs'){
  if(!key&&method==='GET'){const jobs=await query('SELECT * FROM v2_jobs WHERE '+(user.role==='Super user'?'1=1':'actor_id=?')+' ORDER BY created_at DESC LIMIT 100',user.role==='Super user'?[]:[user.id]);return response({jobs:jobs.map(j=>({id:j.id,kind:j.kind,state:j.state,progress:j.progress,error:j.error,createdAt:j.created_at,target:j.target}))});}
  const [j]=await query('SELECT * FROM v2_jobs WHERE id=?',[uuid(key)]);if(!j||j.actor_id!==user.id&&user.role!=='Super user')fail('Job tidak ditemukan',404);
  const items=await query('SELECT id,original_path originalPath,state,stage,error,document_id documentId FROM v2_import_items WHERE job_id=? ORDER BY created_at',[j.id]);
  if(operation==='retry'&&method==='POST'){requireEditor(user);return response(await withTransaction(async c=>{const [job]=await rows(c,'SELECT * FROM v2_jobs WHERE id=? FOR UPDATE',[j.id]);if(!job||job.actor_id!==user.id&&user.role!=='Super user')fail('Job tidak ditemukan',404);if(!['done','failed','partial'].includes(job.state))fail('Proses masih berjalan',409);await rows(c,"UPDATE v2_jobs SET state='queued',error=NULL,attempts=0,lease_until=NULL WHERE id=?",[job.id]);await audit(c,user,req,'RETRY_JOB',null,{jobId:job.id});return {ok:true};}));}
  if(operation==='csv'&&method==='GET'){const escape=v=>'"'+String(v||'').replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"';const csv='\uFEFF'+[['File','Status','Tahap','Error'],...items.map(i=>[i.originalPath,i.state,i.stage,i.error])].map(line=>line.map(escape).join(',')).join('\r\n');return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="import-'+j.id+'.csv"','Cache-Control':'no-store'}});}
  if(operation==='resolve'&&method==='POST')return response(await resolveImportItem(j.id,await json(req),user,req));
  if(operation==='skip'&&method==='POST')return response(await skipImportItem(j.id,await json(req),user,req));
  return response({id:j.id,kind:j.kind,state:j.state,progress:j.progress,error:j.error,items});
 }
 if(area==='files'){
  const f=await getFile(key,user);
  if(operation==='convert'&&method==='POST'){
   requireEditor(user,{department:f.department});
   const data=await json(req);const target=data.target;if(!((f.extension==='pdf'&&target==='docx')||(['docx','xlsx'].includes(f.extension)&&target==='pdf')))fail('Arah konversi tidak didukung');const [existing]=await query('SELECT id FROM v2_files WHERE source_id=? AND extension=?',[f.id,target]);if(existing)return response({fileId:existing.id});const jobId=await withTransaction(async c=>{await rows(c,'SELECT id FROM v2_files WHERE id=? FOR UPDATE',[f.id]);const [old]=await rows(c,"SELECT id FROM v2_jobs WHERE source_id=? AND target=? AND state IN ('queued','running')",[f.id,target]);if(old)return old.id;const next=id();await rows(c,"INSERT INTO v2_jobs(id,actor_id,kind,source_id,target) VALUES(?,?,'convert',?,?)",[next,user.id,f.id,target]);await audit(c,user,req,'REQUEST_CONVERSION',f.document_id,{sourceId:f.id,target,jobId:next});return next;});return response({jobId});
  }
  if(operation==='ticket'&&method==='POST'){const data=await json(req);if(f.origin==='converted'&&f.extension==='docx'&&data.acknowledged!==true)fail('Peringatan konversi harus dikonfirmasi',400);await audit(null,user,req,'ACKNOWLEDGE_CONVERSION',f.document_id,{fileId:f.id});return response({ticket:await token({uid:user.id,fileId:f.id},'download','2m')});}
  if(method==='GET'){
   if(f.origin==='converted'&&f.extension==='docx'){try{const p=await verify(url.searchParams.get('ticket')||'','download');if(p.uid!==user.id||p.fileId!==f.id)throw new Error();}catch{fail('Konfirmasi peringatan konversi terlebih dahulu',403);}}
   const inline=url.searchParams.get('preview')==='1'&&f.extension==='pdf';await audit(null,user,req,inline?'PREVIEW':'DOWNLOAD',f.document_id,{fileId:f.id,version:f.number,origin:f.origin});const stat=await fs.stat(safePath(f.disk_path));return new Response(Readable.toWeb(createReadStream(safePath(f.disk_path))),{headers:{'Content-Type':mime(f.extension),'Content-Length':String(stat.size),'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
 }
 if(area==='audit'&&method==='GET'){const page=Math.max(1,Number(url.searchParams.get('page'))||1);const args=[],clauses=[];if(user.role!=='Super user'){clauses.push('actor_id=?');args.push(user.id);}if(url.searchParams.get('documentId')){const d=await document(uuid(url.searchParams.get('documentId')));if(!editable(user,d))fail('Tidak berhak melihat histori lengkap',403);clauses.push('document_id=?');args.push(d.id);}const where=clauses.length?' WHERE '+clauses.join(' AND '):'';const [count]=await query('SELECT COUNT(*) total FROM v2_audit'+where,args);return response({total:count.total,page,events:await query('SELECT id,actor_name actorName,action,document_id documentId,context_json context,created_at createdAt FROM v2_audit'+where+' ORDER BY id DESC LIMIT 30 OFFSET '+((page-1)*30),args)});}
 fail('Endpoint tidak ditemukan',404);
 }catch(e){if(e.code==='ER_DUP_ENTRY'){e.status=409;e.message='Username atau kode sudah digunakan';}const known=Number(e.status)||0;const status=known>=400&&known<600?known:503;if(!known)console.error('API error',e.code||e.name);return response({error:known?e.message:'Layanan belum siap. Periksa database/storage atau coba kembali.',...(known&&e.fields&&{fields:e.fields}),...(known&&e.loginRequired&&{loginRequired:true}),...(known&&e.versionChanged&&{versionChanged:true})},status);}}
