import {query,rows,withTransaction} from './db.mjs';
import {id,fail,editable} from './core.mjs';
import {audit,requireEditor} from './security.mjs';
import {uuid} from './management.mjs';
import {ensureFolderLocation,folderPathHash,validateFolderName} from './folder-tree.mjs';
import {departmentCode,departmentLabels,departmentAliases,departmentsMatch} from './document-classification.mjs';
import {requireMaster} from './masters.mjs';

function canManageFolder(user,folder){
 return user.role==='Super user'||(user.role==='Editor'&&!!folder.department&&departmentsMatch(user.bidang,folder.department));
}
function canViewFolder(user,folder){return user.role!=='Editor'||!!folder.department&&departmentsMatch(user.bidang,folder.department);}
function mapFolder(row,user){
 return {id:row.id,parentId:row.parent_id,category:row.category,relativePath:row.relative_path,name:row.name,
  department:row.department,updatedAt:row.updated_at,canManage:canManageFolder(user,row)};
}
function mapDocument(row,user){
 const document={id:row.id,code:row.code,title:row.title,department:row.department,kind:row.kind,category:row.category,
  activeVersion:Number(row.active_version),lockVersion:Number(row.lock_version),status:row.status,updatedAt:row.updated_at,
  formats:row.formats||'',canEdit:editable(user,row)};
 return document;
}
const activeDocs=`SELECT d.*,
 (SELECT GROUP_CONCAT(DISTINCT f.extension ORDER BY f.extension SEPARATOR ',') FROM v2_files f JOIN v2_versions v ON v.id=f.version_id WHERE v.document_id=d.id AND v.number=d.active_version AND f.origin='original') formats
 FROM v2_documents d`;

async function folderById(folderId,c=null,{lock=false}={}){
 const sql='SELECT * FROM v2_folder_nodes WHERE id=?'+(lock?' FOR UPDATE':'');
 const result=c?await rows(c,sql,[folderId]):await query(sql,[folderId]);
 return result[0];
}
async function breadcrumb(folderId){
 const path=[];let next=folderId,guard=0;
 while(next&&guard++<100){
  const [row]=await query('SELECT id,parent_id,name,category,relative_path FROM v2_folder_nodes WHERE id=? AND is_deleted=0',[next]);
  if(!row)break;path.unshift({id:row.id,name:row.name});next=row.parent_id;
 }
 return path;
}
function folderPath(row){return row.relative_path?row.category+'/'+row.relative_path:row.category;}
async function catalog(user){
 const folders=await query('SELECT * FROM v2_folder_nodes WHERE is_deleted=0 ORDER BY category,relative_path,name');
 return folders.filter(row=>canViewFolder(user,row)).map(row=>({...mapFolder(row,user),path:folderPath(row)}));
}
async function listDocuments(folderId,user){
 let sql=activeDocs+" LEFT JOIN v2_document_folders df ON df.document_id=d.id WHERE d.status='Aktif'";
 const args=[];
 if(folderId){sql+=' AND df.folder_id=?';args.push(folderId);}
 else sql+=" AND df.document_id IS NULL AND d.category=''";
 if(user.role==='Editor'){const aliases=departmentAliases(user.bidang);sql+=' AND d.department IN ('+aliases.map(()=>'?').join(',')+')';args.push(...aliases);}
 sql+=' ORDER BY d.updated_at DESC,d.title LIMIT 500';
 return (await query(sql,args)).map(row=>mapDocument(row,user));
}
async function browse(folderId,user){
 if(!folderId){
  let folders=await query('SELECT * FROM v2_folder_nodes WHERE parent_id IS NULL AND is_deleted=0 ORDER BY name');
  folders=folders.filter(row=>canViewFolder(user,row));
  return {folder:null,breadcrumb:[],folders:folders.map(row=>mapFolder(row,user)),documents:await listDocuments(null,user)};
 }
 const folder=await folderById(folderId);
 if(!folder||folder.is_deleted||!canViewFolder(user,folder))fail('Folder tidak ditemukan',404);
 let children=await query('SELECT * FROM v2_folder_nodes WHERE parent_id=? AND is_deleted=0 ORDER BY name',[folder.id]);
 children=children.filter(row=>canViewFolder(user,row));
 return {folder:mapFolder(folder,user),breadcrumb:await breadcrumb(folder.id),folders:children.map(row=>mapFolder(row,user)),documents:await listDocuments(folder.id,user)};
}
async function searchDocuments(value,user){
 const term='%'+value.trim()+'%';
 const searchSql=activeDocs.replace(' FROM v2_documents d',',df.folder_id,f.category folder_category,f.relative_path folder_relative_path FROM v2_documents d');
 const args=[];let scope='';if(user.role==='Editor'){const aliases=departmentAliases(user.bidang);scope=' AND d.department IN ('+aliases.map(()=>'?').join(',')+')';args.push(...aliases);}
 args.push(term,term,term,term);
 const rowsFound=await query(searchSql+" LEFT JOIN v2_document_folders df ON df.document_id=d.id LEFT JOIN v2_folder_nodes f ON f.id=df.folder_id WHERE d.status='Aktif'"+scope+" AND (d.code LIKE ? OR d.title LIKE ? OR d.category LIKE ? OR f.name LIKE ?) ORDER BY d.title LIMIT 500",args);
 return rowsFound.map(row=>({...mapDocument(row,user),folderPath:row.folder_id?(row.folder_relative_path?row.folder_category+'/'+row.folder_relative_path:row.folder_category):''}));
}
async function deletedFolders(user){
 const rowsFound=await query('SELECT * FROM v2_folder_nodes WHERE is_deleted=1 ORDER BY category,relative_path,name');
 return rowsFound.filter(row=>canManageFolder(user,row)).map(row=>({...mapFolder(row,user),path:folderPath(row)}));
}

