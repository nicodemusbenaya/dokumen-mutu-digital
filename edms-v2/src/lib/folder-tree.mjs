import {hash,id,safeEntry,fail} from './core.mjs';
import {rows} from './db.mjs';
import {audit} from './security.mjs';
import {departmentCode,departmentLabels,departmentsMatch} from './document-classification.mjs';

export function zipLocation(entryPath,directory=false){
 const normalized=safeEntry(String(entryPath));
 const segments=normalized.split('/').filter(segment=>segment&&segment!=='.');
 if(!directory)segments.pop();
 const category=segments[0]||'';
 const relativePath=segments.slice(1).join('/');
 if(category.length>500||relativePath.length>500)fail('Path folder ZIP melebihi 500 karakter');
 return {category,relativePath,folderNames:relativePath?relativePath.split('/'):[]};
}

export function folderPathHash(category,relativePath=''){
 return hash(`${String(category)}\0${String(relativePath)}`);
}

export function validateFolderName(value,{preserve=false}={}){
 if(typeof value!=='string')fail('Nama folder tidak valid');
 const name=preserve?value:value.trim();
 if(!name||name.length>500||name==='.'||name==='..'||/[\\/\x00-\x1f\x7f]/.test(name))fail('Nama folder tidak valid');
 return name;
}

async function reuseDeletedFolder(c,folder,user,req){
 if(!folder.is_deleted)return folder;
 if(user.role!=='Super user'&&!(user.role==='Editor'&&folder.department&&departmentsMatch(folder.department,user.bidang)))fail('Tidak berhak memakai kembali folder di bidang lain',403);
 const [children]=await rows(c,'SELECT COUNT(*) total FROM v2_folder_nodes WHERE parent_id=? AND is_deleted=0',[folder.id]);
 const [documents]=await rows(c,'SELECT COUNT(*) total FROM v2_document_folders WHERE folder_id=?',[folder.id]);
 if(Number(children.total)||Number(documents.total))fail('Folder terhapus masih memiliki isi. Hubungi Super user untuk pemeriksaan.',409);
 await rows(c,'UPDATE v2_folder_nodes SET is_deleted=0,deleted_at=NULL,updated_at=NOW(3) WHERE id=?',[folder.id]);
 await audit(c,user,req,'REUSE_DELETED_FOLDER',null,{folderId:folder.id,category:folder.category,relativePath:folder.relative_path});
 return {...folder,is_deleted:0};
}

async function ensureCategory(c,category,user,req,requestedDepartment=null,allowDepartmentOverride=false){
 const name=validateFolderName(category,{preserve:true});
 const masterId=id();
 await rows(c,"INSERT INTO v2_master_values(id,type,value,label) VALUES(?,'category',?,?) ON DUPLICATE KEY UPDATE id=id",[masterId,name,name]);
 const [master]=await rows(c,"SELECT id,is_active FROM v2_master_values WHERE type='category' AND value=? FOR UPDATE",[name]);
 const digest=folderPathHash(name,'');
 let [folder]=await rows(c,'SELECT * FROM v2_folder_nodes WHERE path_hash=? FOR UPDATE',[digest]);
 if(!master?.is_active&&!folder?.is_deleted)fail('Kategori dinonaktifkan: '+name+'. Hubungi Super user.',409);
 if(folder?.is_deleted){
  folder=await reuseDeletedFolder(c,folder,user,req);
  if(!master.is_active)await rows(c,"UPDATE v2_master_values SET is_active=1,lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?",[master.id]);
 }
 if(!folder){
  const code=departmentCode(name),department=code?departmentLabels[code]:(user.role==='Editor'?user.bidang||null:requestedDepartment||null);
  const folderId=id();
  await rows(c,'INSERT INTO v2_folder_nodes(id,parent_id,category,relative_path,name,path_hash,department,created_by) VALUES(?,NULL,?,?,?,?,?,?)',
   [folderId,name,'',name,digest,department,user.id||null]);
  folder={id:folderId,parent_id:null,category:name,relative_path:'',name,path_hash:digest,department,is_deleted:0};
  await audit(c,user,req,'CREATE_FOLDER',null,{folderId,category:name,relativePath:''});
 }
 if(!(allowDepartmentOverride&&user.role==='Super user')&&folder.department&&requestedDepartment&&!departmentsMatch(folder.department,requestedDepartment))fail('Bidang dokumen berbeda dari bidang kategori folder',409);
 return folder;
}

export async function ensureFolderLocation(c,{category='',relativePath='',department=null,allowDepartmentOverride=false},user,req){
 if(!category)return {folderId:null,category:'',relativePath:''};
 const root=await ensureCategory(c,category,user,req,department,allowDepartmentOverride);
 if(!(allowDepartmentOverride&&user.role==='Super user')&&root.department&&department&&!departmentsMatch(root.department,department))fail('Bidang dokumen berbeda dari bidang kategori folder',409);
 if(user.role==='Editor'&&(!root.department||!departmentsMatch(root.department,user.bidang)))fail('Folder berada di luar bidang akun Anda',403);
 let parent=root,currentRelative='';
 const names=relativePath?String(relativePath).split('/').filter(Boolean):[];
 for(const part of names){
  const name=validateFolderName(part,{preserve:true});
  currentRelative=currentRelative?currentRelative+'/'+name:name;
  if(currentRelative.length>500)fail('Path folder ZIP melebihi 500 karakter');
  const digest=folderPathHash(category,currentRelative);
  let [child]=await rows(c,'SELECT * FROM v2_folder_nodes WHERE path_hash=? FOR UPDATE',[digest]);
  if(!child){
   const folderId=id();
   await rows(c,'INSERT INTO v2_folder_nodes(id,parent_id,category,relative_path,name,path_hash,department,created_by) VALUES(?,?,?,?,?,?,?,?)',
    [folderId,parent.id,category,currentRelative,name,digest,root.department,user.id||null]);
   child={id:folderId,parent_id:parent.id,category,relative_path:currentRelative,name,path_hash:digest,department:root.department,is_deleted:0};
   await audit(c,user,req,'CREATE_FOLDER',null,{folderId,category,relativePath:currentRelative});
  }
  child=await reuseDeletedFolder(c,child,user,req);
  parent=child;
 }
 return {folderId:parent.id,category,relativePath:currentRelative};
}
