import {NextResponse} from 'next/server';
import {query,withTransaction,rows} from './db.mjs';
import {id,fail,text} from './core.mjs';
import {actor,audit,rate} from './security.mjs';
import {canManage,validateDefinition,validateAnswers,publicToken} from './forms.mjs';
import {flatten,toXlsx} from './form-export.mjs';
import {importDocx} from './form-import.mjs';
const ANON={id:null,fullName:'Anonim (link publik)'};
const SELECT='SELECT f.*,v.definition_json published_definition,v.title published_title,(SELECT COUNT(*) FROM v2_form_submissions s WHERE s.form_id=f.id AND s.deleted_at IS NULL) submissions FROM v2_forms f LEFT JOIN v2_form_versions v ON v.form_id=f.id AND v.version=f.published_version';
const uuid=v=>{if(!/^[a-f0-9-]{36}$/i.test(v||''))fail('ID tidak valid');return v;};
const department=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,160):null;
async function readJson(body,req,max){try{return JSON.parse((await body(req,max)).toString());}catch(e){if(e.status)throw e;fail('JSON tidak valid');}}
function mapForm(r){return {id:r.id,title:r.title,department:r.department,status:r.status,access:r.access,publicToken:r.public_token,publishedVersion:r.published_version,lockVersion:r.lock_version,submissions:Number(r.submissions||0),hasUnpublishedChanges:r.published_version!=null&&(r.published_definition!==r.definition_json||r.published_title!==r.title),createdAt:r.created_at,updatedAt:r.updated_at};}
async function load(formId,user){const [f]=await query(SELECT+' WHERE f.id=?',[uuid(formId)]);if(!f)fail('Form tidak ditemukan',404);if(!canManage(user,f))fail('Anda tidak berhak mengelola form ini',403);return f;}
async function submission(sid,user){const [s]=await query('SELECT s.*,f.department,f.title form_title,v.definition_json FROM v2_form_submissions s JOIN v2_forms f ON f.id=s.form_id JOIN v2_form_versions v ON v.form_id=s.form_id AND v.version=s.form_version WHERE s.id=? AND s.deleted_at IS NULL',[uuid(sid)]);if(!s)fail('Jawaban tidak ditemukan',404);if(!canManage(user,s))fail('Anda tidak berhak melihat jawaban ini',403);return s;}
function download(buffer,name,type){const ascii=name.replace(/[^\w.\-]+/g,'_');return new NextResponse(buffer,{headers:{'Content-Type':type,'Content-Disposition':`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'no-store'}});}

export async function publicForms(req,segments,{body,response}){
 const [area,key]=segments;if(area!=='public-forms')return null;
 if(!/^[a-f0-9]{32}$/.test(key||''))fail('Form tidak tersedia',404);
 const [f]=await query('SELECT f.id,f.access,f.status,f.published_version,v.definition_json,v.title FROM v2_forms f JOIN v2_form_versions v ON v.form_id=f.id AND v.version=f.published_version WHERE f.public_token=?',[key]);
 if(!f||f.status!=='published')fail('Form tidak tersedia',404);
 let user=null;
 if(f.access==='login'){try{user=await actor(req);}catch{const e=new Error('Silakan login untuk mengisi form ini');e.status=401;e.loginRequired=true;throw e;}}
 const definition=JSON.parse(f.definition_json);
 if(req.method==='GET')return response({title:f.title,definition,version:f.published_version,access:f.access,user:user&&{fullName:user.fullName}});
 if(req.method!=='POST')fail('Metode tidak didukung',405);
 const data=await readJson(body,req,3145728);
 if(data?.version!==undefined&&Number(data.version)!==f.published_version){const e=new Error('Form sudah diperbarui sejak halaman dibuka. Muat ulang halaman, lalu periksa kembali isian Anda.');e.status=409;e.versionChanged=true;throw e;}
 const answers=validateAnswers(definition,data?.answers);
 // Batasan: akses langsung ke NAS tanpa proxy berarti semua pengisi berbagi satu bucket IP;
 // kuota per form dan hanya untuk kiriman valid agar sesi pengisian massal tidak terblokir.
 await rate(req,'form-submit:'+key,200);
 const sid=id(),who=user||ANON,ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.slice(0,80)||null;
 await withTransaction(async c=>{const [live]=await rows(c,'SELECT status,published_version FROM v2_forms WHERE id=? LOCK IN SHARE MODE',[f.id]);if(!live||live.status!=='published')fail('Form tidak tersedia',404);await rows(c,'INSERT INTO v2_form_submissions(id,form_id,form_version,answers_json,submitter_id,submitter_label,ip) VALUES(?,?,?,?,?,?,?)',[sid,f.id,f.published_version,JSON.stringify(answers),user?.id??null,String(who.fullName).slice(0,160),ip]);await audit(c,who,req,'FORM_SUBMIT',null,{formId:f.id,submissionId:sid});});
 return response({id:sid},201);
}

export async function forms(req,segments,user,{body,response}){
 const [area,key,operation]=segments,method=req.method,url=new URL(req.url);
 if(area==='form-submissions'){
  const s=await submission(key,user);
  if(method==='GET')return response({id:s.id,formId:s.form_id,formTitle:s.form_title,formVersion:s.form_version,definition:JSON.parse(s.definition_json),answers:JSON.parse(s.answers_json),submitterLabel:s.submitter_label,flagged:!!s.flagged,flagNote:s.flag_note,createdAt:s.created_at});
  if(method==='PATCH'){const data=await readJson(body,req,8192),flagged=!!data?.flagged,note=flagged&&typeof data.flagNote==='string'?data.flagNote.trim().slice(0,500)||null:null;await withTransaction(async c=>{await rows(c,'UPDATE v2_form_submissions SET flagged=?,flag_note=? WHERE id=?',[flagged?1:0,note,s.id]);await audit(c,user,req,'FORM_SUBMISSION_FLAG',null,{formId:s.form_id,submissionId:s.id,flagged});});return response({ok:true});}
  if(method==='DELETE'){await withTransaction(async c=>{await rows(c,'UPDATE v2_form_submissions SET deleted_at=NOW(3),deleted_by=? WHERE id=? AND deleted_at IS NULL',[user.id,s.id]);await audit(c,user,req,'FORM_SUBMISSION_DELETE',null,{formId:s.form_id,submissionId:s.id});});return response({ok:true});}
  fail('Metode tidak didukung',405);
 }
 if(area!=='forms')return null;
 const creator=user.role==='Super user'||user.role==='Editor';
 if(!key){
  if(method==='GET')return response({forms:(await query(SELECT+' ORDER BY f.updated_at DESC')).filter(f=>canManage(user,f)).map(mapForm)});
  if(method==='POST'){
   if(!creator)fail('Anda tidak berhak membuat form',403);
   const data=await readJson(body,req,1048576),dept=user.role==='Super user'?department(data?.department):user.bidang;
   if(!canManage(user,{department:dept}))fail('Akun Editor belum memiliki bidang',403);
   const definition=validateDefinition(data?.definition||{schema:1,header:{},fields:[{id:'f1',type:'text',label:'Pertanyaan pertama'}]}),formId=id();
   await withTransaction(async c=>{await rows(c,'INSERT INTO v2_forms(id,title,department,public_token,definition_json,created_by,updated_by) VALUES(?,?,?,?,?,?,?)',[formId,text(data?.title,255),dept,publicToken(),JSON.stringify(definition),user.id,user.id]);await audit(c,user,req,'FORM_CREATE',null,{formId});});
   return response({id:formId},201);
  }
  fail('Metode tidak didukung',405);
 }
 if(key==='import'){if(method!=='POST')fail('Metode tidak didukung',405);if(!creator)fail('Anda tidak berhak membuat form',403);return response(await importDocx(await body(req,5242880)));}
 const f=await load(key,user);
 if(!operation){
  if(method==='GET')return response({...mapForm(f),definition:JSON.parse(f.definition_json)});
  if(method==='PUT'){
   const data=await readJson(body,req,1048576),definition=validateDefinition(data?.definition),expected=Number(data?.expectedVersion)||0;
   const dept=user.role==='Super user'?department(data?.department):f.department,access=data?.access==='public'?'public':'login';
   await withTransaction(async c=>{const r=await rows(c,'UPDATE v2_forms SET title=?,department=?,access=?,definition_json=?,updated_by=?,lock_version=lock_version+1 WHERE id=? AND lock_version=?',[text(data?.title,255),dept,access,JSON.stringify(definition),user.id,f.id,expected]);if(!r.affectedRows)fail('Form sudah diubah pengguna lain. Muat ulang sebelum menyimpan.',409);await audit(c,user,req,'FORM_UPDATE',null,{formId:f.id});});
   return response({lockVersion:expected+1});
  }
  if(method==='DELETE'){
   try{await withTransaction(async c=>{await rows(c,'SELECT id FROM v2_forms WHERE id=? FOR UPDATE',[f.id]);const [n]=await rows(c,'SELECT COUNT(*) n FROM v2_form_submissions WHERE form_id=?',[f.id]);if(Number(n.n)>0)fail('Form sudah memiliki jawaban. Tutup form sebagai gantinya.',409);await rows(c,'DELETE FROM v2_forms WHERE id=?',[f.id]);await audit(c,user,req,'FORM_DELETE',null,{formId:f.id,title:f.title});});}catch(e){if(e.code==='ER_ROW_IS_REFERENCED_2'||e.errno===1451)fail('Form sudah memiliki jawaban. Tutup form sebagai gantinya.',409);throw e;}
   return response({ok:true});
  }
  fail('Metode tidak didukung',405);
 }
 if(operation==='publish'&&method==='POST'){
  const version=await withTransaction(async c=>{
   const [cur]=await rows(c,'SELECT f.definition_json,f.title,f.published_version,v.definition_json published_definition,v.title published_title FROM v2_forms f LEFT JOIN v2_form_versions v ON v.form_id=f.id AND v.version=f.published_version WHERE f.id=? FOR UPDATE',[f.id]);
   validateDefinition(JSON.parse(cur.definition_json));
   let next=cur.published_version;
   if(!next||cur.published_definition!==cur.definition_json||cur.published_title!==cur.title){next=(next||0)+1;await rows(c,'INSERT INTO v2_form_versions(form_id,version,definition_json,title,published_by) VALUES(?,?,?,?,?)',[f.id,next,cur.definition_json,cur.title,user.id]);}
   await rows(c,"UPDATE v2_forms SET status='published',published_version=? WHERE id=?",[next,f.id]);
   await audit(c,user,req,'FORM_PUBLISH',null,{formId:f.id,version:next});
   return next;
  });
  return response({publishedVersion:version});
 }
 if(operation==='close'&&method==='POST'){
  if(f.status!=='published')fail('Hanya form yang dipublish yang dapat ditutup',409);
  await withTransaction(async c=>{await rows(c,"UPDATE v2_forms SET status='closed' WHERE id=?",[f.id]);await audit(c,user,req,'FORM_CLOSE',null,{formId:f.id});});
  return response({ok:true});
 }
 if(operation==='submissions'&&method==='GET'){
  const page=Math.max(1,Number(url.searchParams.get('page'))||1);
  const [count]=await query('SELECT COUNT(*) total FROM v2_form_submissions WHERE form_id=? AND deleted_at IS NULL',[f.id]);
  const list=await query('SELECT id,form_version formVersion,submitter_label submitterLabel,flagged,flag_note flagNote,created_at createdAt FROM v2_form_submissions WHERE form_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30 OFFSET '+((page-1)*30),[f.id]);
  return response({total:Number(count.total),page,submissions:list.map(s=>({...s,flagged:!!s.flagged}))});
 }
 if(operation==='export'&&method==='GET'){
  const format='xlsx';
  // Diambil per 200 baris; gambar tanda tangan diganti penanda true (ekspor hanya menulis "Ditandatangani") agar memori NAS tetap kecil.
  const subs=[];for(let offset=0;;offset+=200){const batch=await query('SELECT id,form_version,submitter_label,flagged,answers_json,created_at FROM v2_form_submissions WHERE form_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 200 OFFSET '+offset,[f.id]);for(const s of batch)subs.push({id:s.id,formVersion:s.form_version,submitterLabel:s.submitter_label,flagged:s.flagged,createdAt:s.created_at,answers:JSON.parse(s.answers_json,(k,v)=>k==='image'?!!v:v)});if(batch.length<200)break;}
  const used=new Set(subs.map(s=>s.formVersion));
  if(!used.size){if(!f.published_version)fail('Form belum pernah dipublish',409);used.add(f.published_version);}
  const versions=new Map((await query('SELECT version,definition_json FROM v2_form_versions WHERE form_id=?',[f.id])).filter(v=>used.has(v.version)).map(v=>[v.version,JSON.parse(v.definition_json)]));
  const table=flatten(versions,subs);
  await audit(null,user,req,'FORM_EXPORT',null,{formId:f.id,format,rows:subs.length});
  const name=`${f.title.slice(0,80)}-jawaban-${new Date().toISOString().slice(0,10).replaceAll('-','')}.${format}`;
  return download(await toXlsx(table),name,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 }
 if(operation==='print'&&method==='GET'){
  // ponytail: maksimal 300 jawaban per cetak (gambar tanda tangan ikut dimuat); tambah paging bila form melebihi itu.
  const subs=await query('SELECT id,form_version formVersion,submitter_label submitterLabel,answers_json,created_at createdAt FROM v2_form_submissions WHERE form_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 301',[f.id]);
  if(subs.length>300)fail('Jawaban lebih dari 300. Gunakan Download Excel atau cetak per jawaban.',413);
  const versions=new Map((await query('SELECT version,definition_json FROM v2_form_versions WHERE form_id=?',[f.id])).map(v=>[v.version,JSON.parse(v.definition_json)]));
  await audit(null,user,req,'FORM_EXPORT',null,{formId:f.id,format:'pdf',rows:subs.length});
  return response({title:f.title,submissions:subs.map(({answers_json,...s})=>({...s,definition:versions.get(s.formVersion),answers:JSON.parse(answers_json)}))});
 }
 fail('Endpoint form tidak ditemukan',404);
}
