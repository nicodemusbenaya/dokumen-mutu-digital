import {query,rows,withTransaction} from './db.mjs';
import {id,text,fail} from './core.mjs';
import {audit} from './security.mjs';

export const masterTypes={kind:80,department:80,category:500};
export function masterError(error){
 if(error.code==='ER_NO_SUCH_TABLE'&&/v2_master_values/.test(error.sql||error.sqlMessage||''))fail('Tabel master belum tersedia. Admin perlu menjalankan migrasi 003 pada database aplikasi, lalu muat ulang halaman.',503);
 if(['EACCES','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','ER_ACCESS_DENIED_ERROR'].includes(error.code))fail('Koneksi database untuk master belum siap. Periksa koneksi dan izin database aplikasi, lalu coba lagi.',503);
 throw error;
}
export function masterInput(data,editing=false){
 if(!Object.hasOwn(masterTypes,data.type))fail('Jenis master tidak valid');
 const label=text(data.label,masterTypes[data.type]);
 if(typeof data.isActive!=='boolean')fail('Status master tidak valid');
 if(editing&&!Number.isInteger(data.lockVersion))fail('Muat ulang master sebelum mengubah',409);
 return {type:data.type,label,value:editing?undefined:text(data.value,masterTypes[data.type]),isActive:data.isActive};
}
export async function requireMaster(type,value,execute=query){
 if(type==='category'&&!value)return;
 if(!Object.hasOwn(masterTypes,type))fail('Jenis master tidak valid');
 const [entry]=await execute('SELECT id FROM v2_master_values WHERE type=? AND value=? AND is_active=1',[type,value]).catch(masterError);
 if(!entry)fail('Pilihan '+({kind:'jenis dokumen',department:'bidang',category:'kategori'}[type])+' tidak aktif atau belum terdaftar. Muat ulang pilihan.',409);
}
export async function masterList(user){
 const all=user.role==='Super user';
 return {values:await query('SELECT id,type,value,label,is_active isActive,lock_version lockVersion FROM v2_master_values'+(all?'':' WHERE is_active=1')+' ORDER BY type,label,value').catch(masterError),canManage:all};
}
export async function saveMaster(key,data,user,req){
 if(user.role!=='Super user')fail('Hanya Super user dapat mengelola master',403);
 const input=masterInput(data,!!key);
 return withTransaction(async c=>{
  if(!key){const entryId=id();await rows(c,'INSERT INTO v2_master_values(id,type,value,label,is_active) VALUES(?,?,?,?,?)',[entryId,input.type,input.value,input.label,input.isActive?1:0]);await audit(c,user,req,'CREATE_MASTER',null,{masterId:entryId,...input});return {ok:true,id:entryId};}
  const [old]=await rows(c,'SELECT * FROM v2_master_values WHERE id=? FOR UPDATE',[key]);if(!old)fail('Master tidak ditemukan',404);
  if(old.type!==input.type||old.lock_version!==data.lockVersion)fail('Master berubah. Muat ulang sebelum menyimpan.',409);
  await rows(c,'UPDATE v2_master_values SET label=?,is_active=?,lock_version=lock_version+1,updated_at=NOW(3) WHERE id=?',[input.label,input.isActive?1:0,key]);
  await audit(c,user,req,'UPDATE_MASTER',null,{masterId:key,before:{type:old.type,value:old.value,label:old.label,isActive:old.is_active},after:input});return {ok:true,id:key};
 }).catch(masterError);
}
