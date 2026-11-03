// Update 2.1.8: migrasi aditif tabel Form (009) + izin akun runtime terbatas.
// Tidak mengubah/menghapus data lama. Dijalankan oleh nas-app-update.sh saat aplikasi STOPPED.
// Mode test: FORMS_MIGRATION_TEST=1 memakai DB_* dari environment (DB uji terisolasi, bukan NAS).
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';

const TABLES=['v2_forms','v2_form_versions','v2_form_submissions'];
const env=json=>Object.fromEntries(json.Config.Env.map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
let admin,runtimeUser;
if(process.env.FORMS_MIGRATION_TEST==='1'){
 admin={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME};
 runtimeUser=process.env.RUNTIME_DB_USER;
}else{
 // Kredensial admin hanya dibaca dari checkpoint terlindungi lama; datanya tidak dipakai untuk restore.
 const a=env(JSON.parse(await fs.readFile('/admin-source.json','utf8'))[0]);
 assert.equal(a.DB_NAME,'edms_ups');assert.equal(a.DB_USER,'root');assert.equal(String(a.DB_PORT),'3307');
 assert(['host.docker.internal','10.10.200.166'].includes(a.DB_HOST));
 admin={host:a.DB_HOST,port:3307,user:a.DB_USER,password:a.DB_PASSWORD,database:a.DB_NAME};
 const r=env(JSON.parse(await fs.readFile('/runtime-source.json','utf8'))[0]);
 assert.equal(r.DB_NAME,'edms_ups');runtimeUser=r.DB_USER;
}
assert(admin.password,'Admin DB password missing');
assert(/^edms_v21_[a-f0-9]{12}$/.test(runtimeUser||''),'Unexpected runtime account; inspect before granting');
const c=await mysql.createConnection({...admin,connectTimeout:15000,multipleStatements:false});
try{
 const [clients]=await c.query('SELECT ID FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()');
 assert.equal(clients.length,0,'Other EDMS database clients remain; keep the app stopped');
 const [deps]=await c.query("SELECT version FROM v2_migrations WHERE version='001'");
 assert.equal(deps.length,1,'Schema 001 missing');
 const [[before]]=await c.query('SELECT (SELECT COUNT(*) FROM v2_documents) documents,(SELECT COUNT(*) FROM users) accounts');
 const sql=(await fs.readFile(new URL('../sql/009_forms.sql',import.meta.url),'utf8')).replace(/^﻿/,'');
 for(const statement of sql.split(';').filter(s=>s.trim()))await c.query(statement);
 await c.query('INSERT IGNORE INTO v2_migrations(version,detail) VALUES(?,?)',['009','Additive form builder tables; existing records untouched']);
 const [accounts]=await c.query('SELECT User FROM mysql.user WHERE User=? AND Host=?',[runtimeUser,'%']);
 assert.equal(accounts.length,1,'Expected existing restricted runtime account');
 for(const table of TABLES){
  await c.query('GRANT SELECT, INSERT, UPDATE, DELETE ON `'+admin.database+'`.`'+table+'` TO ?@?',[runtimeUser,'%']);
  const [p]=await c.query('SELECT PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=? AND TABLE_NAME=?',["'"+runtimeUser+"'@'%'",admin.database,table]);
  assert.deepEqual(p.map(x=>x.PRIVILEGE_TYPE).sort(),['DELETE','INSERT','SELECT','UPDATE'],'Grant check failed: '+table);
 }
 const [[after]]=await c.query('SELECT (SELECT COUNT(*) FROM v2_documents) documents,(SELECT COUNT(*) FROM users) accounts');
 assert.deepEqual(after,before,'Existing record counts changed');
 console.log('FORMS_MIGRATION_PASS '+JSON.stringify({tables:TABLES,runtimeGrants:true,documents:Number(after.documents),accounts:Number(after.accounts)}));
}finally{await c.end();}
