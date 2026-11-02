import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import {Readable} from 'node:stream';
import {query} from './db.mjs';
import {id,fail,safePath,editable} from './core.mjs';
import {audit,requireEditor,rate} from './security.mjs';
import {admin,uuid,register,targets,mutateDocument,manageUsers} from './management.mjs';
import {permanentlyDelete} from './permanent-delete.mjs';
import {masterList,saveMaster} from './masters.mjs';
import {manageFolders} from './folder-api.mjs';
export async function management(req,segments,user,json,response){
 const [area,key]=segments,method=req.method,url=new URL(req.url);
 if(area==='folders'||area==='document-location')return manageFolders(req,segments,user,json,response);
 if(area==='masters'){
  if(method==='GET'&&!key)return response(await masterList(user));
  if(method==='POST'&&!key||method==='PATCH'&&key){admin(user);const data=await json(req);try{return response(await saveMaster(key?uuid(key):null,data,user,req));}catch(e){if(e.code==='ER_DUP_ENTRY')fail('Nilai master sudah terdaftar. Edit atau aktifkan kembali nilai yang ada.',409);throw e;}}
  fail('Metode master tidak didukung',405);
 }
 if(area==='register'&&method==='GET')return response(await register(url,user));
 if(area==='users'){if(!['GET','POST','PATCH'].includes(method)||method==='POST'&&key||method==='PATCH'&&!key)fail('Metode tidak didukung',405);return response(await manageUsers(method,key,method==='GET'?{}:await json(req),user,req));}
 if(area==='document-actions'&&method==='POST'){
  requireEditor(user);const data=await json(req),selection=targets(data);if(!['metadata','trash','archive','unarchive','untrash','restore-version','permanent-delete'].includes(data.action))fail('Aksi tidak valid');
  if(data.action==='permanent-delete'){admin(user);if(selection.length>20)fail('Hapus permanen maksimal 20 dokumen per tindakan');await rate(req,'permanent-delete:'+user.id,6);}
  const results=[];for(const target of selection){try{results.push(await(data.action==='permanent-delete'?permanentlyDelete(target,data,user,req):mutateDocument(target,data.action,data,user,req)));}catch(e){results.push({id:target.id,ok:false,status:e.status||400,error:e.code==='ER_DUP_ENTRY'?'Kode sudah digunakan':e.status?e.message:'Perubahan gagal; coba ulang'});}}
  return response({results});
 }
 if(area==='duplicates'&&method==='GET'){
  requireEditor(user);const page=Math.max(1,Math.trunc(Number(url.searchParams.get('page')))||1);const mode=url.searchParams.get('mode')||'hash';if(!['hash','title'].includes(mode))fail('Jenis pemeriksaan tidak valid');
  const args=[],permission=user.role==='Super user'?'':(args.push(user.bidang||''),' AND d.department=?');
  // Only compare original files of current, non-trashed documents. Historical copies are not duplicates.
  const base=" FROM v2_documents d JOIN v2_versions v ON v.document_id=d.id AND v.number=d.active_version JOIN v2_files f ON f.version_id=v.id AND f.origin='original' WHERE d.status<>'Sampah'"+permission;
  const group=mode==='hash'?'f.sha256':'LOWER(TRIM(d.title))';
  const groups=await query('SELECT '+group+' value,COUNT(DISTINCT d.id) count'+base+' GROUP BY '+group+' HAVING COUNT(DISTINCT d.id)>1 ORDER BY count DESC,value LIMIT 21 OFFSET '+((page-1)*20),args);
  const more=groups.length>20;groups.splice(20);for(const g of groups){const members=await query('SELECT DISTINCT d.id,d.code,d.title,d.active_version activeVersion,f.name,f.extension'+base+' AND '+group+'=? ORDER BY d.code',[...args,g.value]);g.documents=members;}
  return response({groups,page,more,mode,note:mode==='hash'?'Isi file identik berdasarkan SHA-256':'Judul sama; perlu pemeriksaan manual, tidak digabung otomatis'});
 }
 if(area==='exports'){
  if(!['GET','POST'].includes(method))fail('Metode tidak didukung',405);
  if(method==='POST'){
   await rate(req,'export:'+user.id,12);
   const data=await json(req),selection=targets(data),manifest=[];let bytes=0;
   for(const target of selection){const [d]=await query('SELECT * FROM v2_documents WHERE id=?',[target.id]);if(!d||d.status==='Sampah'||d.status!=='Aktif'&&!editable(user,{ownerId:d.owner_id,department:d.department}))fail('Dokumen tidak dapat diunduh',403);if(d.lock_version!==target.lockVersion||d.active_version!==target.expectedVersion)fail('Pilihan berubah. Muat ulang.',409);
    const files=await query("SELECT f.* FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=? AND v.number=? AND f.origin='original'",[d.id,d.active_version]);
    for(const f of files){bytes+=Number(f.size);manifest.push({documentId:d.id,version:d.active_version,fileId:f.id,path:f.disk_path,name:d.id+'/'+f.id+'-'+f.name});}
   }
   if(!manifest.length||manifest.length>1000||bytes>512*1024*1024)fail('ZIP maksimal 1.000 file atau 512 MB; perkecil pilihan');
   const [pending]=await query("SELECT COUNT(*) n FROM v2_exports WHERE actor_id=? AND state IN ('queued','running')",[user.id]);if(Number(pending.n)>=2)fail('Tunggu ekspor sebelumnya selesai',429);
   const exportId=id();await query('INSERT INTO v2_exports(id,actor_id,manifest_json,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 24 HOUR))',[exportId,user.id,JSON.stringify(manifest)]);await audit(null,user,req,'EXPORT_REQUEST',null,{exportId,documents:selection.length,files:manifest.length,bytes});return response({id:exportId,state:'queued'});
  }
  const [e]=await query('SELECT * FROM v2_exports WHERE id=? AND actor_id=? AND expires_at>NOW()',[uuid(key),user.id]);if(!e)fail('Ekspor tidak ditemukan atau kedaluwarsa',404);
  if(url.searchParams.get('download')==='1'){
   if(e.state!=='done')fail('ZIP belum siap',409);
   for(const f of JSON.parse(e.manifest_json)){const [d]=await query('SELECT * FROM v2_documents WHERE id=?',[f.documentId]);if(!d||d.status==='Sampah'||(d.active_version!==f.version||d.status!=='Aktif')&&!editable(user,{ownerId:d.owner_id,department:d.department}))fail('Izin dokumen berubah; buat ekspor baru',403);}
   const file=safePath('work/export-'+e.id+'.zip'),stat=await fs.stat(file);await audit(null,user,req,'EXPORT_DOWNLOAD',null,{exportId:e.id});return new Response(Readable.toWeb(createReadStream(file)),{headers:{'Content-Type':'application/zip','Content-Length':String(stat.size),'Content-Disposition':'attachment; filename="dokumen-'+e.id+'.zip"','Cache-Control':'private, no-store'}});
  }
  return response({id:e.id,state:e.state,error:e.error});
 }
 return null;
}
