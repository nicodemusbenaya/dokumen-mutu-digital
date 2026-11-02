import bcrypt from 'bcryptjs';
import {query,rows,withTransaction} from './db.mjs';
import {id,text,fail,editable} from './core.mjs';
import {mapDoc} from './documents.mjs';
import {audit,requireEditor} from './security.mjs';
import {requireMaster} from './masters.mjs';

export const kinds=['Manual Mutu','SOP/Prosedur','Instruksi Kerja','Formulir Mutu','Lampiran'];
export function admin(user){if(user.role!=='Super user')fail('Hanya Super user yang diizinkan',403);}
export function uuid(value){if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value||''))fail('ID tidak valid');return value;}
export function filters(url,user){
 const args=[],clauses=[];const status=url.searchParams.get('status')||'Aktif';
 if(!['Aktif','Diarsipkan','Sampah'].includes(status))fail('Status tidak valid');
 clauses.push('d.status=?');args.push(status);
 if(status!=='Aktif'&&user.role!=='Super user'){clauses.push('d.department=?');args.push(user.bidang||'');if(!editable(user))clauses.push('1=0');}
 for(const field of ['kind','department','category']){const value=url.searchParams.get(field);if(value){clauses.push('d.'+field+(field==='department'||field==='category'?' LIKE ?':'=?'));args.push(field==='department'||field==='category'?'%'+value+'%':value);}}
 const search=url.searchParams.get('search')?.trim();if(search){clauses.push('(d.code LIKE ? OR d.title LIKE ? OR d.category LIKE ?)');args.push(...Array(3).fill('%'+search+'%'));}
 const ext=url.searchParams.get('extension');if(ext){if(!['pdf','docx','xlsx'].includes(ext))fail('Format tidak valid');clauses.push('EXISTS(SELECT 1 FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=d.id AND v.number=d.active_version AND f.extension=?)');args.push(ext);}
 for(const [param,op] of [['from','>='],['to','<=']]){const value=url.searchParams.get(param);if(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value)))fail('Tanggal tidak valid');clauses.push('DATE(d.updated_at)'+op+'?');args.push(value);}}
 const sort={updated:'d.updated_at DESC,d.id',oldest:'d.updated_at ASC,d.id',title:'d.title ASC,d.id',code:'d.code ASC,d.id'}[url.searchParams.get('sort')||'updated'];if(!sort)fail('Urutan tidak valid');
 return {where:clauses.join(' AND '),args,sort};
}
export async function register(url,user){const f=filters(url,user),page=Math.max(1,Math.min(100000,Math.trunc(Number(url.searchParams.get('page')))||1));const [count]=await query('SELECT COUNT(*) total FROM v2_documents d WHERE '+f.where,f.args);const docs=await query('SELECT d.* FROM v2_documents d WHERE '+f.where+' ORDER BY '+f.sort+' LIMIT 20 OFFSET '+((page-1)*20),f.args);return {documents:docs.map(r=>({...mapDoc(r),lockVersion:r.lock_version,canEdit:editable(user,mapDoc(r))})),total:Number(count.total),pages:Math.ceil(Number(count.total)/20),page};}
export function targets(data){if(!Array.isArray(data.documents)||!data.documents.length||data.documents.length>500)fail('Pilih 1–500 dokumen');const seen=new Set();return data.documents.map(d=>{uuid(d.id);if(seen.has(d.id))fail('Pilihan dokumen berulang');seen.add(d.id);if(!Number.isInteger(d.lockVersion)||!Number.isInteger(d.expectedVersion))fail('Muat ulang pilihan dokumen',409);return d;}).sort((a,b)=>a.id.localeCompare(b.id));}
export async function mutateDocument(target,action,data,user,req){return withTransaction(async c=>{
 const [raw]=await rows(c,'SELECT * FROM v2_documents WHERE id=? FOR UPDATE',[uuid(target.id)]);if(!raw)fail('Dokumen tidak ditemukan',404);const doc=mapDoc(raw);requireEditor(user,doc);
 if(raw.lock_version!==target.lockVersion||raw.active_version!==target.expectedVersion)fail('Dokumen berubah. Muat ulang sebelum melanjutkan.',409);
 const reason=text(data.reason,2000);let patch;
 if(action==='metadata'){
  if(doc.status==='Sampah')fail('Pulihkan dokumen dari Sampah dahulu',409);
  const department=data.department===undefined?doc.department:text(data.department,80);if(department!==doc.department)admin(user);
  const kind=data.kind===undefined?doc.kind:text(data.kind,80);
  const category=data.category===undefined?doc.category:String(data.category).trim();if(category.length>500)fail('Kategori terlalu panjang');
  for(const [field,value] of Object.entries({kind,department,category}))if(value!==doc[field])await requireMaster(field,value,(sql,args)=>rows(c,sql,args));
  patch={code:data.code===undefined?doc.code:text(data.code,160),title:data.title===undefined?doc.title:text(data.title,500),department,kind,category};
  await rows(c,'UPDATE v2_documents SET code=?,title=?,department=?,kind=?,category=? WHERE id=?',[...Object.values(patch),doc.id]);
 }else if(['trash','archive','unarchive','untrash'].includes(action)){
  if(action==='untrash'&&doc.status!=='Sampah'||action!=='untrash'&&doc.status==='Sampah')fail('Status dokumen berubah',409);
  const status={trash:'Sampah',archive:'Diarsipkan',unarchive:'Aktif',untrash:raw.previous_status||'Aktif'}[action];
  await rows(c,'UPDATE v2_documents SET previous_status=?,status=? WHERE id=?',[action==='trash'?doc.status:null,status,doc.id]);patch={status};
 }else if(action==='restore-version'){
  if(doc.status!=='Aktif')fail('Aktifkan dokumen sebelum memulihkan versi',409);
  const [source]=await rows(c,'SELECT * FROM v2_versions WHERE document_id=? AND number=?',[doc.id,Number(data.version)]);if(!source)fail('Versi sumber tidak ditemukan',404);
  const versionId=id(),number=doc.activeVersion+1;
  const snapshot=source.snapshot_json?JSON.parse(source.snapshot_json):{code:doc.code,title:source.title,department:doc.department,kind:doc.kind,category:doc.category};
  await rows(c,'INSERT INTO v2_versions(id,document_id,number,revision,title,summary,actor_id) VALUES(?,?,?,?,?,?,?)',[versionId,doc.id,number,source.revision,source.title,'Pemulihan versi '+source.number+': '+reason,user.id]);
  const files=await rows(c,'SELECT * FROM v2_files WHERE version_id=? ORDER BY origin DESC',[source.id]);if(!files.length)fail('Versi tidak memiliki file',409);
  const ids=new Map(files.map(f=>[f.id,id()]));
  for(const f of files)await rows(c,'INSERT INTO v2_files(id,version_id,name,original_path,extension,origin,source_id,disk_path,sha256,size,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[ids.get(f.id),versionId,f.name,f.original_path,f.extension,f.origin,ids.get(f.source_id)||null,f.disk_path,f.sha256,f.size,f.note]);
  if(snapshot.department!==doc.department)admin(user);
  await rows(c,'UPDATE v2_documents SET active_version=?,code=?,title=?,department=?,kind=?,category=?,document_date=?,date_status=?,date_source_file_id=NULL WHERE id=?',[number,snapshot.code,snapshot.title,snapshot.department,snapshot.kind,snapshot.category,snapshot.documentDate||null,snapshot.dateStatus||'missing',doc.id]);
  await rows(c,'UPDATE v2_versions SET snapshot_json=? WHERE id=?',[JSON.stringify(snapshot),versionId]);patch={sourceVersion:source.number,newVersion:number,snapshot};
 }else fail('Aksi tidak didukung');
 await rows(c,'UPDATE v2_documents SET lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?',[doc.id]);await audit(c,user,req,action.toUpperCase().replaceAll('-','_'),doc.id,{reason,before:doc,after:patch});return {id:doc.id,ok:true};
});}
export async function manageUsers(method,key,data,user,req){admin(user);
 if(method==='GET'){return {users:await query('SELECT u.id,u.username,u.full_name fullName,u.bidang,u.is_active isActive,u.role_id roleId,r.name role FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.username'),roles:await query('SELECT id,name FROM roles ORDER BY name')};}
 const roleId=Number(data.roleId);const [role]=await query('SELECT id,name FROM roles WHERE id=?',[roleId]);if(!role)fail('Role tidak valid');
 if(!['Super user','Editor','Viewer'].includes(role.name))fail('Role tidak valid');
 const fullName=text(data.fullName,120),bidang=role.name==='Editor'?text(data.bidang,80):text(data.bidang||'Umum',80),isActive=data.isActive===false?0:1;
 if(role.name==='Editor')await requireMaster('department',bidang);
 const password=data.password;if((!key||password)&& (typeof password!=='string'||password.length<8||password.length>200))fail('Password minimal 8 dan maksimal 200 karakter');
 const passwordHash=password?await bcrypt.hash(password,12):null;
 return withTransaction(async c=>{
  // Serialize account changes so two administrators cannot disable each other simultaneously.
  await rows(c,"SELECT id FROM roles WHERE name='Super user' FOR UPDATE");
  if(!key){const username=text(data.username,60);if(!/^[A-Za-z0-9_.-]+$/.test(username))fail('Username hanya huruf, angka, titik, _ atau -');const result=await rows(c,'INSERT INTO users(username,full_name,password_hash,role_id,bidang,is_active) VALUES(?,?,?,?,?,?)',[username,fullName,passwordHash,roleId,bidang,isActive]);await audit(c,user,req,'CREATE_USER',null,{userId:result.insertId,username,roleId});return {ok:true,id:result.insertId};}
  const uid=Number(key);if(!Number.isSafeInteger(uid)||uid<=0)fail('ID user tidak valid');const [old]=await rows(c,'SELECT * FROM users WHERE id=? FOR UPDATE',[uid]);if(!old)fail('User tidak ditemukan',404);
  const [adminRole]=await rows(c,"SELECT id FROM roles WHERE name='Super user'");
  if(uid===user.id&&(!isActive||roleId!==adminRole.id))fail('Tidak dapat menonaktifkan atau menurunkan role akun sendiri');
  if(old.role_id===adminRole.id&&old.is_active&&(!isActive||roleId!==adminRole.id)){const [count]=await rows(c,'SELECT COUNT(*) n FROM users WHERE role_id=? AND is_active=1',[adminRole.id]);if(Number(count.n)<=1)fail('Minimal satu Admin aktif wajib tersedia');}
  await rows(c,'UPDATE users SET full_name=?,bidang=?,role_id=?,is_active=?'+(passwordHash?',password_hash=?':'')+' WHERE id=?',[fullName,bidang,roleId,isActive,...(passwordHash?[passwordHash]:[]),uid]);await audit(c,user,req,'UPDATE_USER',null,{userId:uid,roleId,isActive,passwordReset:!!passwordHash});return {ok:true};
 });
}
