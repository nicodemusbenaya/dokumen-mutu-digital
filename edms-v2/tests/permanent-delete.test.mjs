import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as core from '../src/lib/core.mjs';
import {validatePermanentDelete} from '../src/lib/permanent-delete.mjs';

const admin={id:1,role:'Super user'},target={id:'10000000-0000-4000-8000-000000000001',expectedVersion:2,lockVersion:3};
const doc={id:target.id,code:'DUMMY-PURGE',status:'Sampah',active_version:2,lock_version:3};
const data={reason:'DUMMY selective deletion test',confirmation:'HAPUS PERMANEN'};
test('permanent deletion requires Admin, Trash, current counters, explicit phrase and reason',()=>{
 assert.equal(validatePermanentDelete(doc,target,data,admin),data.reason);
 for(const role of ['Viewer','Editor'])assert.throws(()=>validatePermanentDelete(doc,target,data,{role}),e=>e.status===403);
 assert.throws(()=>validatePermanentDelete({...doc,status:'Aktif'},target,data,admin),e=>e.status===409);
 assert.throws(()=>validatePermanentDelete({...doc,lock_version:4},target,data,admin),e=>e.status===409);
 assert.throws(()=>validatePermanentDelete(doc,target,{...data,confirmation:'hapus'},admin));
 assert.throws(()=>validatePermanentDelete(doc,target,{...data,reason:'  '},admin));
});

async function scenario({shared=false,corrupt=false,dbFailure=false,running=false}={}){
 const root=path.resolve('tests/output/DUMMY-permanent-delete-'+core.id());
 const fileId='10000000-0000-4000-8000-000000000002',relative='originals/'+fileId+'.pdf';
 await fs.mkdir(path.join(root,'originals'),{recursive:true});
 const content=Buffer.from('%PDF-1.4\nDUMMY TEST ONLY\n%%EOF');await fs.writeFile(path.join(root,relative),content);
 const file={id:fileId,version_id:'DUMMY-version',extension:'pdf',disk_path:relative,sha256:corrupt?'0'.repeat(64):core.hash(content)};
 const events=[];let committed=false;
 const execute=async(c,sql,args)=>{
  events.push(sql);
  if(sql.startsWith('SELECT * FROM v2_documents'))return [doc];
  if(sql.startsWith('SELECT * FROM v2_versions'))return [{id:'DUMMY-version'}];
  if(sql.startsWith('SELECT f.*'))return [file];
  if(sql.startsWith('SELECT j.id'))return running?[{id:'DUMMY-running'}]:[];
  if(sql.startsWith('SELECT f.id'))return [];
  if(sql.startsWith('SELECT * FROM v2_import_items'))return [{id:'DUMMY-import'}];
  if(sql.startsWith('DELETE')){
   const dirs=await fs.readdir(path.join(root,'backups/permanent-delete'));
   const manifest=JSON.parse(await fs.readFile(path.join(root,'backups/permanent-delete',dirs[0],'manifest.json'),'utf8'));
   assert.equal(manifest.document.id,doc.id);assert.equal(manifest.files[0].sha256,file.sha256);
   assert.deepEqual(await fs.readFile(path.join(root,relative)),content,'File must exist before DB commit');
   if(dbFailure)throw Error('DUMMY DB failure');
  }
  return [];
 };
 const lookup=async()=>{assert(committed,'File cleanup must follow commit');return [{n:shared?1:0}];};
 const db={rows:execute,query:lookup,withTransaction:async fn=>{try{const value=await fn({});committed=true;events.push('COMMIT');return value;}catch(e){events.push('ROLLBACK');throw e;}}};
 const source=await fs.readFile(new URL('../src/lib/permanent-delete.mjs',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const require=createRequire(import.meta.url),exports={};
 vm.runInNewContext(compiled,{exports,Buffer,Headers,require:name=>name==='./db.mjs'?db:name==='./security.mjs'?{audit:async()=>events.push('AUDIT')}:name==='./core.mjs'?{...core,root:()=>root,safePath:relative=>{const p=path.resolve(root,relative);assert(p.startsWith(root+path.sep));return p;}}:require(name)});
 let result,error;try{result=await exports.permanentlyDelete(target,data,admin);}catch(e){error=e;}
 return {root,relative,content,result,error,events,committed};
}
test('DUMMY backup is verified before deletion; audit retained and exclusive file removed after commit',async()=>{
 const s=await scenario();assert.ifError(s.error);assert(s.result.ok);assert.equal(s.result.cleanupPending,false);
 await assert.rejects(()=>fs.stat(path.join(s.root,s.relative)),{code:'ENOENT'});
 const backup=path.join(s.root,'backups/permanent-delete',s.result.operationId);
 const manifest=JSON.parse(await fs.readFile(path.join(backup,'manifest.json'),'utf8'));
 assert.deepEqual(await fs.readFile(path.join(backup,manifest.copies[0].backup)),s.content);
 assert(s.events.indexOf('AUDIT')<s.events.indexOf('COMMIT'));
 assert(!s.events.some(sql=>sql.includes('DELETE FROM v2_audit')||sql.includes('DELETE FROM users')));
});
test('DUMMY shared physical file remains available to other document versions',async()=>{
 const s=await scenario({shared:true});assert.ifError(s.error);assert.deepEqual(await fs.readFile(path.join(s.root,s.relative)),s.content);
});
test('DUMMY corrupt backup and database failures leave original intact',async()=>{
 for(const flags of [{corrupt:true},{dbFailure:true},{running:true}]){
  const s=await scenario(flags);assert(s.error);assert.equal(s.committed,false);assert.deepEqual(await fs.readFile(path.join(s.root,s.relative)),s.content);assert(s.events.includes('ROLLBACK'));
  if(flags.corrupt||flags.running)assert(!s.events.some(sql=>sql.startsWith('DELETE')));
 }
});
