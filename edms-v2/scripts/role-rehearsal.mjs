import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {migrateRoles} from './role-migration.mjs';
import {snapshot,hash} from './empty-register-core.mjs';
assert(/^DUMMY-RESTORE-[a-f0-9]{12}$/.test(process.env.RESTORE_TEST_RUN||''));
assert.equal(process.env.RESTORE_DB_HOST,'edms-restore-db-'+process.env.RESTORE_TEST_RUN.toLowerCase());
const c=await mysql.createConnection({host:process.env.RESTORE_DB_HOST,user:'root',password:process.env.RESTORE_DB_PASSWORD,database:'edms_ups',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
try{
 if(process.argv.includes('--verify-rollback')){
  const baseline=JSON.parse(await fs.readFile('/evidence/role-rehearsal-baseline.json','utf8'));
  assert.equal(hash(await snapshot(c)),hash(baseline),'Rollback restore differs from pre-migration snapshot');
  const r=JSON.parse(await fs.readFile('/evidence/role-rehearsal-result.json','utf8'));r.rollbackVerified=true;
  await fs.writeFile('/evidence/role-rehearsal-result.json',JSON.stringify(r,null,2));console.log('ROLE_MIGRATION_ROLLBACK_PASS');
 }else{
  const before=await snapshot(c);await fs.writeFile('/evidence/role-rehearsal-baseline.json',JSON.stringify(before),{flag:'wx',mode:0o600});
  const result=await migrateRoles(c),after=await snapshot(c);
  for(const table of Object.keys(before))if(!['roles','users','v2_audit','v2_migrations'].includes(table))assert.equal(hash(before[table]),hash(after[table]),'Protected table changed: '+table);
  const audit=new Set(after.v2_audit.map(hash));assert(before.v2_audit.every(row=>audit.has(hash(row))));
  await migrateRoles(c);assert.equal(hash(await snapshot(c)),hash(after),'Migration retry changed data');
  await fs.writeFile('/evidence/role-rehearsal-result.json',JSON.stringify({...result,productionTouched:false,documentsPreserved:before.v2_documents.length,allOtherTablesPreserved:true,idempotencyVerified:true},null,2),{flag:'wx',mode:0o600});
  console.log('ROLE_MIGRATION_REHEARSAL_PASS '+JSON.stringify(result));
 }
}finally{await c.end();}
