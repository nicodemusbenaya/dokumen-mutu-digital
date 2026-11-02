import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import JSZip from 'jszip';
import {admin,filters,targets} from '../src/lib/management.mjs';
const doc={id:'10000000-0000-4000-8000-000000000001',expectedVersion:1,lockVersion:0};
test('management selection rejects duplicate IDs, stale/missing counters and oversized batches',()=>{
 assert.deepEqual(targets({documents:[doc]}),[doc]);assert.throws(()=>targets({documents:[doc,doc]}));assert.throws(()=>targets({documents:[{id:doc.id}]}));assert.throws(()=>targets({documents:Array(501).fill(doc)}));assert.throws(()=>targets({documents:[]}));
});
test('register filters bind values and keep private statuses hidden from Viewer',()=>{
 const f=filters(new URL('http://localhost/?status=Sampah&search=%27+OR+1%3D1&extension=pdf'),{id:1,role:'Viewer'});assert(f.where.includes('1=0'));assert(!f.where.includes('OR 1=1'));assert(f.args.includes("%' OR 1=1%"));assert.throws(()=>filters(new URL('http://localhost/?sort=title;DROP'),{role:'Super user'}));assert.throws(()=>filters(new URL('http://localhost/?status=anything'),{role:'Super user'}));
});
test('user administration rejects non-admin roles',()=>{assert.throws(()=>admin({role:'Viewer'}));assert.throws(()=>admin({role:'Editor'}));assert.doesNotThrow(()=>admin({role:'Super user'}));});
test('streamed original ZIP preserves dummy content and rejects paths outside storage',async()=>{
 const root=path.resolve('tests/output/DUMMY-export-unit');await fs.mkdir(root,{recursive:true});await fs.writeFile(path.join(root,'DUMMY-source.txt'),'DUMMY synthetic content');const manifest=path.join(root,'manifest.json'),output=path.join(root,'DUMMY-export.zip');await fs.writeFile(manifest,JSON.stringify([{path:'DUMMY-source.txt',name:'DUMMY/DUMMY-source.txt'}]));
 const result=spawnSync(process.env.PYTHON_BIN||(process.platform==='win32'?'python':'python3'),['scripts/export-zip.py',root,manifest,output],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const zip=await JSZip.loadAsync(await fs.readFile(output));assert.equal(await zip.file('DUMMY/DUMMY-source.txt').async('string'),'DUMMY synthetic content');
 await fs.writeFile(manifest,JSON.stringify([{path:'../DUMMY-prosedur.pdf',name:'outside.pdf'}]));const denied=spawnSync(process.env.PYTHON_BIN||(process.platform==='win32'?'python':'python3'),['scripts/export-zip.py',root,manifest,output],{encoding:'utf8'});assert.notEqual(denied.status,0);
});
