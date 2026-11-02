import test from 'node:test';
import assert from 'node:assert/strict';
import {origin} from '../src/lib/security.mjs';

test('home mode accepts both loopback spellings but rejects other origins', () => {
  const saved=Object.fromEntries(['EDMS_HOME','DEV_HOST','APP_ORIGIN','NEXT_PUBLIC_APP_URL'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{EDMS_HOME:'true',DEV_HOST:'127.0.0.1',APP_ORIGIN:'http://localhost:3100',NEXT_PUBLIC_APP_URL:'http://localhost:3100'});
  const req=value=>({url:'http://localhost:3100/api/v2/login',headers:{get:()=>value}});
  try{
    assert.doesNotThrow(()=>origin(req('http://localhost:3100')));
    assert.doesNotThrow(()=>origin(req('http://127.0.0.1:3100')));
    assert.throws(()=>origin(req('http://10.10.200.165:3100')), /Origin permintaan tidak diizinkan/);
    assert.throws(()=>origin(req(null)), /Origin permintaan tidak diizinkan/);
    delete process.env.EDMS_HOME;
    assert.throws(()=>origin(req('http://127.0.0.1:3100')), /Origin permintaan tidak diizinkan/);
  }finally{
    for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
