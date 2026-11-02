// This entry point is deliberately restricted to the isolated laptop restore DB.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
import {snapshot,makePlan,applyPlan,hash,targetTables,preservedTables} from './empty-register-core.mjs';

const run=process.env.RESTORE_TEST_RUN;
assert(/^DUMMY-RESTORE-[a-f0-9]{12}$/.test(run||''),'Missing restore-test identity');
assert.equal(process.env.RESTORE_DB_HOST,'edms-restore-db-'+run.toLowerCase(),'Unexpected DB host');
assert(process.env.RESTORE_DB_PASSWORD?.length>=32,'Missing isolated test credentials');
const manifestSha=createHash('sha256').update(await fs.readFile('/backup/SHA256SUMS')).digest('hex');
const c=await mysql.createConnection({host:process.env.RESTORE_DB_HOST,port:3306,user:'root',password:process.env.RESTORE_DB_PASSWORD,database:'edms_ups',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
try{
 const before=await snapshot(c);
 const expected=(await fs.readFile('/backup/table-counts.tsv','utf8')).trim().split(/\r?\n/);
 for(const line of expected){const [table,count]=line.split('\t');assert.equal(String(before[table]?.length),count,'Restore snapshot differs: '+table);}
 const plan=makePlan(before,manifestSha);
 await fs.writeFile('/evidence/empty-register-plan.json',JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
 const result=await applyPlan(c,plan);
 const after=await snapshot(c);
 for(const table of targetTables)assert.equal(after[table].length,0);
 for(const table of preservedTables.filter(t=>t!=='v2_audit'))assert.equal(hash(after[table]),hash(before[table]),'Protected data differs: '+table);
 assert.equal(after.v2_audit.length,before.v2_audit.length+1);
 const oldAudit=new Set(before.v2_audit.map(hash));
 assert.equal(after.v2_audit.filter(r=>oldAudit.has(hash(r))).length,before.v2_audit.length,'Existing audits changed');
 // A stale manifest must reject, including a second attempt after a successful transition.
 await assert.rejects(applyPlan(c,plan),/Database changed/);
 assert.equal(hash(await snapshot(c)),hash(after),'Rejected retry changed the database');
 const receipt={...result,testRun:run,backupManifestSha256:manifestSha,staleManifestRejected:true,productionTouched:false};
 await fs.writeFile('/evidence/empty-register-result.json',JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
 console.log('EMPTY_REGISTER_REHEARSAL_PASS: '+JSON.stringify(receipt));
}finally{await c.end();}
