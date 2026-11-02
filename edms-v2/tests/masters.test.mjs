import test from 'node:test';
import assert from 'node:assert/strict';
import {masterInput,requireMaster,saveMaster,masterError} from '../src/lib/masters.mjs';
test('master types, field lengths, boolean state and optimistic lock are validated',()=>{
 assert.deepEqual(masterInput({type:'kind',value:'DUMMY Custom',label:'DUMMY Jenis Baru',isActive:true}),{type:'kind',value:'DUMMY Custom',label:'DUMMY Jenis Baru',isActive:true});
 for(const type of ['role','extension','__proto__','kind;DROP'])assert.throws(()=>masterInput({type,value:'DUMMY',label:'DUMMY',isActive:true}));
 assert.throws(()=>masterInput({type:'department',value:'x'.repeat(81),label:'DUMMY',isActive:true}));
 assert.throws(()=>masterInput({type:'kind',value:'DUMMY',label:'DUMMY',isActive:'false'}));
 assert.throws(()=>masterInput({type:'kind',label:'DUMMY',isActive:false},true),e=>e.status===409);
 assert.equal(masterInput({type:'category',label:'DUMMY renamed',isActive:false,lockVersion:2},true).value,undefined,'Editing cannot change canonical value');
});
test('master writes reject non-admin before any database access',async()=>{
 for(const role of ['Viewer','Editor'])await assert.rejects(()=>saveMaster(null,{}, {role}),e=>e.status===403);
});
test('new upload selections require active registered masters with bound values',async()=>{
 const calls=[];const execute=async(sql,args)=>{calls.push({sql,args});return args[1]==='DUMMY active'?[{id:'DUMMY'}]:[];};
 await requireMaster('kind','DUMMY active',execute);
 assert(calls[0].sql.includes('is_active=1'));assert.deepEqual(calls[0].args,['kind','DUMMY active']);
 await assert.rejects(()=>requireMaster('kind','DUMMY inactive',execute),e=>e.status===409);
 await assert.rejects(()=>requireMaster('department',"DUMMY' OR 1=1",execute),e=>e.status===409);
 assert(!calls.at(-1).sql.includes("OR 1=1"));
 const count=calls.length;await requireMaster('category','',execute);assert.equal(calls.length,count,'Uncategorized remains optional');
});
test('missing master schema and database connection errors have different actionable messages',()=>{
 assert.throws(()=>masterError({code:'ER_NO_SUCH_TABLE',sql:'SELECT * FROM v2_master_values'}),e=>e.status===503&&e.message.includes('migrasi 003'));
 assert.throws(()=>masterError({code:'EACCES'}),e=>e.status===503&&e.message.includes('Koneksi database')&&!e.message.includes('migrasi'));
 const unknown=Object.assign(new Error('DUMMY'),{code:'ER_BAD_FIELD_ERROR'});assert.throws(()=>masterError(unknown),e=>e===unknown);
});
