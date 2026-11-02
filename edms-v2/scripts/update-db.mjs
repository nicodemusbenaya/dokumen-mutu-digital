// Update existing v2 data only. No legacy cleanup or register-emptying operation.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {snapshot,hash} from './empty-register-core.mjs';
import {migrateRoles} from './role-migration.mjs';
import {assertUpdateRetained,verifyStoredFiles,comparableDocument,assertResumeState} from './update-retention.mjs';
import {clientConfig} from './nas-cutover-lib.mjs';
import {migrateFolderData} from './folder-migration.mjs';
import {explorerSqlForDatabase} from './explorer-schema.mjs';
import {grantRuntimeFolders} from './runtime-folder-grants.mjs';

assert.equal(process.env.EDMS_UPDATE,'guarded','Use the guarded update/rehearsal wrapper');
assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
const mode=process.argv[2],test=process.env.RESTORE_TEST_RUN;
assert(['baseline','baseline-check','migrate','rehearse','verify','rollback-verify','smoke','inventory','client','rollback-cleanup','resume-check'].includes(mode));
let config;
if(test){
 assert(/^DUMMY-RESTORE-[a-f0-9]{12}$/.test(test));
 assert.equal(process.env.RESTORE_DB_HOST,'edms-restore-db-'+test.toLowerCase());
 config={host:process.env.RESTORE_DB_HOST,port:3306,user:'root',password:process.env.RESTORE_DB_PASSWORD,database:'edms_ups'};
}else{
 // Read administrative credentials only; never restore data from this historical checkpoint.
 const [adminSource]=JSON.parse(await fs.readFile('/admin-source.json','utf8'));
 const e=Object.fromEntries(adminSource.Config.Env.map(value=>{const i=value.indexOf('=');return [value.slice(0,i),value.slice(i+1)];}));
 assert.equal(e.DB_NAME,'edms_ups');assert.equal(e.DB_USER,'root');assert.equal(String(e.DB_PORT),'3307');
 assert(['host.docker.internal','10.10.200.166'].includes(e.DB_HOST));
 config={host:e.DB_HOST,port:3307,user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME};
}
assert(config.password);
const json=async name=>JSON.parse((await fs.readFile('/evidence/'+name,'utf8')).replace(/^\uFEFF/,''));
const save=async(name,value)=>fs.writeFile('/evidence/'+name,JSON.stringify(value,null,2),{mode:0o600});
async function uploadSchema(c){
 const source=await fs.readFile('/ops/sql/005_upload_folders.sql','utf8');
 for(const statement of source.replace(/^\uFEFF/,'').split(';').filter(s=>s.trim()))await c.query(statement);
 await c.query('INSERT IGNORE INTO v2_migrations(version,detail) VALUES(?,?)',['005','Allow shared document codes; stable ZIP entry identity; records preserved']);
}
async function explorerSchema(c){
 const source=await fs.readFile('/ops/sql/006_file_explorer.sql','utf8');
 const sql=await explorerSqlForDatabase(c,source);
 for(const statement of sql.replace(/^\uFEFF/,'').split(';').filter(s=>s.trim()))await c.query(statement);
 const folders=await migrateFolderData(c);
 await c.query('INSERT IGNORE INTO v2_migrations(version,detail) VALUES(?,?)',['006','Additive folder tree; filename classification masters; source records preserved']);
 return folders;
}
async function documentMapSchema(c){
 const source=await fs.readFile('/ops/sql/007_document_map.sql','utf8');
 for(const statement of source.replace(/^\uFEFF/,'').split(';').filter(s=>s.trim()))await c.query(statement);
 await c.query('INSERT IGNORE INTO v2_migrations(version,detail) VALUES(?,?)',['007','Additive document hierarchy and dates; source records preserved']);
}
async function attachmentMaster(c){
 const source=await fs.readFile('/ops/sql/008_lampiran.sql','utf8');
 for(const statement of source.replace(/^\uFEFF/,'').split(';').filter(s=>s.trim()))await c.query(statement);
 await c.query('INSERT IGNORE INTO v2_migrations(version,detail) VALUES(?,?)',['008','Activate Lampiran document kind; source records preserved']);
}
if(mode==='client'){
 assert(!test);
 await fs.writeFile('/secrets/client.cnf',clientConfig({DB_USER:config.user,DB_PASSWORD:config.password}),{flag:'wx',mode:0o600});
}else if(mode==='smoke'){
 assert(!test,'Smoke rehearsal uses the release verifier');
 Object.assign(process.env,{DB_HOST:config.host,DB_PORT:String(config.port),DB_USER:config.user,DB_PASSWORD:config.password,DB_NAME:config.database,RUN_DUMMY_DB_TESTS:'true',STORAGE_ROOT:'/app/storage',TEST_BASE_URL:'http://edms-ups-app:3000',TEST_ORIGIN:'http://10.10.200.166:3000'});
 await import('../tests/integration.mjs');
 await save('smoke-pass.json',{passed:true,syntheticOnly:true});
}else{
 const c=await mysql.createConnection({...config,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,connectTimeout:15000});
 try{
  if(mode==='inventory'){
   const [docs]=await c.query('SELECT COUNT(*) total FROM v2_documents'),[users]=await c.query('SELECT COUNT(*) total FROM users');
   console.log(JSON.stringify({documents:docs[0].total,accounts:users[0].total,adminConnectionVerified:true}));
  }else if(mode==='resume-check'){
   assert(!test);
   const [clients]=await c.query('SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()');assert.equal(clients.length,0,'Other EDMS database clients remain');
   const migration=await json('update-migration.json');assert(migration.passed&&migration.productionTouched);
   const current=await snapshot(c),before=await json('update-baseline.json');
   const retained=assertResumeState(before,await json('update-failed-state.json'),current);
   await verifyStoredFiles(current,'/app/storage');await save('update-resume-check.json',{passed:true,...retained});console.log('UPDATE_RESUME_CHECK_PASS');
  }else if(mode==='baseline-check'){
   assert(!test);
   const [clients]=await c.query('SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()');assert.equal(clients.length,0,'Other EDMS database clients remain');
   const before=await json('update-baseline.json');assert.equal(hash(await snapshot(c)),hash(before),'Database differs from backup; a fresh backup is required');
   await verifyStoredFiles(before,'/app/storage');console.log('EXISTING_BACKUP_MATCH_PASS');
  }else if(mode==='baseline'){
   const [clients]=await c.query('SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()');assert.equal(clients.length,0,'Other EDMS database clients remain');
   const before=await snapshot(c);await verifyStoredFiles(before,'/app/storage');
   await fs.writeFile('/evidence/update-baseline.json',JSON.stringify(before),{flag:'wx',mode:0o600});
   console.log('UPDATE_BASELINE_PASS '+JSON.stringify({documents:before.v2_documents.length,files:before.v2_files.length,accounts:before.users.length,sha256:hash(before)}));
  }else if(mode==='migrate'||mode==='rehearse'){
   if(mode==='rehearse')assert(test,'Rehearsal must use an isolated restored database');
   const before=await json('update-baseline.json');assert.equal(hash(await snapshot(c)),hash(before),'Database changed since backup');
   const restoredFiles=test?await verifyStoredFiles(before,'/restored/edms-app/storage'):null;
   const roles=await migrateRoles(c);await uploadSchema(c);const folders=await explorerSchema(c);await documentMapSchema(c);await attachmentMaster(c);const after=await snapshot(c);
   const retained=assertUpdateRetained(before,after);
   let runtimeGrants;
   if(!test){
    const [runtime]=await json('old-container.inspect.json');
    const env=Object.fromEntries(runtime.Config.Env.map(value=>{const i=value.indexOf('=');return [value.slice(0,i),value.slice(i+1)]}));
    assert.equal(env.DB_NAME,'edms_ups');runtimeGrants=await grantRuntimeFolders(c,env.DB_USER);
   }else{
    const username='edms_v21_0123456789ab',password='DUMMY-only-isolated-rehearsal';
    await c.query('CREATE USER ?@? IDENTIFIED BY ?',[username,'%',password]);
    try{await grantRuntimeFolders(c,username);await grantRuntimeFolders(c,username);
     const limited=await mysql.createConnection({...config,user:username,password});
     try{for(const table of ['v2_folder_nodes','v2_document_folders'])await limited.query('SELECT * FROM '+table+' LIMIT 0');
      await assert.rejects(limited.query('SELECT * FROM users LIMIT 0'),e=>e.code==='ER_TABLEACCESS_DENIED_ERROR');
     }finally{await limited.end();}
    }finally{await c.query('DROP USER ?@?',[username,'%']);}
    runtimeGrants={passed:true,isolatedLimitedAccount:true};
   }
   if(test){await migrateRoles(c);await uploadSchema(c);await explorerSchema(c);await documentMapSchema(c);await attachmentMaster(c);assert.equal(hash(await snapshot(c)),hash(after),'Update retry changed records');}
   await save(test?'update-rehearsal.json':'update-migration.json',{passed:true,productionTouched:!test,roles,folders,retained,runtimeGrants,restoredFilesHashVerified:restoredFiles,idempotencyVerified:!!test});
   console.log(test?'UPDATE_MIGRATION_REHEARSAL_PASS':'UPDATE_MIGRATION_PASS');
  }else if(mode==='rollback-cleanup'){
   assert(!test);const before=await json('update-baseline.json'),after=await snapshot(c);
   await save('update-failed-state.json',after);
   const baselinePaths=new Set(before.v2_files.map(f=>f.disk_path)),baselineDocs=new Set(before.v2_documents.map(d=>d.id));
   for(const table of ['v2_documents','v2_files','v2_versions']){
    const current=new Map(after[table].map(row=>[row.id,row]));
    assert(before[table].every(row=>{const found=current.get(row.id);return found&&hash(table==='v2_documents'?comparableDocument(row,found):found)===hash(row)}),'Unexpected existing-data change; preserve DB instead of automatic rollback');
   }
   assert(after.v2_documents.every(d=>baselineDocs.has(d.id)||/^DUMMY-/.test(d.test_tag||'')),'Unexpected real document writes; do not restore an earlier DB');
   const dummyDocs=new Set(after.v2_documents.filter(d=>!baselineDocs.has(d.id)&&/^DUMMY-/.test(d.test_tag||'')).map(d=>d.id));
   const versions=new Set(after.v2_versions.filter(v=>dummyDocs.has(v.document_id)).map(v=>v.id));
   const files=after.v2_files.filter(f=>versions.has(f.version_id)&&!baselinePaths.has(f.disk_path));
   const oldUploads=new Set(before.v2_uploads.map(u=>u.id)),oldJobs=new Set(before.v2_jobs.map(j=>j.id)),fileIds=new Set(files.map(f=>f.id));
   const uploads=after.v2_uploads.filter(u=>!oldUploads.has(u.id)&&/^DUMMY-/.test(JSON.parse(u.metadata).testTag||''));
   const uploadIds=new Set(uploads.map(u=>u.id)),jobs=after.v2_jobs.filter(j=>!oldJobs.has(j.id)&&(uploadIds.has(j.upload_id)||fileIds.has(j.source_id)));
   await save('update-rollback-dummy-files.json',{files:files.map(f=>({id:f.id,diskPath:f.disk_path,sha256:f.sha256})),uploads:uploads.map(u=>u.id),jobs:jobs.map(j=>j.id)});
   for(const f of files){assert(/^(originals|derived)\/[a-f0-9-]{36}\.(pdf|docx|xlsx)$/.test(f.disk_path));await fs.unlink(path.join('/app/storage',f.disk_path)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
   for(const [directory,records] of [['staging',uploads],['work',jobs]])for(const row of records){
    assert(/^[a-f0-9-]{36}$/.test(row.id));const target=path.resolve('/app/storage',directory,row.id);
    assert(target.startsWith('/app/storage/'+directory+'/'));
    const stat=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(stat){assert(stat.isDirectory()&&!stat.isSymbolicLink());await fs.rm(target,{recursive:true});}
   }
   await verifyStoredFiles(before,'/app/storage');console.log('UPDATE_ROLLBACK_FILES_PRESERVED');
  }else if(mode==='rollback-verify'){
   assert(test,'Rollback verifier only runs on the laptop');
   assert.equal(hash(await snapshot(c)),hash(await json('update-baseline.json')),'Restored rollback database differs');
   const receipt=await json('update-rehearsal.json');receipt.rollbackVerified=true;await save('update-rehearsal.json',receipt);
   console.log('UPDATE_ROLLBACK_REHEARSAL_PASS');
  }else{
   const before=await json('update-baseline.json'),after=await snapshot(c),retained=assertUpdateRetained(before,after);
   const files=await verifyStoredFiles(after,'/app/storage');
   await save('update-retention.json',{passed:true,...retained,filesHashVerified:files});
   console.log('UPDATE_RETENTION_PASS '+JSON.stringify(retained));
  }
 }finally{await c.end();}
}
