import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {hash} from './empty-register-core.mjs';
import {roleTarget} from './role-migration.mjs';

export function comparableDocument(old,row){
 const copy={...row};
 for(const field of ['map_parent_id','document_date','date_status','date_source_file_id'])if(!Object.hasOwn(old,field)){
  assert.equal(copy[field],field==='date_status'?'missing':null,'Existing document hierarchy/date was changed');
  delete copy[field];
 }
 return copy;
}

export function assertResumeState(before,failed,current){
 assert.equal(hash(current),hash(failed),'Database changed since failed staging; inspect before resuming');
 return assertUpdateRetained(before,current);
}

export function assertUpdateRetained(before,after){
 assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort(),'Database table set changed');
 const changed=new Set(['roles','users','v2_audit','v2_migrations','v2_import_items','v2_rate_limits','v2_master_values','v2_folder_nodes','v2_document_folders']);
 for(const table of Object.keys(before))if(!changed.has(table)){
  if(table==='v2_documents'){
   const additive=['map_parent_id','document_date','date_status','date_source_file_id'];
   const normalized=after[table].map(row=>{
    const copy={...row};
    for(const field of additive)if(!Object.hasOwn(before[table][0]||{},field)){
     assert.equal(copy[field],field==='date_status'?'missing':null,'Existing document hierarchy/date was changed');
     delete copy[field];
    }
    return copy;
   });
   assert.equal(hash(normalized),hash(before[table]),'Existing records changed: '+table);
  }else assert.equal(hash(after[table]),hash(before[table]),'Existing records changed: '+table);
 }
 const users=rows=>rows.map(({role_id,...rest})=>rest);
 assert.equal(hash(users(after.users)),hash(users(before.users)),'Account metadata/password changed');
 assert.deepEqual(after.roles.map(r=>r.name).sort(),['Editor','Super user','Viewer']);
 for(const old of before.users){
  const role=before.roles.find(r=>r.id===old.role_id),updated=after.users.find(u=>u.id===old.id);
  assert.equal(after.roles.find(r=>r.id===updated.role_id)?.name,roleTarget(role.name),'Incorrect account role mapping');
 }
 const items=after.v2_import_items.map(row=>{
  const original=before.v2_import_items.find(item=>item.id===row.id);
  if(original&&!Object.hasOwn(original,'entry_key')){assert.equal(row.entry_key,null);const {entry_key,...rest}=row;return rest;}
  return row;
 });
 assert.equal(hash(items),hash(before.v2_import_items),'Import history changed');
 const afterMasters=new Map(after.v2_master_values.map(row=>[row.id,row]));
 for(const old of before.v2_master_values){const current=afterMasters.get(old.id);assert(current,'Existing master was removed');for(const field of ['type','value'])assert.equal(current[field],old[field],'Existing master identity changed');}
 const nodeByPath=new Map(after.v2_folder_nodes.map(node=>[node.category+'\0'+node.relative_path,node]));
 const nodeById=new Map(after.v2_folder_nodes.map(node=>[node.id,node]));
 const folderHash=(category,relative)=>createHash('sha256').update(category+'\0'+relative).digest('hex');
 for(const node of after.v2_folder_nodes){
  assert(node.name&&node.name.length<=500&&!/[\\/\x00-\x1f\x7f]/.test(node.name),'Invalid migrated folder name');
  assert.equal(node.path_hash,folderHash(node.category,node.relative_path),'Folder path identity mismatch');
  if(node.parent_id){const parent=nodeById.get(node.parent_id);assert(parent,'Folder parent missing');assert.equal(parent.category,node.category,'Folder changed category across a parent edge');assert.equal(parent.relative_path?(parent.relative_path+'/'+node.name):node.name,node.relative_path,'Folder path does not match its parent');}
  else assert.equal(node.relative_path,'','Root folder has a relative path');
 }
 const linkedDocs=new Set();
 for(const relation of after.v2_document_folders){const doc=after.v2_documents.find(row=>row.id===relation.document_id),node=nodeById.get(relation.folder_id);assert(doc&&node,'Document folder relation is orphaned');assert(doc.category,'Uncategorized document received a folder relation');const parts=doc.category.split('/');assert.equal(node.category,parts[0]);assert.equal(node.relative_path,parts.slice(1).join('/'));assert(!linkedDocs.has(doc.id),'Document has more than one Explorer location');linkedDocs.add(doc.id);}
 for(const doc of after.v2_documents){if(doc.category)assert(linkedDocs.has(doc.id),'Existing categorized document was not mapped into Explorer');}
 for(const table of ['users','v2_documents']){
  const masters=new Set(after.v2_master_values.filter(row=>row.type===(table==='users'?'department':'department')&&row.is_active).map(row=>row.value));
  const kindMasters=new Set(after.v2_master_values.filter(row=>row.type==='kind'&&row.is_active).map(row=>row.value));
  for(const row of after[table]){if(table==='users'){if(row.bidang)assert(masters.has(row.bidang),'Active account department master was disabled');}else{assert(masters.has(row.department),'Referenced department master was disabled');assert(kindMasters.has(row.kind),'Referenced document kind master was disabled');}}
 }
 for(const table of ['v2_audit','v2_migrations']){
  const retained=new Set(after[table].map(hash));
  assert(before[table].every(row=>retained.has(hash(row))),'Existing records removed/modified: '+table);
 }
 assert(['004','005','006','007','008'].every(version=>after.v2_migrations.some(row=>row.version===version)),'Update migrations incomplete');
 return {documents:before.v2_documents.length,files:before.v2_files.length,accounts:before.users.length,historyPreserved:true};
}

export async function verifyStoredFiles(data,storage){
 for(const file of data.v2_files){
  assert(/^(originals|derived)\/[a-f0-9-]{36}\.(pdf|docx|xlsx)$/.test(file.disk_path),'Unexpected original/derived storage path');
  const resolved=path.resolve(storage,file.disk_path);
  assert(resolved.startsWith(path.resolve(storage)+path.sep));
  const stat=await fs.lstat(resolved);assert(stat.isFile()&&!stat.isSymbolicLink(),'Stored file is not regular');
  assert.equal(String(stat.size),String(file.size),'Stored file size differs');
  const sha=createHash('sha256');for await(const chunk of createReadStream(resolved))sha.update(chunk);
  assert.equal(sha.digest('hex'),file.sha256,'Stored file hash differs: '+file.id);
 }
 return data.v2_files.length;
}
