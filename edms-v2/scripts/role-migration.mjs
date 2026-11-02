import assert from 'node:assert/strict';
const targetNames=['Super user','Editor','Viewer'];
export function roleTarget(name){
 if(['Super user','Admin Sistem'].includes(name))return 'Super user';
 if(['Editor','Penyusun Dokumen'].includes(name))return 'Editor';
 if(['Viewer','Tim Mutu','Manager Bidang','Pimpinan Unit'].includes(name))return 'Viewer';
 throw new Error('Role tidak dikenal: '+name);
}
export async function migrateRoles(c){
 await c.beginTransaction();
 try{
  const [foreign]=await c.query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='roles'");
  assert(foreign.every(f=>f.TABLE_NAME==='users'&&f.COLUMN_NAME==='role_id'),'Relasi role tambahan perlu diperiksa');
  const [beforeRoles]=await c.query('SELECT * FROM roles ORDER BY id FOR UPDATE');
  const [beforeUsers]=await c.query('SELECT * FROM users ORDER BY id FOR UPDATE');
  const byId=new Map(beforeRoles.map(r=>[r.id,r]));
  for(const r of beforeRoles)roleTarget(r.name);
  for(const u of beforeUsers){const r=byId.get(u.role_id);assert(r,'Akun tanpa role');if(roleTarget(r.name)==='Editor')assert(u.bidang?.trim(),'Editor lama belum memiliki bidang');}
  for(const name of targetNames)await c.query('INSERT IGNORE INTO roles(name) VALUES(?)',[name]);
  const [all]=await c.query('SELECT id,name FROM roles ORDER BY id');
  const targets=Object.fromEntries(all.filter(r=>targetNames.includes(r.name)).map(r=>[r.name,r.id]));
  const mapping=[];
  for(const u of beforeUsers){const name=roleTarget(byId.get(u.role_id).name);if(u.role_id!==targets[name]){const preserveTimestamp=Object.hasOwn(u,'updated_at')?',updated_at=updated_at':'';await c.query('UPDATE users SET role_id=?'+preserveTimestamp+' WHERE id=?',[targets[name],u.id]);mapping.push({userId:u.id,fromRoleId:u.role_id,toRoleId:targets[name],role:name});}}
  for(const r of beforeRoles)if(!targetNames.includes(r.name))await c.query('DELETE FROM roles WHERE id=?',[r.id]);
  const [after]=await c.query('SELECT * FROM users ORDER BY id');
  const withoutRole=rows=>rows.map(({role_id,...rest})=>rest);
  assert(JSON.stringify(withoutRole(after))===JSON.stringify(withoutRole(beforeUsers)),'Metadata/password/status akun berubah');
  const [roles]=await c.query('SELECT id,name FROM roles ORDER BY id');
  assert.deepEqual(roles.map(r=>r.name).sort(),[...targetNames].sort());
  assert(after.some(u=>u.is_active&&u.role_id===targets['Super user']),'Minimal satu Super user aktif wajib tersedia');
  const [done]=await c.query("SELECT version FROM v2_migrations WHERE version='004'");
  if(!done.length){
   await c.query('INSERT INTO v2_audit(actor_id,actor_name,action,context_json) VALUES(NULL,?,?,?)',['Operator NAS (permintaan pengguna)','ROLE_MODEL_MIGRATION',JSON.stringify({version:'004',mapping,oldRoles:beforeRoles.map(({id,name})=>({id,name})),roles})]);
   await c.query('INSERT INTO v2_migrations(version,detail) VALUES(?,?)',['004','Super user, Editor per bidang, Viewer; akun dan dokumen dipertahankan']);
  }
  await c.commit();return {passed:true,accountsPreserved:after.length,mapping,roles};
 }catch(e){await c.rollback();throw e;}
}
