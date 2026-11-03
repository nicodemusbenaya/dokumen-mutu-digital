// Seed 4 form asli sebagai draf (tanpa bidang). Idempoten per judul.
// --update: draf lama (judul/previousTitles) tanpa jawaban disamakan dengan template (khusus laptop; produksi tidak menimpa editan). Jalankan dari edms-v2:
//   node --env-file=.env.home scripts/seed-forms.mjs
import fs from 'node:fs/promises';
import {query,pool} from '../src/lib/db.mjs';
import {id} from '../src/lib/core.mjs';
import {validateDefinition,publicToken} from '../src/lib/forms.mjs';
// .env.home hanya berisi HOME_*; petakan ke DB lokal dev:home seperti scripts/dev-home.mjs.
if(!process.env.DB_HOST&&process.env.HOME_DB_PASSWORD)Object.assign(process.env,{DB_HOST:'127.0.0.1',DB_PORT:'33307',DB_NAME:'edms_home',DB_USER:'root',DB_PASSWORD:process.env.HOME_DB_PASSWORD});
const dir=new URL('./form-templates/',import.meta.url);
try{
 const [admin]=await query("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='Super user' AND u.is_active=1 ORDER BY u.id LIMIT 1");
 if(!admin)throw new Error('Super user aktif tidak ditemukan');
 for(const name of (await fs.readdir(dir)).filter(n=>n.endsWith('.json')).sort()){
  const t=JSON.parse(await fs.readFile(new URL(name,dir),'utf8'));
  validateDefinition(t.definition);
  const titles=[t.title,...(t.previousTitles||[])];
  const [exists]=await query('SELECT f.id,f.published_version,(SELECT COUNT(*) FROM v2_form_submissions s WHERE s.form_id=f.id) subs FROM v2_forms f WHERE f.title IN ('+titles.map(()=>'?').join(',')+') ORDER BY f.title=? DESC LIMIT 1',[...titles,t.title]);
  if(exists&&(exists.published_version!==null||Number(exists.subs))){console.log('lewati (sudah terbit/berisi jawaban):',t.title);continue;}
  // Draf tanpa jawaban disamakan dengan template terbaru; lock_version naik agar editor yang terbuka mendapat konflik 409.
  if(exists&&!process.argv.includes('--update')){console.log('lewati (sudah ada):',t.title);continue;}
  if(exists){await query('UPDATE v2_forms SET title=?,definition_json=?,updated_by=?,lock_version=lock_version+1 WHERE id=?',[t.title,JSON.stringify(t.definition),admin.id,exists.id]);console.log('diperbarui (draf):',t.title);continue;}
  await query('INSERT INTO v2_forms(id,title,department,public_token,definition_json,created_by,updated_by) VALUES(?,?,NULL,?,?,?,?)',[id(),t.title,publicToken(),JSON.stringify(t.definition),admin.id,admin.id]);
  console.log('dibuat (draf):',t.title);
 }
}finally{await pool().end();}
