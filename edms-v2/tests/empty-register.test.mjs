import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {allTables,targetTables,preservedTables,snapshot,makePlan,applyPlan,hash} from '../scripts/empty-register-core.mjs';

const backup='a'.repeat(64);
function fixture(){
 const s=Object.fromEntries(allTables.map(t=>[t,[]]));
 Object.assign(s,{users:[{id:1,username:'DUMMY',password_hash:'DUMMY-protected'}],roles:[{id:1}],references:[{id:1}],
  audit_logs:[{id:1,document_id:7,action_type:'DUMMY-account-action'}],v2_audit:[{id:1,document_id:'DUMMY-doc',action:'DUMMY-user-action'}],
  v2_master_values:[{id:'DUMMY-master'}],v2_migrations:[{version:'003'}],v2_rate_limits:[{bucket:'DUMMY-system'}],
  v2_documents:[{id:'DUMMY-doc'}],v2_versions:[{id:'DUMMY-version',document_id:'DUMMY-doc'}],
  v2_files:[{id:'DUMMY-file',version_id:'DUMMY-version',source_id:null,disk_path:'originals/DUMMY.pdf',sha256:'b'.repeat(64),size:5}],
  v2_uploads:[{id:'DUMMY-upload'}],v2_parts:[{upload_id:'DUMMY-upload',number:0}],
  v2_jobs:[{id:'DUMMY-job',source_id:'DUMMY-file',upload_id:'DUMMY-upload'}],
  v2_import_items:[{id:'DUMMY-item',job_id:'DUMMY-job',document_id:'DUMMY-doc',file_id:'DUMMY-file'}]});
 return s;
}
function database(initial,{failTable,mutateProtected=false}={}){
 let state=structuredClone(initial),save;const events=[];
 return {events,get state(){return structuredClone(state)},
  async query(sql){
   if(sql.includes('information_schema.TABLES'))return [Object.keys(state).map(name=>({name,engine:'InnoDB'}))];
   if(sql.includes('information_schema.TRIGGERS'))return [[]];
   if(sql.includes('GET_LOCK')){events.push('lock');return [[{acquired:1}]];}
   if(sql.includes('RELEASE_LOCK')){events.push('release');return [[{}]];}
   if(sql.startsWith('SET TRANSACTION'))return [[]];
   const table=sql.match(/^SELECT \* FROM `([^`]+)`/)[1];return [structuredClone(state[table])];
  },
  async execute(sql,args){
   if(sql.startsWith('INSERT INTO v2_audit')){state.v2_audit.push({id:2,actor_name:args[0],action:args[1],context_json:args[2]});return [{affectedRows:1}];}
   const table=sql.match(/^DELETE FROM `([^`]+)`/)[1];
   assert(targetTables.includes(table));if(table===failTable)throw Error('DUMMY injected failure');
   const keys=table==='v2_parts'?['upload_id','number']:['id'];
   const old=state[table].length;state[table]=state[table].filter(r=>!keys.every((k,i)=>r[k]===args[i]));
   if(mutateProtected)state.users[0].username='DUMMY-invalid-side-effect';
   return [{affectedRows:old-state[table].length}];
  },
  async beginTransaction(){events.push('begin');save=structuredClone(state)},
  async commit(){events.push('commit')},async rollback(){events.push('rollback');state=save}
 };
}
test('empty transition deletes manifest IDs and retains accounts, masters and all existing audits',async()=>{
 const before=fixture(),c=database(before),plan=makePlan(before,backup);
 const result=await applyPlan(c,plan);assert(result.passed);
 for(const t of targetTables)assert.equal(c.state[t].length,0);
 for(const t of preservedTables.filter(t=>t!=='v2_audit'))assert.deepEqual(c.state[t],before[t]);
 assert.deepEqual(c.state.v2_audit[0],before.v2_audit[0]);assert.equal(c.state.v2_audit.length,2);
 assert.deepEqual(c.events,['lock','begin','commit','release']);
});
test('changed account data rejects stale manifest before any deletion',async()=>{
 const before=fixture(),changed=structuredClone(before);changed.users[0].username='DUMMY-changed';
 const c=database(changed);await assert.rejects(applyPlan(c,makePlan(before,backup)),/Database changed/);
 assert.deepEqual(c.state,changed);assert.deepEqual(c.events,['lock','begin','rollback','release']);
});
test('failure after partial deletion rolls back documents, files and jobs before releasing lock',async()=>{
 const before=fixture(),c=database(before,{failTable:'v2_files'});
 await assert.rejects(applyPlan(c,makePlan(before,backup)),/DUMMY injected/);assert.deepEqual(c.state,before);
 assert.deepEqual(c.events,['lock','begin','rollback','release']);
});
test('a protected-table side effect rolls back the whole transition',async()=>{
 const before=fixture(),c=database(before,{mutateProtected:true});
 await assert.rejects(applyPlan(c,makePlan(before,backup)),/Protected data changed/);assert.deepEqual(c.state,before);
});
test('unknown tables, unowned lineage and existing exports block cleanup',async()=>{
 const c=database({...fixture(),DUMMY_unknown:[]});await assert.rejects(snapshot(c),/Unexpected table set/);
 const s=fixture();s.v2_files[0].source_id='DUMMY-outside';assert.throws(()=>makePlan(s,backup),/lineage/);
 const x=fixture();x.v2_exports=[{id:'DUMMY-export'}];assert.throws(()=>makePlan(x,backup),/v2_exports/);
});
test('reapplying the previous manifest is rejected without changing the new state',async()=>{
 const c=database(fixture()),plan=makePlan(fixture(),backup);await applyPlan(c,plan);const after=hash(c.state);
 await assert.rejects(applyPlan(c,plan),/Database changed/);assert.equal(hash(c.state),after);
});
test('rehearsal entry point refuses production host before DB or file access',()=>{
 const result=spawnSync(process.execPath,['scripts/rehearse-empty-register.mjs'],{encoding:'utf8',env:{...process.env,RESTORE_TEST_RUN:'DUMMY-RESTORE-000000000000',RESTORE_DB_HOST:'10.10.200.166'}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Unexpected DB host/);assert.doesNotMatch(result.stderr,/ECONN|EACCES|ENOENT/);
});
