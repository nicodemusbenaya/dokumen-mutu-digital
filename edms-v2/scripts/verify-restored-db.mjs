// Run only inside the isolated laptop restore-test network. Never loads .env.local.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';

const run=process.env.RESTORE_TEST_RUN;
assert(/^DUMMY-RESTORE-[a-f0-9]{12}$/.test(run||''),'Missing restore-test identity');
assert.equal(process.env.RESTORE_DB_HOST,'edms-restore-db-'+run.toLowerCase(),'Unexpected DB host');
assert(process.env.RESTORE_DB_PASSWORD?.length>=32,'Missing isolated test credentials');
assert.equal(process.env.RESTORE_SOURCE,'/backup','Unexpected backup mount');
const connection=await mysql.createConnection({host:process.env.RESTORE_DB_HOST,port:3306,
 user:'root',password:process.env.RESTORE_DB_PASSWORD,database:'edms_ups',connectTimeout:10000});
try{
 const source='/backup';
 const policy=Object.fromEntries((await fs.readFile(path.join(source,'event-policy.txt'),'utf8')).trim().split(/\r?\n/).map(line=>line.split('=')));
 assert(['information-schema','system-table-empty'].includes(policy.inventory),'Missing event inventory evidence');
 assert(/^\d+$/.test(policy.expectedCount||''),'Invalid event count evidence');
 if(policy.inventory==='system-table-empty')assert.equal(policy.expectedCount,'0','Existing events must not be omitted');
 const expected=(await fs.readFile(path.join(source,'table-counts.tsv'),'utf8')).trim().split(/\r?\n/).map(line=>{
  const [name,count,...extra]=line.split('\t');
  assert(/^[A-Za-z0-9_]+$/.test(name)&&/^\d+$/.test(count)&&extra.length===0,'Invalid table manifest');
  return {name,count};
 });
 assert(expected.length>0&&new Set(expected.map(t=>t.name)).size===expected.length,'Empty/duplicate table manifest');
 assert(expected.some(t=>t.name==='users'&&BigInt(t.count)>0n),'Accounts absent from backup');
 const [tables]=await connection.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
 assert.deepEqual(tables.map(t=>t.name).sort(),expected.map(t=>t.name).sort(),'Restored table set differs');
 for(const table of expected){
  const [rows]=await connection.query('SELECT CAST(COUNT(*) AS CHAR) AS total FROM `'+table.name+'`');
  assert.equal(String(rows[0].total),table.count,'Restored row count differs: '+table.name);
 }
 const [objects]=await connection.query("SELECT CONCAT('TABLE',CHAR(9),TABLE_NAME,CHAR(9),TABLE_TYPE) AS object_name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() UNION ALL SELECT CONCAT('TRIGGER',CHAR(9),TRIGGER_NAME,CHAR(9),'TRIGGER') FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() UNION ALL SELECT CONCAT('ROUTINE',CHAR(9),ROUTINE_NAME,CHAR(9),ROUTINE_TYPE) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() UNION ALL SELECT CONCAT('EVENT',CHAR(9),EVENT_NAME,CHAR(9),'EVENT') FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()");
 const expectedObjects=(await fs.readFile(path.join(source,'db-objects.tsv'),'utf8')).trim().split(/\r?\n/).sort();
 assert.deepEqual(objects.map(o=>o.object_name).sort(),expectedObjects,'Restored DB objects differ');
 assert.equal(String(objects.filter(o=>o.object_name.startsWith('EVENT\t')).length),policy.expectedCount,'Restored event count differs');
 console.log(JSON.stringify({testRun:run,databaseRestored:true,tablesVerified:expected.length,objectsVerified:objects.length,productionTouched:false}));
}finally{await connection.end();}
