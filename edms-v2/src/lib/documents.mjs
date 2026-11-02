import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import JSZip from 'jszip';
import {query,withTransaction,rows} from './db.mjs';
import {id,hash,safePath,extension,validName,text,fail,identity,editable} from './core.mjs';
import {audit} from './security.mjs';
import {resolveFilenameIdentity} from './filename-identity.mjs';
import {ensureImportFolders} from './import-folders.mjs';
import {requireMaster} from './masters.mjs';
import {departmentsMatch} from './document-classification.mjs';
import {extractDocumentDate} from './document-map.mjs';
export function mapDoc(r){return {id:r.id,code:r.code,title:r.title,department:r.department,kind:r.kind,category:r.category,ownerId:r.owner_id,activeVersion:r.active_version,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at,lockVersion:r.lock_version,testTag:r.test_tag,documentDate:r.document_date,dateStatus:r.date_status,mapParentId:r.map_parent_id};}
export function mapFile(r){return {id:r.id,versionId:r.version_id,name:r.name,extension:r.extension,origin:r.origin,sourceId:r.source_id,size:Number(r.size),sha256:r.sha256,note:r.note,createdAt:r.created_at};}
export async function document(docId){const [r]=await query('SELECT * FROM v2_documents WHERE id=?',[docId]);if(!r)fail('Dokumen tidak ditemukan',404);return mapDoc(r);}
export async function detail(docId,user){const d=await document(docId);if(d.status!=='Aktif'&&!editable(user,d))fail('Dokumen tidak dapat diakses',403);const versions=await query('SELECT v.*,u.full_name actor_name FROM v2_versions v JOIN users u ON u.id=v.actor_id WHERE document_id=? ORDER BY number DESC',[docId]);const files=await query('SELECT f.* FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=? ORDER BY f.created_at',[docId]);return {...d,canEdit:editable(user,d),versions:versions.filter(v=>v.number===d.activeVersion||editable(user,d)).map(v=>({id:v.id,number:v.number,revision:v.revision,title:v.title,summary:v.summary,actorName:v.actor_name,createdAt:v.created_at,files:files.filter(f=>f.version_id===v.id).map(mapFile)}))};}
export async function validateFile(file,name){const ext=extension(name);if(!['pdf','docx','xlsx'].includes(ext))fail('Format tidak didukung: '+ext);const stat=await fs.stat(file);if(!stat.size||stat.size>100*1024*1024)fail('File kosong atau lebih besar dari 100 MB');const data=await fs.readFile(file);if(ext==='pdf'){if(!data.subarray(0,1024).toString('latin1').includes('%PDF-')||!data.subarray(-2048).toString('latin1').includes('%%EOF'))fail('PDF rusak atau tidak valid');const {PDFParse}=await import('pdf-parse');const parser=new PDFParse({data});try{const info=await parser.getInfo();if(!info.total)fail('PDF tidak memiliki halaman');}catch{fail('Struktur PDF rusak atau dilindungi password');}finally{await parser.destroy();}}else{let z;try{z=await JSZip.loadAsync(data);}catch{fail('Struktur file Office rusak');}let inflated=0;if(Object.keys(z.files).length>5000)fail('Struktur Office terlalu besar');for(const entry of Object.values(z.files)){const size=Number(entry._data?.uncompressedSize||0),compressed=Number(entry._data?.compressedSize||1);inflated+=size;if(inflated>100*1024*1024||size>Math.max(1,compressed)*200)fail('Ukuran/rasio isi Office melebihi batas');if(/vbaProject|embeddings\//i.test(entry.name))fail('Macro/objek aktif tidak diizinkan');}if(!z.file('[Content_Types].xml')||!z.file(ext==='docx'?'word/document.xml':'xl/workbook.xml'))fail('File bukan '+ext.toUpperCase()+' yang valid');try{await JSZip.loadAsync(data,{checkCRC32:true});}catch{fail('Checksum isi Office tidak valid');}}return {extension:ext,size:stat.size,sha256:hash(data)};}
export async function publish(sourcePath,name,metadata,user,req,importContext={}){
 if(!editable(user))fail('Anda tidak memiliki hak menerbitkan dokumen',403);
 const info=await validateFile(sourcePath,name), newFileId=id(), originalPath=String(metadata.originalPath||name).slice(0,1100);
 const documentDate=await extractDocumentDate(sourcePath,info.extension);
 const inferred=metadata.documentId?null:resolveFilenameIdentity(name,metadata);
 const revision=inferred?.revision||metadata.revision||'0';
 const manualDepartment=metadata.manualDepartment===true&&!metadata.documentId;
 const inferredDepartment=manualDepartment?null:inferred?.department||null;
 const existingMetadata=metadata.documentId?await document(metadata.documentId):null;
 const chosenDepartment=existingMetadata?.department||inferredDepartment||text(metadata.department||user.bidang||'Umum',80);
 const chosenKind=inferred?.kind||text(metadata.kind||existingMetadata?.kind,80);
 if(!editable(user,{department:chosenDepartment}))fail('Dokumen berada di luar bidang akun Anda',403);
 if(metadata.mode!=='attach'&&!manualDepartment&&importContext.location?.department&&!departmentsMatch(importContext.location.department,chosenDepartment))fail('Bidang dokumen berbeda dari bidang folder ZIP',409);
 const relative='originals/'+newFileId+'.'+info.extension, destination=safePath(relative);await fs.copyFile(sourcePath,destination,fs.constants.COPYFILE_EXCL);
 try{const result=await withTransaction(async c=>{
  if(importContext.itemId){
   const [item]=await rows(c,'SELECT state,document_id,file_id FROM v2_import_items WHERE id=? FOR UPDATE',[importContext.itemId]);
   if(!item)fail('Item impor tidak ditemukan',409);
   if(item.state==='success')return {documentId:item.document_id,fileId:item.file_id};
  }
  const location=metadata.mode==='attach'?{category:'',relativePath:'',department:chosenDepartment}:(importContext.location||{category:String(metadata.category||''),relativePath:'',department:chosenDepartment});
  let folderId=null;
  if(location.category){const ensured=await ensureImportFolders(c,{...location,allowDepartmentOverride:manualDepartment},user,req);folderId=ensured.folderId;}
  if(manualDepartment)await audit(c,user,req,'MANUAL_IMPORT_DEPARTMENT',null,{itemId:importContext.itemId||null,originalPath,department:chosenDepartment,folderDepartment:importContext.location?.inferredDepartment||importContext.location?.department||null,category:location.category});
  await requireMaster('department',chosenDepartment,(sql,args)=>rows(c,sql,args));
  await requireMaster('kind',chosenKind,(sql,args)=>rows(c,sql,args));
  if(location.category)await requireMaster('category',location.category,(sql,args)=>rows(c,sql,args));
  let d,number=1,versionId=id(),documentId=metadata.documentId||id();
  if(metadata.documentId){const [raw]=await rows(c,'SELECT * FROM v2_documents WHERE id=? FOR UPDATE',[documentId]);if(!raw)fail('Dokumen tidak ditemukan',404);d=mapDoc(raw);if(d.status==='Sampah')fail('Pulihkan dokumen dari Sampah dahulu',409);if(!editable(user,d))fail('Tidak berhak mengubah dokumen',403);if(!Number.isInteger(metadata.expectedLockVersion)||metadata.expectedLockVersion!==raw.lock_version)fail('Metadata berubah. Muat ulang sebelum update.',409);if(Number(metadata.expectedVersion)!==d.activeVersion)fail('Versi telah berubah. Muat ulang sebelum update.',409);
   if(metadata.mode==='attach'){
    const [v]=await rows(c,'SELECT id,revision FROM v2_versions WHERE document_id=? AND number=?',[documentId,d.activeVersion]);if(String(metadata.revision)!==v.revision)fail('Revisi format pendamping harus sama',409);const existing=await rows(c,'SELECT id FROM v2_files WHERE version_id=? AND extension=? AND origin=?',[v.id,info.extension,'original']);if(existing.length)fail('Format asli sudah tersedia; gunakan update versi baru',409);versionId=v.id;number=d.activeVersion;
   }else{number=d.activeVersion+1;text(metadata.summary,2000);await rows(c,'UPDATE v2_documents SET lock_version=lock_version+1,active_version=?,title=?,document_date=?,date_status=?,date_source_file_id=?,updated_at=NOW(3) WHERE id=?',[number,text(metadata.title||d.title),documentDate.date,documentDate.status,documentDate.date?newFileId:null,documentId]);}
  }else{
   const guessed=inferred;const code=text(guessed.code||'DOC-'+newFileId.slice(0,8),160);
   await rows(c,'INSERT INTO v2_documents(id,code,title,department,kind,category,owner_id,test_tag,document_date,date_status,date_source_file_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[documentId,code,text(metadata.title||guessed.title),chosenDepartment,chosenKind,String(location.category||'').slice(0,500),user.id,metadata.testTag||null,documentDate.date,documentDate.status,documentDate.date?newFileId:null]);
  }
  if(metadata.mode!=='attach')await rows(c,'INSERT INTO v2_versions(id,document_id,number,revision,title,summary,actor_id) VALUES(?,?,?,?,?,?,?)',[versionId,documentId,number,String(revision).slice(0,40),text(metadata.title||d?.title||identity(name).title),metadata.documentId?text(metadata.summary,2000):String(metadata.summary||'Unggah awal').slice(0,2000),user.id]);
  await rows(c,'INSERT INTO v2_files(id,version_id,name,original_path,extension,disk_path,sha256,size) VALUES(?,?,?,?,?,?,?,?)',[newFileId,versionId,validName(name),originalPath,info.extension,relative,info.sha256,info.size]);
  if(metadata.mode==='attach'&&documentDate.date&&d?.dateStatus!=='verified'&&d?.documentDate===null)await rows(c,'UPDATE v2_documents SET document_date=?,date_status=?,date_source_file_id=? WHERE id=?',[documentDate.date,documentDate.status,newFileId,documentId]);
  if(folderId&&metadata.mode!=='attach')await rows(c,'INSERT INTO v2_document_folders(document_id,folder_id) VALUES(?,?)',[documentId,folderId]);
  if(metadata.mode!=='attach'){const [snapshot]=await rows(c,'SELECT code,title,department,kind,category,document_date documentDate,date_status dateStatus,map_parent_id mapParentId FROM v2_documents WHERE id=?',[documentId]);await rows(c,'UPDATE v2_versions SET snapshot_json=? WHERE id=?',[JSON.stringify(snapshot),versionId]);}else await rows(c,'UPDATE v2_documents SET lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?',[documentId]);
  await audit(c,user,req,metadata.mode==='attach'?'ATTACH_FORMAT':metadata.documentId?'UPDATE_DOCUMENT':'CREATE_DOCUMENT',documentId,{version:number,fileId:newFileId,sha256:info.sha256,summary:metadata.summary||'Unggah awal'});
  if(importContext.itemId)await rows(c,"UPDATE v2_import_items SET state='success',error=NULL,document_id=?,file_id=? WHERE id=?",[documentId,newFileId,importContext.itemId]);
  return {documentId,fileId:newFileId,version:number};
 });if(result.fileId!==newFileId)await fs.unlink(destination);return result;}catch(e){await fs.unlink(destination).catch(()=>{});throw e;}
}
export async function listDocuments(url,user){const page=Math.max(1,Number(url.searchParams.get('page'))||1),limit=20;const args=[],clauses=["d.status='Aktif'"];for(const [field,param] of [['department','department'],['kind','kind']]){const value=url.searchParams.get(param);if(value){clauses.push('d.'+field+(field==='department'?' LIKE ?':'=?'));args.push(field==='department'?'%'+value+'%':value);}}const search=url.searchParams.get('search')?.trim();if(search){clauses.push('(d.code LIKE ? OR d.title LIKE ? OR d.category LIKE ?)');args.push(...Array(3).fill('%'+search+'%'));}const where=clauses.join(' AND ');const [count]=await query('SELECT COUNT(*) total FROM v2_documents d WHERE '+where,args);const results=await query('SELECT d.*,u.full_name owner_name FROM v2_documents d JOIN users u ON u.id=d.owner_id WHERE '+where+' ORDER BY d.updated_at DESC LIMIT '+limit+' OFFSET '+((page-1)*limit),args);return {documents:results.map(r=>({...mapDoc(r),ownerName:r.owner_name,canEdit:editable(user,mapDoc(r))})),page,total:count.total,pages:Math.ceil(count.total/limit)};}
export async function uploadedFile(user,uploadId){const [u]=await query('SELECT * FROM v2_uploads WHERE id=? AND actor_id=?',[uploadId,user.id]);if(!u)fail('Sesi upload tidak ditemukan',404);if(new Date(u.expires_at).getTime()<Date.now())fail('Sesi upload kedaluwarsa',410);return u;}
export async function assemble(upload){const directory=safePath('staging/'+upload.id);const destination=path.join(directory,'source');const temp=path.join(directory,'assembling-'+id());const out=await fs.open(temp,'wx');try{for(let part=0;part<upload.parts;part++){const [p]=await query('SELECT * FROM v2_parts WHERE upload_id=? AND number=?',[upload.id,part]);if(!p)fail('Potongan upload belum lengkap',409);const buf=await fs.readFile(path.join(directory,String(part)));if(hash(buf)!==p.sha256)fail('Checksum potongan tidak cocok',409);await out.writeFile(buf);}await out.close();if((await fs.stat(temp)).size!==Number(upload.size))fail('Ukuran upload tidak cocok');await fs.rename(temp,destination);return destination;}catch(e){await out.close().catch(()=>{});await fs.unlink(temp).catch(()=>{});throw e;}}
