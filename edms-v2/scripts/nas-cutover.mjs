// Invoked by the guarded shell wrapper or a strictly isolated laptop rehearsal.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import mysql from 'mysql2/promise';
import {snapshot,makePlan,applyPlan,hash,targetTables} from './empty-register-core.mjs';
import {clientConfig,composeText,runtimeViews,assertAfterSmoke,restoreRecovery,publicOrigin} from './nas-cutover-lib.mjs';
assert.equal(process.env.EDMS_CUTOVER,'guarded','Use the cutover wrapper');
const mode=process.argv[2];
assert(['prepare','apply','verify','rollback-verify','smoke','health','compose-check'].includes(mode),'Unknown operation');
const test=process.env.RESTORE_TEST_RUN;
if(test){
 assert(/^DUMMY-RESTORE-[a-f0-9]{12}$/.test(test));
 assert.equal(process.env.RESTORE_DB_HOST,'edms-restore-db-'+test.toLowerCase(),'Unexpected rehearsal DB host');
 assert(process.env.RESTORE_DB_PASSWORD?.length>=32);
}else{assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');}
const json=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const save=async(name,value)=>fs.writeFile('/evidence/'+name,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const digest=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const bundle=await json('/transition/package.json'),plan=await json('/transition/empty-register-plan.json');
const receipt=await json('/transition/empty-register-result.json');
assert.equal(await digest('/backup/SHA256SUMS'),bundle.backupManifestSha256);
assert.equal(hash(plan),bundle.manifestSha256);assert.equal(hash(plan),receipt.manifestSha256);
assert(receipt.passed&&receipt.staleManifestRejected&&!receipt.productionTouched);
for(const file of bundle.files){
 assert(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(file.path)&&!file.path.split('/').includes('..'));
 assert.equal(await digest(path.join('/transition',file.path)),file.sha256,'Transition package changed');
}
const [old]=await json('/backup/old-container.inspect.json');
const env=Object.fromEntries(old.Config.Env.map(s=>{const n=s.indexOf('=');return [s.slice(0,n),s.slice(n+1)]}));
assert.equal(env.DB_NAME,'edms_ups');assert.equal(env.DB_HOST,'host.docker.internal');assert.equal(env.DB_PORT,'3307');
const admin={host:test?process.env.RESTORE_DB_HOST:env.DB_HOST,port:test?3306:3307,user:'root',password:test?process.env.RESTORE_DB_PASSWORD:env.DB_PASSWORD,database:'edms_ups',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,connectTimeout:10000};
assert.equal(env.DB_USER,'root','Administrative backup account changed');
if(mode==='health'){
 let ready=false;
 for(let n=0;n<90;n++){
  try{const r=await fetch((process.env.CUTOVER_BASE_URL||'http://edms-ups-app:3000')+'/api/v2/health',{signal:AbortSignal.timeout(2000)});if(r.ok&&(await r.json()).ok){ready=true;break}}catch{}
  if(n%10===0)console.log('HEALTH_WAIT: '+n+' seconds');
  await new Promise(r=>setTimeout(r,1000));
 }
 assert(ready,'Runtime health timeout');console.log('NAS_RUNTIME_HEALTH_PASS');
}else if(mode==='smoke'){
 const cfg=await json('/evidence/runtime-normalized.json');
 Object.assign(process.env,cfg.services['edms-app'].environment,{RUN_DUMMY_DB_TESTS:'true',TEST_BASE_URL:process.env.CUTOVER_BASE_URL||'http://edms-ups-app:3000',TEST_ORIGIN:cfg.services['edms-app'].environment.APP_ORIGIN});
 await import('./../tests/integration.mjs');
 console.log('NAS_DUMMY_SMOKE_PASS');
}else if(mode==='compose-check'){
 assert(['runtime-normalized.json','staging-normalized.json'].includes(process.env.COMPOSE_EXPECTED));
 const expected=await json('/evidence/'+process.env.COMPOSE_EXPECTED),actual=await json('/merged-compose.json');
 for(const key of ['image','working_dir','command','environment','ports','volumes'])
  assert.equal(hash(actual.services['edms-app'][key]),hash(expected.services['edms-app'][key]),'Compose rendering changed '+key);
 console.log('CUTOVER_COMPOSE_RENDER_PASS');
}else{
 const c=await mysql.createConnection(admin);
 try{
  if(mode==='prepare'){
   const [others]=await c.query('SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()');
   assert.equal(others.length,0,'Other EDMS database clients connected');
   const before=await snapshot(c);assert.deepEqual(makePlan(before,bundle.backupManifestSha256),plan,'Database changed');
   await save('baseline.json',before);
   const merged=await json('/merged-compose.json');
   let appOrigin;
   if(test)appOrigin=publicOrigin({explicit:'http://10.10.200.166:3000'});
   else{
    const aliases=['edms-app','edms-ups-app','10.10.200.166',...Object.values(old.NetworkSettings.Networks).map(n=>n.IPAddress)];
    appOrigin=publicOrigin({explicit:process.env.EDMS_PUBLIC_ORIGIN,current:merged.services['edms-app'].environment.APP_ORIGIN,tunnelLog:await fs.readFile('/secrets/tunnel.log','utf8'),aliases});
   }
   const username='edms_v21_'+randomBytes(6).toString('hex'),password=randomBytes(32).toString('hex');
   // New limited account only. Existing MariaDB/app accounts and passwords stay intact.
   await c.query('CREATE USER ?@? IDENTIFIED BY ?',[username,'%',password]);
   const writable=['users',...targetTables,'v2_audit','v2_exports','v2_master_values','v2_rate_limits'];
   for(const t of new Set(writable))await c.query('GRANT SELECT, INSERT, UPDATE, DELETE ON `edms_ups`.`'+t+'` TO ?@?',[username,'%']);
   for(const t of ['roles','references','signatures','v2_migrations'])await c.query('GRANT SELECT ON `edms_ups`.`'+t+'` TO ?@?',[username,'%']);
   const {release,staging}=runtimeViews(merged,{DB_HOST:admin.host,DB_PORT:String(admin.port),DB_USER:username,DB_PASSWORD:password,APP_ORIGIN:appOrigin});
   const rollback=await json('/original-compose.json');
   assert(/^edms-ups-rollback:cutover-[a-z0-9-]+$/.test(process.env.ROLLBACK_IMAGE||''),'Missing private runtime rollback image');
   Object.assign(rollback.services['edms-app'],{image:process.env.ROLLBACK_IMAGE,working_dir:old.Config.WorkingDir,command:old.Config.Cmd,entrypoint:old.Config.Entrypoint,user:old.Config.User||'0:0',volumes:structuredClone(release.services['edms-app'].volumes)});
   await fs.writeFile('/evidence/rollback-compose.json',composeText(rollback),{flag:'wx',mode:0o600});
   await save('runtime-normalized.json',release);await save('staging-normalized.json',staging);
   for(const [name,value] of [['runtime-compose.json',release],['staging-compose.json',staging]])
    await fs.writeFile('/evidence/'+name,composeText(value),{flag:'wx',mode:0o600});
   const runtimeEnv=release.services['edms-app'].environment;
   assert(Object.entries(runtimeEnv).every(([k,v])=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)&&!/[\r\n]/.test(String(v))),'Environment cannot be encoded safely');
   await fs.writeFile('/evidence/runtime.env',Object.entries(runtimeEnv).map(([k,v])=>k+'='+v).join('\n')+'\n',{flag:'wx',mode:0o600});
   if(!test)await fs.writeFile('/secrets/client.cnf',clientConfig(env),{flag:'wx',mode:0o600});
   const limited=await mysql.createConnection({...admin,user:username,password});
   try{await limited.query('SELECT 1');const [grants]=await limited.query('SHOW GRANTS');assert(!JSON.stringify(grants).includes('ALL PRIVILEGES'),'Runtime account is not restricted');await limited.beginTransaction();await limited.query("SELECT id FROM roles WHERE name='Admin Sistem' FOR UPDATE");await limited.rollback();}finally{await limited.end();}
   await save('prepare-result.json',{passed:true,manifestSha256:hash(plan),restrictedDbAccount:true,rehearsal:!!test});
   console.log('CUTOVER_PREPARE_PASS: restricted runtime account; APP_ORIGIN='+appOrigin);
  }else if(mode==='apply'){
   const prepared=await json('/evidence/prepare-result.json');assert(prepared.passed&&prepared.manifestSha256===hash(plan));
   const [others]=await c.query('SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()');
   assert.equal(others.length,0,'Other EDMS database clients connected');
   const result=await applyPlan(c,plan);
   await save('apply-result.json',result);console.log('NAS_EMPTY_REGISTER_APPLIED: '+JSON.stringify(result));
  }else if(mode==='verify'){
   const before=await json('/evidence/baseline.json'),after=await snapshot(c);
   assertAfterSmoke(before,after);
   await save('smoke-verified.json',{passed:true,protectedDataVerified:true,registerEmpty:true,rehearsal:!!test});
   console.log('NAS_PROTECTED_DATA_AND_EMPTY_REGISTER_PASS');
  }else if(mode==='rollback-verify'){
   assert.deepEqual(makePlan(await snapshot(c),bundle.backupManifestSha256),plan,'Restored DB differs from baseline');
   const files=await restoreRecovery(plan.files,'/transition/recovery','/app/storage');
   await save('rollback-verified.json',{passed:true,databaseRestored:true,originalsRestoredAndVerified:files,rehearsal:!!test});
   console.log('NAS_ROLLBACK_DATABASE_AND_ORIGINALS_PASS: '+files);
  }
 }finally{await c.end();}
}