export async function manageFolders(req,segments,user,json,response){
 if(segments[0]==='document-location'&&req.method==='PATCH'){
  requireEditor(user);const data=await json(req),documentId=uuid(data.documentId),folderId=data.folderId?uuid(data.folderId):null;
  return response(await withTransaction(async c=>{
   const [doc]=await rows(c,'SELECT * FROM v2_documents WHERE id=? FOR UPDATE',[documentId]);
   if(!doc||doc.status!=='Aktif')fail('Dokumen aktif tidak ditemukan',404);
   if(!editable(user,{ownerId:doc.owner_id,department:doc.department}))fail('Tidak berhak memindahkan dokumen',403);
   if(doc.lock_version!==data.lockVersion||doc.active_version!==data.expectedVersion)fail('Dokumen berubah. Muat ulang sebelum memindahkan.',409);
   const folder=folderId?await folderById(folderId,c,{lock:true}):null;
   if(folderId&&(!folder||folder.is_deleted))fail('Folder tujuan tidak tersedia',404);
   if(folder&&(!canManageFolder(user,folder)||!departmentsMatch(folder.department,doc.department)))fail('Folder tujuan harus berada pada bidang dokumen yang sama',403);
   const [previous]=await rows(c,'SELECT folder_id FROM v2_document_folders WHERE document_id=? FOR UPDATE',[documentId]);
   await rows(c,'DELETE FROM v2_document_folders WHERE document_id=?',[documentId]);
   if(folder)await rows(c,'INSERT INTO v2_document_folders(document_id,folder_id) VALUES(?,?)',[documentId,folder.id]);
   await rows(c,'UPDATE v2_documents SET category=?,lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?',[folder?.category||'',documentId]);
   await audit(c,user,req,'MOVE_DOCUMENT',documentId,{fromFolderId:previous?.folder_id||null,toFolderId:folderId,fromCategory:doc.category,toCategory:folder?.category||''});
   return {ok:true};
  }));
 }
 if(segments[0]!=='folders')return null;
 const method=req.method,url=new URL(req.url),folderId=url.searchParams.get('folderId');
 if(method==='GET'){
  if(url.searchParams.get('catalog')==='1')return response({folders:await catalog(user)});
  if(url.searchParams.get('trash')==='1')return response({folders:await deletedFolders(user)});
  const search=url.searchParams.get('search')||'';
  if(search.trim())return response({searchResults:await searchDocuments(search,user)});
  return response(await browse(folderId?uuid(folderId):null,user));
 }
 if(method==='POST'){
  requireEditor(user);const data=await json(req),name=validateFolderName(data.name);
  const parentId=data.parentId?uuid(data.parentId):null;
  return response(await withTransaction(async c=>{
   let category=name,relativePath='',department=data.department||null;
   if(parentId){
    const parent=await folderById(parentId,c,{lock:true});
    if(!parent||parent.is_deleted)fail('Folder tujuan tidak tersedia',404);
    if(!canManageFolder(user,parent))fail('Tidak berhak mengelola folder tujuan',403);
    category=parent.category;relativePath=parent.relative_path?parent.relative_path+'/'+name:name;department=parent.department;
   }else if(user.role==='Editor')department=user.bidang;
   else if(department&&typeof department==='string')department=department.trim();
   else{const code=departmentCode(name);department=code?departmentLabels[code]:null;}
   const code=departmentCode(name);if(code)department=departmentLabels[code];
   if(user.role==='Super user'&&!department)fail('Pilih bidang untuk kategori akar');
   if(user.role==='Editor'&&!departmentsMatch(department,user.bidang))fail('Folder berada di luar bidang akun Anda',403);
   if(department)await requireMaster('department',department,(sql,args)=>rows(c,sql,args));
   const created=await ensureFolderLocation(c,{category,relativePath,department},user,req);
   return {ok:true,id:created.folderId};
  }));
 }
 if(method==='PATCH'&&folderId){
  requireEditor(user);const data=await json(req),action=data.action;
  if(!['rename','move','delete','restore'].includes(action))fail('Aksi folder tidak valid');
  return response(await withTransaction(async c=>{
   const source=await folderById(uuid(folderId),c,{lock:true});
   if(!source)fail('Folder tidak ditemukan',404);
   if(action==='restore'){
    if(!source.is_deleted)fail('Folder tidak berada di Folder Terhapus',409);
    if(!canManageFolder(user,source))fail('Tidak berhak memulihkan folder',403);
    if(source.parent_id){const parent=await folderById(source.parent_id,c,{lock:true});if(!parent||parent.is_deleted)fail('Pulihkan folder induk dahulu',409);}
    await rows(c,'UPDATE v2_folder_nodes SET is_deleted=0,deleted_at=NULL,updated_at=NOW(3) WHERE id=?',[source.id]);
    if(source.parent_id===null)await rows(c,"UPDATE v2_master_values SET is_active=1,lock_version=lock_version+1,updated_at=NOW(3) WHERE type='category' AND value=?",[source.category]);
    await audit(c,user,req,'RESTORE_FOLDER',null,{folderId:source.id,path:folderPath(source)});return {ok:true};
   }
   if(source.is_deleted)fail('Pulihkan folder dahulu',409);
   if(!canManageFolder(user,source))fail('Tidak berhak mengelola folder ini',403);
   if(action==='delete'){
    const [children]=await rows(c,'SELECT COUNT(*) total FROM v2_folder_nodes WHERE parent_id=? AND is_deleted=0',[source.id]);
    const [documents]=await rows(c,'SELECT COUNT(*) total FROM v2_document_folders WHERE folder_id=?',[source.id]);
    if(Number(children.total)||Number(documents.total))fail('Pindahkan isi folder terlebih dahulu. Dokumen tidak ikut dihapus.');
    await rows(c,'UPDATE v2_folder_nodes SET is_deleted=1,deleted_at=NOW(3),updated_at=NOW(3) WHERE id=?',[source.id]);
    if(source.parent_id===null)await rows(c,"UPDATE v2_master_values SET is_active=0,lock_version=lock_version+1,updated_at=NOW(3) WHERE type='category' AND value=?",[source.category]);
    await audit(c,user,req,'DELETE_FOLDER',null,{folderId:source.id,path:folderPath(source),recoverable:true});return {ok:true};
   }
   const newName=data.name===undefined?source.name:validateFolderName(data.name);
   const newParentId=action==='move'?(data.parentId?uuid(data.parentId):null):source.parent_id;
   const all=await rows(c,'SELECT * FROM v2_folder_nodes WHERE is_deleted=0 ORDER BY relative_path');
   const byParent=new Map();for(const row of all){const key=row.parent_id||'';if(!byParent.has(key))byParent.set(key,[]);byParent.get(key).push(row);}
   const subtree=[];const walk=row=>{subtree.push(row);for(const child of byParent.get(row.id)||[])walk(child);};walk(source);
   const subtreeIds=new Set(subtree.map(row=>row.id));let targetParent=null;
   if(newParentId){targetParent=await folderById(newParentId,c,{lock:true});if(!targetParent||targetParent.is_deleted)fail('Folder tujuan tidak tersedia',404);if(subtreeIds.has(targetParent.id))fail('Folder tidak dapat dipindahkan ke dalam dirinya sendiri');if(!canManageFolder(user,targetParent))fail('Tidak berhak mengelola folder tujuan',403);}
   let newCategory=targetParent?.category||newName;
   if(targetParent&&source.parent_id===null&&action==='rename')fail('Kategori akar hanya dapat diganti nama dari akarnya');
   let newRootRelative=targetParent?(targetParent.relative_path?targetParent.relative_path+'/'+newName:newName):'';
   const inferredCode=departmentCode(newCategory);
   const newDepartment=targetParent?.department||(inferredCode?departmentLabels[inferredCode]:source.department);
   if(user.role==='Editor'&&(!newDepartment||!departmentsMatch(user.bidang,newDepartment)))fail('Folder tidak dapat dipindahkan ke bidang lain',403);
   const updates=[];
   for(const row of subtree){
    const suffix=row.id===source.id?'':row.relative_path.slice(source.relative_path.length).replace(/^\//,'');
    const relativePath=row.id===source.id?newRootRelative:[newRootRelative,suffix].filter(Boolean).join('/');
    const category=newCategory,name=row.id===source.id?newName:row.name,pathHash=folderPathHash(category,relativePath);
    const parent=row.id===source.id?newParentId:row.parent_id;
    const [collision]=await rows(c,'SELECT id FROM v2_folder_nodes WHERE path_hash=?',[pathHash]);
    if(collision&&collision.id!==row.id&&!subtreeIds.has(collision.id))fail('Nama/path folder tujuan sudah digunakan',409);
    if(collision&&collision.id!==row.id)fail('Perubahan akan membuat dua folder dengan path sama',409);
    updates.push({id:row.id,parent,category,relativePath,name,pathHash,department:newDepartment});
   }
   for(const next of updates)await rows(c,'UPDATE v2_folder_nodes SET parent_id=?,category=?,relative_path=?,name=?,path_hash=?,department=?,updated_at=NOW(3) WHERE id=?',[next.parent,next.category,next.relativePath,next.name,next.pathHash,next.department,next.id]);
   if(source.category!==newCategory){
    const masterId=id();await rows(c,"INSERT INTO v2_master_values(id,type,value,label,is_active) VALUES(?,'category',?,?,1) ON DUPLICATE KEY UPDATE id=id",[masterId,newCategory,newCategory]);
    const [master]=await rows(c,"SELECT is_active FROM v2_master_values WHERE type='category' AND value=? FOR UPDATE",[newCategory]);if(!master?.is_active)fail('Kategori tujuan dinonaktifkan',409);
    const folderIds=[...subtreeIds];
    await rows(c,'UPDATE v2_documents d JOIN v2_document_folders df ON df.document_id=d.id SET d.category=?,d.lock_version=d.lock_version+1,d.updated_at=NOW(3) WHERE df.folder_id IN ('+folderIds.map(()=>'?').join(',')+')',[newCategory,...folderIds]);
    const [oldRoot]=await rows(c,'SELECT COUNT(*) total FROM v2_folder_nodes WHERE parent_id IS NULL AND is_deleted=0 AND category=?',[source.category]);
    if(!Number(oldRoot.total))await rows(c,"UPDATE v2_master_values SET is_active=0,lock_version=lock_version+1,updated_at=NOW(3) WHERE type='category' AND value=?",[source.category]);
   }
   const last=updates.find(row=>row.id===source.id);
   await audit(c,user,req,action==='rename'?'RENAME_FOLDER':'MOVE_FOLDER',null,{folderId:source.id,before:{category:source.category,path:folderPath(source),parentId:source.parent_id},after:{category:last.category,path:last.relativePath?last.category+'/'+last.relativePath:last.category,parentId:last.parent},documentsInSubtree:Number((await rows(c,'SELECT COUNT(*) total FROM v2_document_folders WHERE folder_id IN ('+updates.map(()=>'?').join(',')+')',[...updates.map(row=>row.id)]))[0]?.total||0)});
   return {ok:true};
  }));
 }
 fail('Metode folder tidak didukung',405);
}
