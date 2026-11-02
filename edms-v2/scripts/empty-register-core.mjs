// Shared transaction for the first-release empty-register transition.
// No environment loading, filesystem deletion, DDL, or account reset.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const targetTables=['v2_parts','v2_import_items','v2_jobs','v2_uploads','v2_files','v2_versions','v2_documents'];
export const preservedTables=['approvals','audit_logs','documents','document_references','document_sections','document_versions','references','roles','signatures','users','v2_audit','v2_document_folders','v2_exports','v2_folder_nodes','v2_master_values','v2_migrations','v2_rate_limits'];
export const allTables=[...targetTables,...preservedTables].sort();
const optionalTables=new Set(['v2_document_folders','v2_folder_nodes']);
const keys=Object.fromEntries(targetTables.map(t=>[t,t==='v2_parts'?['upload_id','number']:['id']]));
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?
 Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
export const hash=value=>createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
const canonical=rows=>rows.map(row=>Object.fromEntries(Object.keys(row).sort().map(k=>[k,row[k]])))
 .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));

export async function snapshot(c,{lock=false}={}){
 const [tables]=await c.query("SELECT TABLE_NAME name, ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
 const actual=tables.map(t=>t.name).sort();
 const expected=allTables.filter(name=>actual.includes(name)||!optionalTables.has(name));
 assert.deepEqual(actual,expected,'Unexpected table set; transition requires a new review');
 assert(tables.every(t=>t.engine==='InnoDB'),'Nontransactional table found');
 const [triggers]=await c.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()');
 assert.equal(triggers.length,0,'Triggers require a separate transition review');
 const result={};
 for(const name of allTables){
  if(!actual.includes(name)){result[name]=[];continue;}
  const [rows]=await c.query('SELECT * FROM `'+name+'`'+(lock?' FOR UPDATE':''));result[name]=canonical(rows);
 }
 return result;
}

export function makePlan(data,backupManifestSha256){
 assert(/^[a-f0-9]{64}$/i.test(backupManifestSha256),'Missing backup binding');
 assert(data.users.length>0,'Accounts missing');
 for(const name of ['documents','document_versions','document_sections','document_references','approvals','v2_exports'])
  assert.equal(data[name].length,0,'Unexpected existing rows in '+name);
 const docs=new Set(data.v2_documents.map(r=>r.id)),versions=new Set(data.v2_versions.map(r=>r.id));
 const files=new Set(data.v2_files.map(r=>r.id)),jobs=new Set(data.v2_jobs.map(r=>r.id)),uploads=new Set(data.v2_uploads.map(r=>r.id));
 assert(data.v2_versions.every(r=>docs.has(r.document_id)),'Unowned version');
 assert(data.v2_files.every(r=>versions.has(r.version_id)&&(!r.source_id||files.has(r.source_id))),'Unowned/shared file lineage');
 assert(data.v2_parts.every(r=>uploads.has(r.upload_id)),'Unowned upload part');
 assert(data.v2_jobs.every(r=>(!r.upload_id||uploads.has(r.upload_id))&&(!r.source_id||files.has(r.source_id))),'Unowned job source');
 assert(data.v2_import_items.every(r=>jobs.has(r.job_id)&&(!r.document_id||docs.has(r.document_id))&&(!r.file_id||files.has(r.file_id))),'Unowned import result');
 return {version:1,decision:'empty-v2-register',backupManifestSha256:backupManifestSha256.toLowerCase(),
  snapshotSha256:hash(data),preservedSha256:hash(Object.fromEntries(preservedTables.map(t=>[t,data[t]]))),
  counts:Object.fromEntries(allTables.map(t=>[t,data[t].length])),
  targets:Object.fromEntries(targetTables.map(t=>[t,data[t].map(r=>Object.fromEntries(keys[t].map(k=>[k,r[k]])))])),
  files:data.v2_files.map(r=>({id:r.id,diskPath:r.disk_path,sha256:r.sha256,size:String(r.size)}))};
}

export async function applyPlan(c,plan){
 assert.equal(plan.version,1);assert.equal(plan.decision,'empty-v2-register');
 const [lock]=await c.query("SELECT GET_LOCK('edms-first-release-empty-register',0) acquired");
 assert.equal(Number(lock[0].acquired),1,'Another transition is running');
 let begun=false;
 try{
  await c.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  await c.beginTransaction();begun=true;
  const before=await snapshot(c,{lock:true});
  const current=makePlan(before,plan.backupManifestSha256);
  assert.deepEqual(current,plan,'Database changed since the reviewed manifest');
  for(const table of targetTables){
   for(const row of plan.targets[table]){
    const columns=keys[table];
    const [result]=await c.execute('DELETE FROM `'+table+'` WHERE '+columns.map(k=>'`'+k+'`=?').join(' AND '),columns.map(k=>row[k]));
    assert.equal(result.affectedRows,1,'Scoped deletion count mismatch: '+table);
   }
  }
  const after=await snapshot(c,{lock:true});
  for(const table of targetTables)assert.equal(after[table].length,0,'Register not empty: '+table);
  for(const table of preservedTables)assert.equal(hash(after[table]),hash(before[table]),'Protected data changed: '+table);
  await c.execute('INSERT INTO v2_audit(actor_id,actor_name,action,document_id,context_json) VALUES(NULL,?,?,NULL,?)',
   ['System transition','first_release_empty_register',JSON.stringify({manifestSha256:hash(plan),backupManifestSha256:plan.backupManifestSha256,counts:plan.counts,originalFilesDeleted:false})]);
  await c.commit();begun=false;
  return {passed:true,manifestSha256:hash(plan),deleted:Object.fromEntries(targetTables.map(t=>[t,plan.counts[t]])),protectedTablesVerified:preservedTables.length,originalFilesDeleted:false};
 }catch(e){if(begun)await c.rollback();throw e;}
 finally{await c.query("SELECT RELEASE_LOCK('edms-first-release-empty-register')");}
}
