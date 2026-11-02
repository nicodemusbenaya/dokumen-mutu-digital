import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

test('NAS backup credentials stay in a quoted client file, including special characters',async()=>{
 const source=await fs.readFile('scripts/nas-backup.sh','utf8');
 const code=source.split('docker exec "$APP" node -e \'')[1].split("' > \"$CLIENT\"")[0];
 let output='';
 vm.runInNewContext(code,{require:()=>({loadEnvConfig(){}}),process:{env:{DB_HOST:'host.docker.internal',DB_PORT:'3307',DB_NAME:'edms_ups',DB_USER:'DUMMY',DB_PASSWORD:'DUMMY # " \\ space\nnext\rline'},stdout:{write:s=>output+=s},exit:()=>{throw new Error('Unexpected reject')}}});
 assert(output.includes('host=127.0.0.1\n'));
 assert(output.includes('password="DUMMY # \\" \\\\ space\\nnext\\rline"\n'));
 assert.equal(output.split('\n').length,7);
});

test('restore DB validator rejects a production NAS host before opening a connection',()=>{
 const result=spawnSync(process.execPath,['scripts/verify-restored-db.mjs'],{encoding:'utf8',env:{...process.env,
  RESTORE_TEST_RUN:'DUMMY-RESTORE-000000000000',RESTORE_DB_HOST:'10.10.200.166',RESTORE_DB_PASSWORD:'DUMMY'.repeat(10),RESTORE_SOURCE:'/backup'}});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Unexpected DB host/);
 assert.doesNotMatch(result.stderr,/ECONN|EACCES|ETIMEDOUT/);
});

test('event backup preserves readable definitions and only skips inaccessible events proven absent',async t=>{
 const source=await fs.readFile('scripts/nas-backup.sh','utf8');
 const code=source.split('# EVENT_PROBE_BEGIN')[1].split('docker exec "$APP" node -e \'')[1].split("' > \"$BACKUP/event-policy.txt\"")[0];
 for(const scenario of [
  {name:'disabled scheduler and proven empty system table',scheduler:'DISABLED',unavailable:true,total:'0',pass:true,inventory:'system-table-empty',count:0},
  {name:'inaccessible definitions exist',scheduler:'DISABLED',unavailable:true,total:'1',pass:false},
  {name:'system table cannot be read',scheduler:'DISABLED',unavailable:true,denied:true,pass:false},
  {name:'running scheduler and inaccessible metadata',scheduler:'ON',unavailable:true,total:'0',pass:false},
  {name:'readable definitions retained while scheduler off',scheduler:'OFF',events:[{name:'DUMMY-event',status:'ENABLED'}],pass:true,inventory:'information-schema',count:1},
  {name:'running scheduler with active event',scheduler:'ON',events:[{name:'DUMMY-event',status:'ENABLED'}],pass:false},
 ])await t.test(scenario.name,async()=>{
  let output='',closed=false;const errors=[];
  const process={env:{DB_HOST:'DUMMY-host',DB_PORT:'3307',DB_USER:'DUMMY',DB_PASSWORD:'DUMMY',DB_NAME:'edms_ups'},stdout:{write:s=>output+=s},exitCode:0};
  const db={async query(sql,args){
   assert(sql.startsWith('SELECT '),'Event probe must never mutate the database');
   if(sql.includes('@@GLOBAL.event_scheduler'))return [[{scheduler:scenario.scheduler}]];
   if(sql.includes('information_schema.EVENTS')){
    if(scenario.unavailable)throw Object.assign(new Error('DUMMY scheduler metadata unavailable'),{errno:1577,code:'ER_EVENTS_DB_ERROR'});
    return [scenario.events||[]];
   }
   if(sql.includes('mysql.event')){
    assert.deepEqual(Array.from(args),['edms_ups']);
    if(scenario.denied)throw Object.assign(new Error('DUMMY access denied'),{errno:1142,code:'ER_TABLEACCESS_DENIED_ERROR'});
    return [[{total:scenario.total}]];
   }
   throw new Error('Unexpected query');
  },async end(){closed=true;}};
  await vm.runInNewContext(code,{require:name=>name==='@next/env'?{loadEnvConfig(){}}:{async createConnection(){return db;}},process,console:{error:(...args)=>errors.push(args.join(' '))}});
  assert(closed,'Connection was not released');
  assert.equal(process.exitCode===0,scenario.pass,errors.join('\n'));
  if(scenario.pass){assert(output.includes('inventory='+scenario.inventory+'\n'));assert(output.includes('expectedCount='+scenario.count+'\n'));}
  else{assert.equal(output,'');assert(errors.some(e=>e.includes('EVENT_PROBE_BLOCKED')));}
 });
});

