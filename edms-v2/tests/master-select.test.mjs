import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
const source=fs.readFileSync(new URL('../src/components/MasterSelect.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const exports={};vm.runInNewContext(code,{exports,require:createRequire(import.meta.url)});
const values=[{type:'department',value:'DUMMY-A',label:'DUMMY Bidang A',isActive:1},{type:'department',value:'DUMMY-OLD',label:'DUMMY Bidang Lama',isActive:0},{type:'category',value:'DUMMY/FOLDER',label:'DUMMY Folder',isActive:1}];
test('edit dropdown preserves inactive/current values while new selections use active master values',()=>{
 assert.equal(exports.masterOptions(values,'department').length,1);
 assert.equal(exports.masterOptions(values,'department','DUMMY-OLD').length,2);
 const old=exports.masterOptions(values,'category','DUMMY-LEGACY');assert.equal(old.at(-1).value,'DUMMY-LEGACY');
 assert.equal(exports.masterOptions(values,'department','',true).length,1,'Filters exclude inactive master values');
});
test('metadata department/category render as labelled-value selects with empty and saved choices',()=>{
 const html=renderToStaticMarkup(exports.MasterSelect({values,type:'department',name:'department',defaultValue:'DUMMY-OLD',emptyLabel:'Tidak diubah',disabled:true}));
 assert.match(html,/<select[^>]*name="department"/);assert.match(html,/disabled/);assert.match(html,/value="DUMMY-OLD" selected/);assert.match(html,/DUMMY Bidang Lama \(nonaktif\)/);assert.match(html,/Tidak diubah/);
 const category=renderToStaticMarkup(exports.MasterSelect({values,type:'category',name:'category',defaultValue:'',emptyLabel:'Tanpa kategori'}));
 assert.match(category,/<option value="" selected="">Tanpa kategori/);assert.match(category,/DUMMY Folder/);assert(!category.includes('<input'));
});
