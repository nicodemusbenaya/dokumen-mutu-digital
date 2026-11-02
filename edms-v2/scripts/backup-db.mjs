import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
try{process.loadEnvFile('.env.local');}catch{}
const target=path.resolve(process.argv[2]||'backups');await fs.mkdir(target,{recursive:true});
const connection=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3307),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,dateStrings:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const dump=path.join(target,'edms-'+stamp+'.sql');const handle=await fs.open(dump,'wx');const counts={};
function ident(v){if(!/^[A-Za-z0-9_]+$/.test(v))throw new Error('Nama tabel tidak aman');return '`'+v+'`';}
try{
 await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
 await handle.write('SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n');const [tables]=await connection.query("SHOW FULL TABLES WHERE Table_type='BASE TABLE'");
 for(const row of tables){const name=Object.values(row)[0],table=ident(name);const [ddl]=await connection.query('SHOW CREATE TABLE '+table);await handle.write('DROP TABLE IF EXISTS '+table+';\n'+ddl[0]['Create Table']+';\n');let offset=0,count=0;const [columns]=await connection.query('SHOW COLUMNS FROM '+table);const names=columns.map(c=>ident(c.Field)).join(',');for(;;){const [records]=await connection.query('SELECT * FROM '+table+' LIMIT 250 OFFSET '+offset);if(!records.length)break;const values=records.map(r=>'('+columns.map(c=>connection.escape(r[c.Field])).join(',')+')').join(',\n');await handle.write('INSERT INTO '+table+'('+names+') VALUES '+values+';\n');count+=records.length;offset+=records.length;}counts[name]=count;}
 await handle.write('SET FOREIGN_KEY_CHECKS=1;\n');await connection.commit();await handle.close();const data=await fs.readFile(dump);const sha256=createHash('sha256').update(data).digest('hex');await fs.writeFile(dump+'.manifest.json',JSON.stringify({createdAt:new Date().toISOString(),database:process.env.DB_NAME,sha256,tables:counts,restoreVerified:false,storageBackupVerified:false},null,2));console.log('DATABASE_BACKUP_WRITTEN; restore dan backup file storage belum diverifikasi');
}catch(e){await connection.rollback().catch(()=>{});await handle.close().catch(()=>{});console.error('BACKUP_FAILED',e.code||e.message);process.exitCode=1;}finally{await connection.end();}