test('restore readiness requires successful authenticated TCP SQL and rejects production container identity',{skip:process.platform!=='win32'},async()=>{
 const root=path.resolve('tests/output/DUMMY-backup-gates');await fs.mkdir(root,{recursive:true});
 const harness=path.join(root,'auth-harness.ps1');
 await fs.writeFile(harness,`param([string]$Helper)
. $Helper
$global:dummyAuthAttempts=0
function docker {
 if($args[0] -eq 'inspect'){$global:LASTEXITCODE=0;return 'running'}
 if($args[0] -ne 'exec' -or $args -contains 'mariadb-admin' -or $args -notcontains '--protocol=TCP' -or $args -notcontains 'SELECT 1'){throw 'Unexpected readiness operation'}
 $global:dummyAuthAttempts++
 if($global:dummyAuthAttempts -eq 1){$global:LASTEXITCODE=1;return '1'}
 $global:LASTEXITCODE=0;return '1'
}
try{
 $ok=Wait-RestoreTestDatabase -Name 'edms-restore-db-dummy-restore-000000000000' -RunId 'DUMMY-RESTORE-000000000000' -Attempts 2
 if(-not $ok -or $global:dummyAuthAttempts -ne 2){throw 'Readiness accepted a failed authentication'}
 $rejected=$false
 try{Wait-RestoreTestDatabase -Name 'edms-ups-app' -RunId 'DUMMY-RESTORE-000000000000' -Attempts 1|Out-Null}catch{$rejected=$true}
 if(-not $rejected -or $global:dummyAuthAttempts -ne 2){throw 'Production container identity was not blocked'}
 Write-Output 'AUTHENTICATED_READY_GUARD_PASS';exit 0
}catch{Write-Output $_.Exception.Message;exit 1}
`);
 const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',harness,'-Helper',path.resolve('scripts/restore-test-db.ps1')],{encoding:'utf8',windowsHide:true,timeout:15000});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/AUTHENTICATED_READY_GUARD_PASS/);
});

test('restore verifier refuses corrupt/incomplete manifests before creating any Docker resource',{skip:process.platform!=='win32'},async()=>{
 const root=path.resolve('tests/output/DUMMY-backup-gates');await fs.mkdir(root,{recursive:true});
 const harness=path.join(root,'guard-harness.ps1');
 await fs.writeFile(harness,`param([string]$BackupPath,[string]$Verifier,[string]$MutationLog)
function docker {
 if($args[0] -eq 'info'){$global:LASTEXITCODE=0;Write-Output 'linux';return}
 if($args[0] -eq 'ps'){$global:LASTEXITCODE=0;return}
 if(($args -contains 'inspect')){$global:LASTEXITCODE=1;return}
 Add-Content -LiteralPath $MutationLog -Value ($args -join ' ')
 throw 'Docker mutation must not happen before backup verification'
}
try{& $Verifier -Backup $BackupPath;exit 0}catch{Write-Output $_.Exception.Message;exit 1}
`);
 for(const scenario of ['corrupt','missing-entry']){
  const backup=path.join(root,scenario),mutations=path.join(root,scenario+'-mutations.log');await fs.mkdir(backup,{recursive:true});
  await fs.rm(mutations,{force:true});
  const data='DUMMY SQL ONLY';await fs.writeFile(path.join(backup,'database.sql'),data);
  await fs.writeFile(path.join(backup,'backup-state.txt'),'backupComplete=true\n');
  await fs.writeFile(path.join(backup,'SHA256SUMS'),(scenario==='corrupt'?'0'.repeat(64):createHash('sha256').update(data).digest('hex'))+'  database.sql\n');
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',harness,'-BackupPath',backup,'-Verifier',path.resolve('scripts/verify-nas-backup.ps1'),'-MutationLog',mutations],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.notEqual(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,scenario==='corrupt'?/Backup checksum mismatch/:/Required backup entry missing/);
  assert.equal(await fs.access(mutations).then(()=>true,()=>false),false,'Docker resources created from invalid backup');
 }
});
