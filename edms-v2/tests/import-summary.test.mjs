import test from 'node:test';
import assert from 'node:assert/strict';
import {importCompletion} from '../src/lib/core.mjs';

test('regression: MariaDB string zero failures means a successful PDF import is done',()=>{
  assert.deepEqual(importCompletion(1,'0'),{state:'done',total:1,failed:0});
  assert.equal(importCompletion('351','0').state,'done');
});
test('mixed ZIP stays partial when a real failed or unresolved item exists',()=>{
  assert.deepEqual(importCompletion('6','3'),{state:'partial',total:6,failed:3});
  assert.equal(importCompletion(1,'1').state,'partial');
});
test('empty manifest handles MariaDB SUM null explicitly',()=>{
  assert.deepEqual(importCompletion(0,null),{state:'done',total:0,failed:0});
});
test('invalid aggregate cannot silently publish a success status',()=>{
  for(const [total,failed] of [[1,'bad'],[1,2],[-1,0],[1,-1]]) {
    assert.throws(()=>importCompletion(total,failed),/tidak valid/);
  }
});
