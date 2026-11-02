import {randomUUID,createHash} from 'node:crypto';
import {departmentCode,departmentLabels} from '../src/lib/document-classification.mjs';

const digest=(category,relativePath)=>createHash('sha256').update(`${category}\0${relativePath}`).digest('hex');

async function ensureNode(c,{category,relativePath,name,parentId,department}){
 const pathHash=digest(category,relativePath);
 const [found]=await c.query('SELECT id FROM v2_folder_nodes WHERE path_hash=?',[pathHash]);
 if(found.length)return found[0].id;
 const folderId=randomUUID();
 await c.query('INSERT IGNORE INTO v2_folder_nodes(id,parent_id,category,relative_path,name,path_hash,department,created_by) VALUES(?,?,?,?,?,?,?,NULL)',
  [folderId,parentId,category,relativePath,name,pathHash,department||null]);
 const [row]=await c.query('SELECT id FROM v2_folder_nodes WHERE path_hash=?',[pathHash]);
 if(!row.length)throw new Error('Folder tree backfill did not create a path');
 return row[0].id;
}

async function ensureCategoryMaster(c,name,active){
 const [existing]=await c.query("SELECT id,is_active FROM v2_master_values WHERE type='category' AND value=?",[name]);
 if(existing.length){if(active&&!existing[0].is_active)await c.query('UPDATE v2_master_values SET is_active=1,lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?',[existing[0].id]);return;}
 await c.query("INSERT IGNORE INTO v2_master_values(id,type,value,label,is_active) VALUES(?, 'category',?,?,?)",
  [randomUUID(),name,name,active?1:0]);
}

export async function migrateFolderData(c){
 const [documents]=await c.query("SELECT id,category,department FROM v2_documents WHERE category<>'' ORDER BY category,id");
 const [categoryMasters]=await c.query("SELECT value,is_active FROM v2_master_values WHERE type='category' AND value<>'' ORDER BY value");
 const paths=new Map();
 for(const row of categoryMasters)paths.set(row.value,{active:!!row.is_active,departments:new Set()});
 for(const doc of documents){
  const item=paths.get(doc.category)||{active:true,departments:new Set()};
  item.departments.add(doc.department);paths.set(doc.category,item);
 }
 const nodeIds=new Map();
 for(const [fullPath,info] of paths){
  if(fullPath.length>500||fullPath.startsWith('/')||fullPath.includes('\\')||/[\x00-\x1f\x7f]/.test(fullPath))throw new Error('Legacy category path requires review before folder migration');
  const segments=fullPath.split('/');
  if(segments.some(segment=>!segment||segment==='.'||segment==='..'||segment.length>500))throw new Error('Legacy category path requires review before folder migration');
  const category=segments[0];
  const code=departmentCode(category);
  const department=code?departmentLabels[code]:info.departments.size===1?[...info.departments][0]:null;
  const active=info.active||documents.some(doc=>doc.category===fullPath);
  await ensureCategoryMaster(c,category,active);
  let parentId=await ensureNode(c,{category,relativePath:'',name:category,parentId:null,department});
  let relativePath='';
  for(const name of segments.slice(1)){
   relativePath=relativePath?relativePath+'/'+name:name;
   parentId=await ensureNode(c,{category,relativePath,name,parentId,department});
  }
  nodeIds.set(fullPath,parentId);
 }
 for(const doc of documents){
  const folderId=nodeIds.get(doc.category);
  if(folderId)await c.query('INSERT IGNORE INTO v2_document_folders(document_id,folder_id) VALUES(?,?)',[doc.id,folderId]);
 }

 const required=[
  ...Object.values(departmentLabels).map(value=>['department',value,value]),
  ['kind','Manual Mutu','Manual Mutu'],['kind','SOP/Prosedur','SOP/Prosedur'],
  ['kind','Instruksi Kerja','Instruksi Kerja'],['kind','Formulir Mutu','Formulir Mutu'],
  ['kind','Lampiran','Lampiran'],
 ];
 for(const [type,value,label] of required){
  const [existing]=await c.query('SELECT id,label,is_active FROM v2_master_values WHERE type=? AND value=?',[type,value]);
  if(existing.length){
   if(existing[0].label!==label||!existing[0].is_active)await c.query('UPDATE v2_master_values SET label=?,is_active=1,lock_version=IF(is_active=0,lock_version+1,lock_version),updated_at=NOW(3) WHERE id=?',[label,existing[0].id]);
  }else await c.query('INSERT IGNORE INTO v2_master_values(id,type,value,label,is_active) VALUES(?,?,?,?,1)',[randomUUID(),type,value,label]);
 }

 // Old nested category options are represented by the folder tree now.
 await c.query("UPDATE v2_master_values SET is_active=0,lock_version=lock_version+1,updated_at=NOW(3) WHERE type='category' AND value LIKE '%/%' AND is_active=1");
 // Keep legacy department/kind values when any document or account still refers to them.
 await c.query("UPDATE v2_master_values m SET is_active=0,lock_version=lock_version+1,updated_at=NOW(3) WHERE m.type='department' AND m.is_active=1 AND m.value NOT IN (?,?,?) AND NOT EXISTS(SELECT 1 FROM users u WHERE u.bidang=m.value) AND NOT EXISTS(SELECT 1 FROM v2_documents d WHERE d.department=m.value)",Object.values(departmentLabels));
 await c.query("UPDATE v2_master_values m SET is_active=0,lock_version=lock_version+1,updated_at=NOW(3) WHERE m.type='kind' AND m.is_active=1 AND m.value NOT IN (?,?,?,?,?) AND NOT EXISTS(SELECT 1 FROM v2_documents d WHERE d.kind=m.value)",required.filter(row=>row[0]==='kind').map(row=>row[1]));
 const [folderCount]=await c.query('SELECT COUNT(*) total FROM v2_folder_nodes');
 const [locationCount]=await c.query('SELECT COUNT(*) total FROM v2_document_folders');
 return {folders:Number(folderCount[0].total),documentLocations:Number(locationCount[0].total),legacyCategories:paths.size,requiredMasters:required.length};
}
