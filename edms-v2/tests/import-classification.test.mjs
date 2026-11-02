import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldRecheckClassification} from '../src/lib/import-classification.mjs';

test('DUMMY corrected ZIP codes can be retried without reopening unrelated review items',()=>{
 const item={state:'needs_review',stage:'classification',
  error:'Jenis dokumen dan bidang perlu dipilih karena kode nama file tidak dikenali.',
  original_path:'3. BST - DUMMY/Formulir/FR.UPS.DUMMY.BST.01.01A-00 DUMMY.pdf',
  payload_json:JSON.stringify({metadata:{department:'Umum'}})};
 assert.equal(shouldRecheckClassification(item),true);
 assert.equal(shouldRecheckClassification({...item,original_path:'DUMMY Dokumen tanpa kode.pdf'}),false);
 assert.equal(shouldRecheckClassification({...item,stage:'pairing'}),false);
 assert.equal(shouldRecheckClassification({...item,error:'Konflik versi dokumen'}),false);
 assert.equal(shouldRecheckClassification({...item,payload_json:JSON.stringify({metadata:{documentId:'DUMMY-existing'}})}),false);
 assert.equal(shouldRecheckClassification({...item,payload_json:'{invalid'}),false);
 const attachment={...item,original_path:'0. MM - DUMMY/Lampiran/Lampiran 1 DUMMY.pdf'};
 assert.equal(shouldRecheckClassification(attachment),true);
 assert.equal(shouldRecheckClassification({...attachment,payload_json:JSON.stringify({metadata:{}})}),false);
});
