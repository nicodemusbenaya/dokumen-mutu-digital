// Read-only NAS DB check. No .env loading and no mutation entry point.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
import {snapshot,makePlan,hash} from './empty-register-core.mjs';
assert.equal(process.env.NAS_TRANSITION_CHECK,'read-only','Must use the NAS check wrapper');
assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
const json=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const digest=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const bundle=await json('/transition/package.json');
assert.equal(bundle.version,1);
assert.equal(await digest('/backup/SHA256SUMS'),bundle.backupManifestSha256);
for(const f of bundle.files){
 assert(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(f.path)&&!f.path.split('/').includes('..'),'Unsafe bundle path');
 assert.equal(await digest(path.join('/transition',f.path)),f.sha256,'Package file changed');
}
const receipt=await json('/transition/empty-register-result.json');
const report=await json('/transition/result.json');
const plan=await json('/transition/empty-register-plan.json');
assert(receipt.passed&&receipt.staleManifestRejected&&!receipt.productionTouched&&report.passed&&report.emptyRegisterRehearsalVerified,'Missing passed rehearsal');
assert.equal(hash(plan),receipt.manifestSha256);assert.equal(hash(plan),bundle.manifestSha256);
assert.equal(plan.backupManifestSha256,bundle.backupManifestSha256);
assert.equal(bundle.recoveryFiles,plan.files.length);
for(const f of plan.files){
 const record=bundle.files.find(x=>x.path==='recovery/'+f.diskPath);
 assert(record&&record.sha256===f.sha256,'Original recovery copy absent');
}
const [old]=await json('/backup/old-container.inspect.json');
assert.equal(old.Name,'/edms-ups-app');
const env=Object.fromEntries(old.Config.Env.map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
assert.equal(env.DB_HOST,'host.docker.internal');assert.equal(env.DB_PORT,'3307');assert.equal(env.DB_NAME,'edms_ups');
assert(env.DB_USER&&env.DB_PASSWORD&&env.JWT_SECRET?.length>=32,'Existing configuration incomplete');
const compose=await json('/merged-compose.json'),service=compose.services?.['edms-app'];
assert(service,'Missing original Compose service');
assert.equal(service.container_name,'edms-ups-app');assert.equal(service.image,'edms-ups:2.1.0');
assert.equal(service.working_dir,'/opt/edms');assert.deepEqual(service.command,['node','scripts/start.mjs']);
for(const [target,source] of [['/app','/share/Container/edms-app'],['/app/storage','/share/Container/edms-app/storage']]){
 const mount=service.volumes?.find(v=>v.target===target);
 assert(mount&&mount.type==='bind'&&mount.source===source&&!mount.read_only,'Merged storage mount differs');
}
assert(service.ports?.some(p=>Number(p.target)===3000&&Number(p.published)===3000),'Original port mapping missing');
for(const key of ['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','JWT_SECRET','SESSION_COOKIE'])
 assert(service.environment?.[key]===env[key],'Merged configuration differs: '+key);
assert.equal(service.environment.STORAGE_ROOT,'/app/storage');
assert.equal(String(service.environment.WORKER_ENABLED),'true');
assert(!service.user||['node','1000','1000:1000'].includes(service.user),'Runtime user override needs review');
const c=await mysql.createConnection({host:env.DB_HOST,port:3307,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,connectTimeout:10000,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
try{
 const [others]=await c.query("SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()");
 assert.equal(others.length,0,'Other database clients remain connected; stop laptop development and all EDMS writers');
 await c.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
 await c.query('START TRANSACTION READ ONLY');
 const current=makePlan(await snapshot(c),bundle.backupManifestSha256);
 assert.deepEqual(current,plan,'NAS data differs from the successfully rehearsed snapshot');
 await c.rollback();
 const result={passed:true,kind:'NAS read-only transition readiness',manifestSha256:hash(plan),backupManifestSha256:bundle.backupManifestSha256,documents:plan.counts.v2_documents,recoveryOriginalsVerified:plan.files.length,mergedComposeVerified:true,databaseUnchanged:true,productionDataModified:false};
 await fs.writeFile('/evidence/nas-transition-check.json',JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 console.log('NAS_TRANSITION_CHECK_PASS: '+JSON.stringify(result));
}finally{await c.end();}
