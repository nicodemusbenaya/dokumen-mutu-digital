import fs from 'node:fs/promises';
import JSZip from 'jszip';
import {query,withTransaction,rows} from './db.mjs';
import {audit} from './security.mjs';
import {fail,safePath} from './core.mjs';
import {filenameIdentity} from './filename-identity.mjs';

const months={januari:1,februari:2,maret:3,april:4,mei:5,juni:6,juli:7,agustus:8,september:9,oktober:10,november:11,desember:12};
export function documentLevel(doc){
 const code=String(doc.code||'').toUpperCase(),kind=String(doc.kind||'').toLowerCase();
 const attachmentFolder=/(?:^|[^A-Z0-9])MM(?:$|[^A-Z0-9])/i.test(String(doc.category||''))&&
  String(doc.folderPath||'').split('/').some(part=>/^lampiran$/i.test(part));
 if(kind==='lampiran'||filenameIdentity(doc.fileName||doc.title||'').kind==='Lampiran'||attachmentFolder)return 5;
 if(/^MAN(?:\.|-|$)/.test(code)||/manual mutu|^dokumen mutu$/.test(kind))return 1;
 if(/^PR(?:\.|-|$)/.test(code)||/prosedur|\bsop\b/.test(kind))return 2;
 if(/^IK(?:\.|-|$)/.test(code)||/instruksi kerja/.test(kind))return 3;
 if(/^FR(?:\.|-|$)/.test(code)||/formulir/.test(kind))return 4;
 return null;
}
function procedureKey(code){const m=String(code||'').toUpperCase().match(/^PR\.UPS\.([A-Z0-9]+)\.(BMK|BMA|BST)\.(\d{2})-\d{2}$/);return m?m.slice(1).join('|'):null;}
function formProcedureKey(code){const m=String(code||'').toUpperCase().match(/^FR\.UPS\.([A-Z0-9]+)\.(BMK|BMA|BST)\.(\d{2})\.[A-Z0-9]+-\d{2}$/);return m?m.slice(1).join('|'):null;}
export function inferMapParents(documents){
 const byId=new Map(documents.map(d=>[d.id,d]));
 const roots=documents.filter(d=>documentLevel(d)===1);
 const namedRoots=roots.filter(d=>/^MAN(?:\.|-|$)/i.test(String(d.code||''))||/^(?:dokumen mutu|manual mutu|pedoman sistem manajemen mutu)\b/i.test(String(d.title||'')));
 const root=roots.length===1?roots[0]:namedRoots.length===1?namedRoots[0]:null;
 const procedures=new Map();
 for(const doc of documents){const key=procedureKey(doc.code);if(key){const candidates=procedures.get(key)||[];candidates.push(doc);procedures.set(key,candidates);}}
 return documents.map(doc=>{
  const level=documentLevel(doc),explicit=doc.parentId?byId.get(doc.parentId):null;
  if(doc.parentId){
   const parentLevel=explicit&&documentLevel(explicit),valid=parentLevel===level-1||level===4&&parentLevel===2||level===5&&parentLevel===1;
   return {...doc,parentId:valid?explicit.id:null,relationSource:valid?'manual':'needs_review',relationNote:valid?null:'Induk manual tidak aktif atau levelnya berubah'};
  }
  if(root&&(level===2||level===5&&doc.category&&doc.category===root.category))return {...doc,parentId:root.id,relationSource:'automatic',relationNote:level===5?'Lampiran dalam kategori Dokumen Mutu':'Dokumen Mutu induk teridentifikasi'};
  if(level===4){
   const key=formProcedureKey(doc.code),candidates=key?procedures.get(key)||[]:[];
   if(candidates.length===1)return {...doc,parentId:candidates[0].id,relationSource:'automatic',relationNote:'Kode fungsi, bidang, dan nomor prosedur cocok'};
   if(candidates.length>1)return {...doc,parentId:null,relationSource:'needs_review',relationNote:'Lebih dari satu prosedur berkode sama'};
  }
  return {...doc,parentId:null,relationSource:'unlinked',relationNote:level===3?'Kode IK tidak memuat induk prosedur secara tegas':null};
 });
}
function isoDate(day,month,year){
 const d=new Date(Date.UTC(year,month-1,day));
 return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day&&year>=1900&&year<=2100
  ?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;
}
export function dateCandidates(text){
 const found=new Set();
 for(const m of text.matchAll(/\b(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})\b/gi)){
  const value=isoDate(Number(m[1]),months[m[2].toLowerCase()],Number(m[3]));if(value)found.add(value);
 }
 for(const m of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g)){
  const value=isoDate(Number(m[1]),Number(m[2]),Number(m[3]));if(value)found.add(value);
 }
 return [...found];
}
function xmlText(xml){return [...xml.matchAll(/<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>m[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')).join(' ');}
export async function extractDocumentDate(file,extension){
 try{
  let text='';
  if(extension==='docx'){
   const zip=await JSZip.loadAsync(await fs.readFile(file));
   const document=await zip.file('word/document.xml')?.async('string');
   if(!document)return {date:null,status:'missing'};
   const paragraphs=[...document.matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)].slice(0,140).map(m=>xmlText(m[0]));
   const history=paragraphs.findIndex(p=>/riwayat\s+(perubahan|revisi)/i.test(p));
   text=paragraphs.slice(0,history>=0?history:60).join(' ');
   for(const name of Object.keys(zip.files).filter(n=>/^word\/header\d+\.xml$/.test(n))){text+=' '+xmlText(await zip.file(name).async('string'));}
  }else if(extension==='pdf'){
   const {PDFParse}=await import('pdf-parse');
   const parser=new PDFParse({data:await fs.readFile(file)});
   try{text=(await parser.getText({partial:[1]})).text||'';}finally{await parser.destroy();}
  }else return {date:null,status:'missing'};
  const candidates=dateCandidates(text);
  return candidates.length===1?{date:candidates[0],status:'extracted'}:{date:null,status:candidates.length?'needs_review':'missing'};
 }catch{return {date:null,status:'missing'};}
}
export async function listDocumentMap(){
 const records=await query("SELECT d.id,d.code,d.title,d.kind,d.department,d.category,d.map_parent_id parentId,d.document_date documentDate,d.date_status dateStatus,d.active_version activeVersion,d.lock_version lockVersion,n.relative_path folderPath,(SELECT f.name FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=d.id AND v.number=d.active_version AND f.origin='original' ORDER BY f.created_at LIMIT 1) fileName FROM v2_documents d LEFT JOIN v2_document_folders df ON df.document_id=d.id LEFT JOIN v2_folder_nodes n ON n.id=df.folder_id WHERE d.status='Aktif' ORDER BY d.title,d.id");
 return {documents:inferMapParents(records).map(d=>({...d,level:documentLevel(d)}))};
}
export async function updateDocumentMap(id,data,user,req){
 if(user.role!=='Super user')fail('Hanya admin yang dapat mengatur Peta Dokumen',403);
 if(!/^[a-f0-9-]{36}$/i.test(id))fail('ID dokumen tidak valid');
 return withTransaction(async c=>{
  const [doc]=await rows(c,"SELECT id,code,title,kind,category,lock_version,map_parent_id,document_date,date_status FROM v2_documents WHERE id=? AND status='Aktif' FOR UPDATE",[id]);
  if(!doc)fail('Dokumen aktif tidak ditemukan',404);
  const [location]=await rows(c,'SELECT n.relative_path folderPath FROM v2_document_folders df JOIN v2_folder_nodes n ON n.id=df.folder_id WHERE df.document_id=?',[id]);
  doc.folderPath=location?.folderPath||'';
  const [sourceFile]=await rows(c,"SELECT f.name fileName FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=? AND v.number=(SELECT active_version FROM v2_documents WHERE id=?) AND f.origin='original' ORDER BY f.created_at LIMIT 1",[id,id]);
  doc.fileName=sourceFile?.fileName||'';
  if(Number(data.lockVersion)!==doc.lock_version)fail('Peta Dokumen berubah. Muat ulang sebelum menyimpan.',409);
  const level=documentLevel(doc);if(!level)fail('Jenis dokumen belum memiliki level peta',409);
  const parentId=data.parentId===null?null:String(data.parentId||'');
  if(parentId&&(!/^[a-f0-9-]{36}$/i.test(parentId)||parentId===id))fail('Induk dokumen tidak valid');
  if(parentId){
   const [parent]=await rows(c,"SELECT id,code,title,kind,category FROM v2_documents WHERE id=? AND status='Aktif'",[parentId]);
   const parentLevel=parent&&documentLevel(parent);
   if(!parent||parentLevel!==level-1&&!(level===4&&parentLevel===2)&&!(level===5&&parentLevel===1))fail('Induk harus berada pada level di atasnya; Lampiran terkait Dokumen Mutu',409);
  }
  let date=null,status='missing';
  if(data.documentDate!==null&&data.documentDate!==undefined&&data.documentDate!==''){
   if(typeof data.documentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.documentDate))fail('Tanggal harus berformat YYYY-MM-DD');
   const [year,month,day]=data.documentDate.split('-').map(Number);
   date=isoDate(day,month,year);if(date!==data.documentDate)fail('Tanggal dokumen tidak valid');
   status='verified';
  }
  await rows(c,'UPDATE v2_documents SET map_parent_id=?,document_date=?,date_status=?,date_source_file_id=NULL,lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?',[parentId,date,status,id]);
  await audit(c,user,req,'UPDATE_DOCUMENT_MAP',id,{before:{parentId:doc.map_parent_id,date:doc.document_date,status:doc.date_status},after:{parentId,date,status}});
  return {ok:true};
 });
}
export async function readRegisteredDocumentDate(id,user,req){
 if(user.role!=='Super user')fail('Hanya admin yang dapat memeriksa tanggal dokumen',403);
 if(!/^[a-f0-9-]{36}$/i.test(id))fail('ID dokumen tidak valid');
 const [doc]=await query("SELECT id,lock_version,date_status FROM v2_documents WHERE id=? AND status='Aktif'",[id]);
 if(!doc)fail('Dokumen aktif tidak ditemukan',404);
 const files=await query("SELECT f.id,f.disk_path,f.extension,f.size FROM v2_files f JOIN v2_versions v ON v.id=f.version_id JOIN v2_documents d ON d.id=v.document_id WHERE d.id=? AND v.number=d.active_version AND f.origin='original' AND f.extension IN ('docx','pdf') ORDER BY CASE f.extension WHEN 'docx' THEN 0 ELSE 1 END,f.created_at LIMIT 4",[id]);
 const found=new Map();
 for(const file of files){
  if(Number(file.size)>30*1024*1024)continue;
  const result=await extractDocumentDate(safePath(file.disk_path),file.extension);
  if(result.date)found.set(result.date,file.id);
 }
 const values=[...found.keys()],date=values.length===1?values[0]:null,status=values.length===1?'extracted':'needs_review';
 return withTransaction(async c=>{
  const [current]=await rows(c,"SELECT lock_version,date_status FROM v2_documents WHERE id=? AND status='Aktif' FOR UPDATE",[id]);
  if(!current||current.lock_version!==doc.lock_version)fail('Dokumen berubah. Muat ulang sebelum memeriksa tanggal.',409);
  if(current.date_status==='verified')fail('Tanggal sudah diperiksa admin. Kosongkan secara manual jika perlu diperiksa ulang.',409);
  await rows(c,'UPDATE v2_documents SET document_date=?,date_status=?,date_source_file_id=?,lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?',[date,status,date?found.get(date):null,id]);
  await audit(c,user,req,'READ_DOCUMENT_DATE',id,{filesChecked:files.length,candidates:values,status});
  return {date,status};
 });
}
