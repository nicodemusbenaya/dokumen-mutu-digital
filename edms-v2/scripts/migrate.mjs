import fs from 'node:fs/promises';
import {pool,query} from '../src/lib/db.mjs';
import {migrateFolderData} from './folder-migration.mjs';
import {explorerSqlForDatabase} from './explorer-schema.mjs';
const migrations=[['001','001_v2.sql'],['002','002_management.sql'],['003','003_masters.sql'],['005','005_upload_folders.sql'],['006','006_file_explorer.sql'],['007','007_document_map.sql'],['008','008_lampiran.sql'],['009','009_forms.sql']];
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--only'&&migrations.some(([v])=>v===args[1])))throw new Error('Gunakan npm run migrate atau npm run migrate -- --only <versi>');
const selected=args.length?migrations.filter(([v])=>v===args[1]):migrations;
try{
if(args[1]==='003'){
 const dependencies=await query("SELECT version FROM v2_migrations WHERE version IN ('001','002')");
 if(dependencies.length!==2)throw new Error('Schema fondasi 001/002 belum lengkap. Periksa migrasi sebelum menerapkan master 003.');
}
if(args[1]==='005'){
 const dependencies=await query("SELECT version FROM v2_migrations WHERE version IN ('001','002','003')");
 if(dependencies.length!==3)throw new Error('Schema 001/002/003 belum lengkap sebelum migrasi upload 005.');
}
if(args[1]==='006'){
 const dependencies=await query("SELECT version FROM v2_migrations WHERE version IN ('001','002','003','005')");
 if(dependencies.length!==4)throw new Error('Schema 001/002/003/005 belum lengkap sebelum migrasi File Explorer 006.');
}
if(args[1]==='007'){
 const dependencies=await query("SELECT version FROM v2_migrations WHERE version IN ('001','002','003','005','006')");
 if(dependencies.length!==5)throw new Error('Schema 001/002/003/005/006 belum lengkap sebelum migrasi Peta Dokumen 007.');
}
if(args[1]==='008'){
 const dependencies=await query("SELECT version FROM v2_migrations WHERE version IN ('003','006','007')");
 if(dependencies.length!==3)throw new Error('Schema 003/006/007 belum lengkap sebelum migrasi Lampiran 008.');
}
if(args[1]==='009'){
 const dependencies=await query("SELECT version FROM v2_migrations WHERE version IN ('001')");
 if(dependencies.length!==1)throw new Error('Schema fondasi 001 belum lengkap sebelum migrasi Form 009.');
}
for(const [version,file] of selected){
 const source=await fs.readFile(new URL('../sql/'+file,import.meta.url),'utf8');
 let sql=source;
 if(version==='006'){
  const c=await pool().getConnection();
  try{sql=await explorerSqlForDatabase(c,source);}finally{c.release();}
 }
 for(const statement of sql.replace(/^\uFEFF/,'').split(';').filter(x=>x.trim()))await query(statement);
 if(version==='006'){const c=await pool().getConnection();try{await migrateFolderData(c);}finally{c.release();}}
 await query('INSERT IGNORE INTO v2_migrations(version,detail) VALUES(?,?)',[version,version==='005'?'Allow shared document codes; stable ZIP entry identity; records preserved':version==='006'?'Additive folder tree; filename classification masters; source records preserved':'Additive EDMS schema; legacy records untouched']);
}
console.log('V2_SCHEMA_READY '+selected.map(([v])=>v).join(',')+'; akun dan data lama tidak diubah');
}finally{await pool().end();}
