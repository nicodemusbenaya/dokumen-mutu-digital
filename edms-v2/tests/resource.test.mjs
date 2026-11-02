import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the production hook with a deterministic hook scheduler and clock.
// Fetch intentionally ignores abort so generation/key guards must also work.
function harness(){
 const slots=[],effects=[],timers=new Map(),requests=[];let cursor=0,nextTimer=0,path=null,result,dirty=false,mounted=true;
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;dirty=true;}];},
  useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,n)=>d!==slots[i].deps[n]))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((d,n)=>d!==previous.deps[n])){previous?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}}
 };
 const exports={};
 const source=ts.transpileModule(fs.readFileSync(new URL('../src/components/useResource.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:()=>react,AbortController,setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id),fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))});
 function render(){cursor=0;dirty=false;result=exports.useResource(path,250);while(effects.length)effects.shift()();return result;}
 async function flush(){for(let n=0;n<8;n++){await Promise.resolve();if(dirty&&mounted)render();}return result;}
 return {
  requests,get result(){return result;},get timers(){return timers.size;},
  setPath(value){path=value;render();return result;},
  async run(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}return flush();},flush,
  async respond(i,data,status=200){requests[i].resolve({ok:status<400,json:async()=>data});return flush();},
  unmount(){mounted=false;for(const slot of slots)slot?.cleanup?.();}
 };
}

test('DUMMY: old search responses cannot overwrite newer results or expose previous-key data',async()=>{
 const h=harness();h.setPath('documents?search=old');await h.run();
 assert.equal(h.result.loading,true);assert.equal(h.result.data,undefined);
 h.setPath('documents?search=new');assert.equal(h.result.data,undefined);await h.run();
 assert.equal(h.requests[0].options.signal.aborted,true);
 await h.respond(1,{documents:['DUMMY-new']});assert.equal(h.result.data.documents[0],'DUMMY-new');
 await h.respond(0,{documents:['DUMMY-old']});assert.equal(h.result.data.documents[0],'DUMMY-new');
});
test('DUMMY: late detail failures do not replace the current detail or its status',async()=>{
 const h=harness();h.setPath('documents/DUMMY-A');await h.run();h.setPath('documents/DUMMY-B');await h.run();
 await h.respond(1,{id:'DUMMY-B'});await h.respond(0,{error:'DUMMY old failure'},500);
 assert.equal(h.result.data.id,'DUMMY-B');assert.equal(h.result.error,'');assert.equal(h.result.loading,false);
});
test('DUMMY: loading, error, retry and confirmed empty results are distinct',async()=>{
 const h=harness();h.setPath('documents');await h.run();assert.equal(h.result.loading,true);
 await h.respond(0,{error:'DUMMY unavailable'},503);assert.equal(h.result.error,'DUMMY unavailable');assert.equal(h.result.data,undefined);assert.equal(h.result.loading,false);
 h.result.reload();await h.flush();await h.run();assert.equal(h.result.loading,true);assert.equal(h.result.error,'');
 await h.respond(1,{documents:[]});assert.equal(h.result.loading,false);assert.equal(h.result.error,'');assert.equal(h.result.data.documents.length,0);
});
test('DUMMY: debounce cancels superseded searches; leaving view cancels pending work',async()=>{
 const h=harness();h.setPath('documents?search=a');h.setPath('documents?search=ab');await h.run();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'/api/v2/documents?search=ab');
 h.setPath(null);await h.respond(0,{documents:['DUMMY']});assert.equal(h.result.data,undefined);assert.equal(h.result.loading,false);
 h.setPath('documents?search=abc');h.unmount();assert.equal(h.timers,0);
});
test('DUMMY: leaving an authenticated resource clears cached data before a new session',async()=>{
 const h=harness();h.setPath('stats');await h.run();await h.respond(0,{private:'DUMMY previous account'});
 h.setPath(null);await h.flush();h.setPath('stats');
 assert.equal(h.result.data,undefined);assert.equal(h.result.loading,true);
});
