import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {copyRecoveryFile} from '../scripts/prepare-nas-transition.mjs';

test('recovery copy verifies source and copy, leaves original intact and rejects overwrite',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'DUMMY-recovery-'));
 try{
  const source=path.join(root,'source'),dest=path.join(root,'backup');
  await fs.mkdir(path.join(source,'originals'),{recursive:true});
  const diskPath='originals/00000000-0000-0000-0000-000000000001.pdf',data=Buffer.from('DUMMY');
  await fs.writeFile(path.join(source,diskPath),data);
  const file={diskPath,size:'5',sha256:createHash('sha256').update(data).digest('hex')};
  await copyRecoveryFile(source,dest,file);
  assert.deepEqual(await fs.readFile(path.join(source,diskPath)),data);
  assert.deepEqual(await fs.readFile(path.join(dest,diskPath)),data);
  await assert.rejects(copyRecoveryFile(source,dest,file),{code:'EEXIST'});
  await assert.rejects(copyRecoveryFile(source,path.join(root,'wrong'),{...file,sha256:'a'.repeat(64)}),/Original hash differs/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('recovery path traversal is rejected before any file access',async()=>{
 await assert.rejects(copyRecoveryFile('DUMMY-missing','DUMMY-missing',{diskPath:'../DUMMY.pdf',sha256:'a'.repeat(64)}),/Unsafe recovery path/);
});
test('NAS read-only entry point rejects direct invocation before DB connection',()=>{
 const env={...process.env};delete env.NAS_TRANSITION_CHECK;
 const r=spawnSync(process.execPath,['scripts/nas-transition-check.mjs'],{env,encoding:'utf8'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Must use the NAS check wrapper/);assert.doesNotMatch(r.stderr,/ECONN|EACCES|ENOENT/);
});
