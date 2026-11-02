import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {assertUpdateRetained,comparableDocument,assertResumeState} from '../scripts/update-retention.mjs';

test('rollback compares additive document fields without ignoring real changes',()=>{
 const old={id:'DUMMY',title:'Original'};
 const migrated={...old,map_parent_id:null,document_date:null,date_status:'missing',date_source_file_id:null};
 assert.deepEqual(comparableDocument(old,migrated),old);
 assert.throws(()=>comparableDocument(old,{...migrated,date_status:'confirmed'}));
 assert.notDeepEqual(comparableDocument(old,{...migrated,title:'Changed'}),old);
});

function fixture(){
 const rootId=randomUUID(),childId=randomUUID(),docId='DUMMY-document';
 const category='DUMMY Category',relative='Sub';
 const node=(id,parent_id,relative_path,name)=>({id,parent_id,category,relative_path,name,path_hash:createHash('sha256').update(category+'\0'+relative_path).digest('hex'),department:'DUMMY Bidang',is_deleted:0,created_by:null});
 const before={
  roles:[{id:1,name:'Admin Sistem'},{id:2,name:'Penyusun Dokumen'}],
  users:[{id:1,role_id:1,password_hash:'DUMMY-admin',bidang:'DUMMY Bidang'},{id:2,role_id:2,password_hash:'DUMMY-editor',bidang:'BMK'}],
  v2_documents:[{id:docId,code:'DUMMY-code',title:'DUMMY retained',category:category+'/'+relative,department:'DUMMY Bidang',kind:'SOP/Prosedur'}],
  v2_files:[{id:'DUMMY-file'}],v2_versions:[{id:'DUMMY-version'}],v2_import_items:[{id:'DUMMY-item',state:'success'}],
  v2_audit:[{id:1,action:'DUMMY existing'}],v2_migrations:[{version:'004'},{version:'005'}],v2_rate_limits:[],
  v2_master_values:[{id:'DUMMY-dept',type:'department',value:'DUMMY Bidang',label:'DUMMY Bidang',is_active:1,lock_version:0},{id:'DUMMY-editor-dept',type:'department',value:'BMK',label:'BMK',is_active:1,lock_version:0},{id:'DUMMY-kind',type:'kind',value:'SOP/Prosedur',label:'SOP/Prosedur',is_active:1,lock_version:0},{id:'DUMMY-category-root',type:'category',value:category,label:category,is_active:1,lock_version:0},{id:'DUMMY-category-full',type:'category',value:category+'/'+relative,label:category+'/'+relative,is_active:1,lock_version:0}],
  v2_folder_nodes:[],v2_document_folders:[],
 };
 const after=structuredClone(before);
 after.roles=[{id:3,name:'Super user'},{id:4,name:'Editor'},{id:5,name:'Viewer'}];after.users[0].role_id=3;after.users[1].role_id=4;
 after.v2_import_items[0].entry_key=null;after.v2_migrations.push({version:'006'},{version:'007'},{version:'008'});after.v2_audit.push({id:2,action:'ROLE_MODEL_MIGRATION'});
 Object.assign(after.v2_documents[0],{map_parent_id:null,document_date:null,date_status:'missing',date_source_file_id:null});
 after.v2_folder_nodes=[node(rootId,null,'',category),node(childId,rootId,relative,'Sub')];after.v2_document_folders=[{document_id:docId,folder_id:childId}];
 after.v2_master_values.push({id:'DUMMY-required-kind',type:'kind',value:'Manual Mutu',label:'Manual Mutu',is_active:1,lock_version:0},{id:'DUMMY-formulir',type:'kind',value:'Formulir Mutu',label:'Formulir Mutu',is_active:1,lock_version:0},{id:'DUMMY-lampiran',type:'kind',value:'Lampiran',label:'Lampiran',is_active:1,lock_version:0});
 after.v2_master_values.find(row=>row.id==='DUMMY-category-full').is_active=0;
 return {before,after};
}

test('update preserves existing documents/files/versions/accounts and backfills only additive Explorer data',()=>{
 const {before,after}=fixture();assert.deepEqual(assertUpdateRetained(before,after),{documents:1,files:1,accounts:2,historyPreserved:true});
});
test('resume requires unchanged failed state and rejects unretained data',()=>{
 const {before,after}=fixture();assertResumeState(before,after,structuredClone(after));
 const changed=structuredClone(after);changed.v2_rate_limits.push({id:'DUMMY'});
 assert.throws(()=>assertResumeState(before,after,changed));
 const damaged=structuredClone(after);damaged.v2_documents[0].title='changed';
 assert.throws(()=>assertResumeState(before,damaged,damaged));
});
test('update verification rejects record changes, missing audits, account promotion, bad folder links, and disabled references',()=>{
 for(const mutate of [
  a=>a.v2_documents[0].title='changed',a=>a.v2_audit.shift(),a=>a.users[1].password_hash='changed',
  a=>a.users[1].role_id=3,a=>a.v2_import_items[0].state='duplicate',a=>a.v2_documents.push({id:'DUMMY leftover'}),
  a=>a.v2_document_folders[0].folder_id='DUMMY missing-folder',a=>a.v2_master_values.find(row=>row.id==='DUMMY-kind').is_active=0,
  a=>a.v2_documents[0].map_parent_id='DUMMY-unsafe',a=>a.v2_documents[0].date_status='verified',
 ]){const {before,after}=fixture();mutate(after);assert.throws(()=>assertUpdateRetained(before,after));}
});
