import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {importFolders,shouldRetryFolder} from '../src/lib/import-folders.mjs';

test('DUMMY folder conflicts can retry without reopening successful files or version conflicts',()=>{
 const item={state:'needs_review',stage:'folder',error:'Kategori dinonaktifkan: DUMMY. Hubungi Super user.',payload_json:'{"metadata":{}}'};
 assert.equal(shouldRetryFolder(item),true);
 assert.equal(shouldRetryFolder({...item,state:'success'}),false);
 assert.equal(shouldRetryFolder({...item,error:'Konflik versi dokumen'}),false);
 assert.equal(shouldRetryFolder({...item,stage:'classification'}),false);
 assert.equal(shouldRetryFolder({...item,payload_json:'{"metadata":{"documentId":"DUMMY"}}'}),false);
 assert.equal(shouldRetryFolder({...item,error:'Folder DUMMY ada di Folder Terhapus. Pulihkan dahulu sebelum digunakan.'}),true);
});

test('ZIP root folder becomes the category and nested paths stay beneath it',()=>{
 assert.deepEqual(importFolders('3. BST - PROSEDUR BIDANG SERTIFIKASI PERSON DAN UMUM/Sub Folder/DUMMY.pdf'),{
  category:'3. BST - PROSEDUR BIDANG SERTIFIKASI PERSON DAN UMUM',relativePath:'Sub Folder',folderNames:['Sub Folder']});
 assert.deepEqual(importFolders('Folder A/Mutu/Uji é/DUMMY.pdf'),{category:'Folder A',relativePath:'Mutu/Uji é',folderNames:['Mutu','Uji é']});
 assert.deepEqual(importFolders('DUMMY-root.pdf'),{category:'',relativePath:'',folderNames:[]});
 assert.deepEqual(importFolders('DUMMY Kosong/Sub/',true),{category:'DUMMY Kosong',relativePath:'Sub',folderNames:['Sub']});
 assert.deepEqual(importFolders('3. BST - PROSEDUR BIDANG SERTIFIKASI PERSON DAN UMUM/',true),{category:'3. BST - PROSEDUR BIDANG SERTIFIKASI PERSON DAN UMUM',relativePath:'',folderNames:[]});
 for(const unsafe of ['../DUMMY.pdf','/DUMMY.pdf','C:/DUMMY.pdf','x/../../DUMMY.pdf'])assert.throws(()=>importFolders(unsafe));
 assert.throws(()=>importFolders('DUMMY '+ 'x'.repeat(510)+'/Sub/file.pdf'),/500 karakter/);
});

test('archive entries with identical paths stay separate and unsafe directories fail',async()=>{
 const out=path.resolve('tests/output/DUMMY-entry-identity');await fs.mkdir(out,{recursive:true});
 const archive=path.join(out,'DUMMY-repeated.zip');
 const script="import zipfile,sys,warnings; warnings.simplefilter('ignore'); z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('DUMMY/Same.pdf',b'DUMMY first'); z.writestr('DUMMY/Same.pdf',b'DUMMY second'); z.writestr('DUMMY/Empty/',b''); z.writestr('../DUMMY-escape/',b''); z.close()";
 const python=process.platform==='win32'?'python':'python3';
 const made=spawnSync(python,['-c',script,archive],{encoding:'utf8'});assert.equal(made.status,0,made.stderr);
 const extracted=spawnSync(python,['scripts/extract.py',archive,out],{encoding:'utf8'});assert.equal(extracted.status,0,extracted.stderr);
 const entries=extracted.stdout.trim().split('\n').map(line=>JSON.parse(line));
 assert.deepEqual(entries.map(e=>e.index),[0,1,2,3]);
 assert.equal(entries[0].path,entries[1].path);assert.notEqual(entries[0].file,entries[1].file);
 assert.equal(await fs.readFile(entries[0].file,'utf8'),'DUMMY first');assert.equal(await fs.readFile(entries[1].file,'utf8'),'DUMMY second');
 assert(entries[2].directory);assert.match(entries[3].error,/tidak aman/);
});
