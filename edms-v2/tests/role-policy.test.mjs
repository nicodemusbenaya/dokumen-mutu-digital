import test from 'node:test';
import assert from 'node:assert/strict';
import {editable} from '../src/lib/core.mjs';
import {roleTarget} from '../scripts/role-migration.mjs';
test('Editor permission follows exact assigned department, including owned documents',()=>{
 const editor={id:1,role:'Editor',bidang:'Umum'};
 assert.equal(editable(editor,{ownerId:1,department:'PMA'}),false);
 assert.equal(editable(editor,{ownerId:99,department:'Umum'}),true);
 assert.equal(editable({...editor,bidang:''}),false);
 assert.equal(editable({...editor,role:'Viewer'},{ownerId:1,department:'Umum'}),false);
 assert.equal(editable({...editor,role:'Admin Sistem'},{ownerId:1,department:'Umum'}),false);
 assert.equal(editable({...editor,role:'Super user'},{department:'PMA'}),true);
});
test('legacy roles migrate deterministically without promoting read-only accounts',()=>{
 for(const name of ['Tim Mutu','Manager Bidang','Pimpinan Unit','Viewer'])assert.equal(roleTarget(name),'Viewer');
 assert.equal(roleTarget('Admin Sistem'),'Super user');assert.equal(roleTarget('Penyusun Dokumen'),'Editor');
 assert.throws(()=>roleTarget('unrecognized'));
});
