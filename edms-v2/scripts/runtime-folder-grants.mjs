import assert from 'node:assert/strict';

export async function grantRuntimeFolders(c,username){
 assert(/^edms_v21_[a-f0-9]{12}$/.test(username),'Unexpected runtime account; inspect before granting');
 const [accounts]=await c.query('SELECT User FROM mysql.user WHERE User=? AND Host=?',[username,'%']);
 assert.equal(accounts.length,1,'Expected existing restricted runtime account');
 const tables=['v2_folder_nodes','v2_document_folders'];
 for(const table of tables){
  await c.query('GRANT SELECT, INSERT, UPDATE, DELETE ON `edms_ups`.`'+table+'` TO ?@?',[username,'%']);
  const [privileges]=await c.query('SELECT PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=? AND TABLE_NAME=?',["'"+username+"'@'%'",'edms_ups',table]);
  assert.deepEqual(privileges.map(p=>p.PRIVILEGE_TYPE).sort(),['DELETE','INSERT','SELECT','UPDATE']);
 }
 return {passed:true,tables,privileges:['SELECT','INSERT','UPDATE','DELETE']};
}
