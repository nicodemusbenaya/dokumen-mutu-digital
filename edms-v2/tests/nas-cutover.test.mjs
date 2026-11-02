import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {clientConfig,composeText,runtimeViews,assertAfterSmoke,restoreRecovery,publicOrigin} from '../scripts/nas-cutover-lib.mjs';
import {allTables} from '../scripts/empty-register-core.mjs';
import {readOnlyTestRole} from './integration-roles.mjs';

test('runtime views retain other services, secrets and original port; stage binds only loopback',()=>{
 const base={services:{'edms-app':{container_name:'edms-ups-app',image:'edms-ups:2.1.0',working_dir:'/opt/edms',command:['node','scripts/start.mjs'],ports:[{target:3000,published:'3000'}],environment:{JWT_SECRET:'DUMMY$literal',DB_USER:'root'},volumes:[{target:'/app/storage',source:'/DUMMY'}]},cloudflared:{command:['DUMMY$token']}}};
 const {release,staging}=runtimeViews(base,{DB_USER:'DUMMY-limited',DB_PASSWORD:'DUMMY-safe'});
 assert.deepEqual(release.services.cloudflared,base.services.cloudflared);assert.deepEqual(release.services['edms-app'].ports,base.services['edms-app'].ports);
 assert.equal(release.services['edms-app'].environment.JWT_SECRET,'DUMMY$literal');assert.equal(base.services['edms-app'].environment.DB_USER,'root');
 assert.equal(staging.services['edms-app'].ports[0].host_ip,'127.0.0.1');
 assert.equal(JSON.parse(composeText(release)).services['edms-app'].environment.JWT_SECRET,'DUMMY$$literal');
});
test('native client credentials remain quoted, never parsed as extra options',()=>{
 const cnf=clientConfig({DB_USER:'DUMMY',DB_PASSWORD:'DUMMY " \\ #\nnext\rline'});
 assert(cnf.includes('password="DUMMY \\" \\\\ #\\nnext\\rline"\n'));assert.equal(cnf.split('\n').length,8);
});
test('public origin comes from the latest matching tunnel route and ambiguous domains block before cutover',()=>{
 const config={ingress:[{hostname:'dummy-edms.example',service:'http://edms-app:3000'},{hostname:'dummy-other.example',service:'http://other:8080'}]};
 const line='INF Updated to new configuration config='+JSON.stringify(JSON.stringify(config))+' version=2';
 assert.equal(publicOrigin({tunnelLog:line,aliases:['edms-app']}),'https://dummy-edms.example');
 assert.equal(publicOrigin({explicit:'https://dummy-explicit.example'}),'https://dummy-explicit.example');
 assert.throws(()=>publicOrigin({explicit:'http://dummy.example'}),/HTTPS/);
 assert.equal(publicOrigin({explicit:'http://10.10.200.166:3000'}),'http://10.10.200.166:3000');
 assert.equal(publicOrigin({current:'http://10.10.200.166:3000'}),'http://10.10.200.166:3000');
 for(const origin of ['http://10.10.200.166:3001','http://10.10.200.167:3000','http://10.10.200.166:3000/path','http://user@10.10.200.166:3000','http://10.10.200.166:3000?x=1'])assert.throws(()=>publicOrigin({explicit:origin}),/HTTPS/);
 config.ingress.push({hostname:'dummy-second.example',service:'http://edms-app:3000'});
 assert.throws(()=>publicOrigin({tunnelLog:line+'\n'+JSON.stringify({config:JSON.stringify(config)}),aliases:['edms-app']}),/Cannot determine/);
});
test('post-smoke verification requires all original users, masters and audits and empty register',()=>{
 const before=Object.fromEntries(allTables.map(t=>[t,[]]));before.users=[{id:1,username:'DUMMY-old'}];before.v2_audit=[{id:1,action:'DUMMY-system'}];before.v2_rate_limits=[{bucket:'DUMMY-old',hits:1}];
 const after=structuredClone(before);after.v2_audit.push({id:2,action:'first_release_empty_register'});after.v2_rate_limits[0].hits=2;
 assertAfterSmoke(before,after);
 after.users[0].username='DUMMY-changed';assert.throws(()=>assertAfterSmoke(before,after),/Protected table changed/);after.users=structuredClone(before.users);
 after.v2_audit.shift();assert.throws(()=>assertAfterSmoke(before,after),/Existing audit changed/);
});
test('rollback restores missing originals by hash and never overwrites a differing file',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'DUMMY-cutover-'));
 try{
  const src=path.join(root,'backup'),dest=path.join(root,'storage'),relative='originals/00000000-0000-0000-0000-000000000001.pdf';
  await fs.mkdir(path.join(src,'originals'),{recursive:true});await fs.writeFile(path.join(src,relative),'DUMMY');
  const files=[{diskPath:relative,sha256:createHash('sha256').update('DUMMY').digest('hex')}];
  assert.equal(await restoreRecovery(files,src,dest),1);assert.equal(await restoreRecovery(files,src,dest),1);
  await fs.chmod(path.join(dest,relative),0o600);await fs.writeFile(path.join(dest,relative),'DUMMY-other');
  await assert.rejects(restoreRecovery(files,src,dest),/will not overwrite/);assert.equal(await fs.readFile(path.join(dest,relative),'utf8'),'DUMMY-other');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('cutover entry rejects direct execution and unexpected rehearsal DB host',()=>{
 const env={...process.env};delete env.EDMS_CUTOVER;
 let r=spawnSync(process.execPath,['scripts/nas-cutover.mjs','apply'],{env,encoding:'utf8'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Use the cutover wrapper/);
 r=spawnSync(process.execPath,['scripts/nas-cutover.mjs','apply'],{env:{...env,EDMS_CUTOVER:'guarded',RESTORE_TEST_RUN:'DUMMY-RESTORE-000000000000',RESTORE_DB_HOST:'10.10.200.166'},encoding:'utf8'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Unexpected rehearsal DB host/);assert.doesNotMatch(r.stderr,/ECONN|ENOENT/);
});
test('NAS authorization test uses existing legacy read-only role without inserting or changing roles',()=>{
 const old=[{id:1,name:'Penyusun Dokumen'},{id:2,name:'Tim Mutu'},{id:5,name:'Admin Sistem'}];
 const before=structuredClone(old);assert.equal(readOnlyTestRole(old).id,2);assert.deepEqual(old,before);
 assert.equal(readOnlyTestRole([...old,{id:6,name:'Viewer'}]).id,6);
 assert.throws(()=>readOnlyTestRole([{id:5,name:'Admin Sistem'}]),/No existing read-only role/);
});
