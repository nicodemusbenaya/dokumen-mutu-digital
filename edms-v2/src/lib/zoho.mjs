// Form Zoho: entri diisi di Zoho Forms, dikirim ke EDMS lewat webhook dan hanya ditampilkan (read-only).
import crypto from 'node:crypto';
import {query,withTransaction,rows} from './db.mjs';
import {id,fail,editable,text} from './core.mjs';
import {audit,rate} from './security.mjs';
import {toXlsx} from './xlsx.mjs';

const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const sameKey=(given,expected)=>crypto.timingSafeEqual(Buffer.from(sha(String(given))),Buffer.from(sha(String(expected))));

// Zoho dapat mengirim JSON, x-www-form-urlencoded atau multipart; semua jadi objek urut sesuai kiriman.
export async function parsePayload(raw,type=''){
 const text=raw.toString('utf8');
 if(/json/i.test(type)||/^\s*[{[]/.test(text)){try{const v=JSON.parse(text);if(v&&typeof v==='object')return Array.isArray(v)?{data:v}:v;}catch{}}
 const pairs=/multipart\/form-data/i.test(type)?[...(await new Response(raw,{headers:{'content-type':type}}).formData()).entries()].map(([k,v])=>[k,typeof v==='string'?v:'(file) '+v.name])
  :/x-www-form-urlencoded/i.test(type)||!type&&text.includes('=')?[...new URLSearchParams(text)]:null;
 if(pairs?.length){const o={};for(const [k,v] of pairs)o[k]=k in o?[].concat(o[k],v):v;return o;}
 return text.trim()?{_raw:text}:{};
}
// Nilai bersarang (nama, alamat, subform) diratakan menjadi teks untuk tabel dan Excel.
export function cell(v){
 if(v==null)return '';
 if(Array.isArray(v))return v.map(cell).filter(Boolean).join('; ');
 if(typeof v==='object')return Object.entries(v).map(([k,x])=>k+': '+cell(x)).join(', ');
 return String(v);
}
// CSV export Zoho (RFC 4180: kutip, "" di dalam kutip, baris baru di dalam sel); pemisah koma atau titik koma.
export function parseCsv(text){
 const src=String(text).replace(/^﻿/,''),first=src.slice(0,src.search(/\r?\n|$/));
 const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(quoted){if(ch==='"'){if(src[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=ch;continue;}
  if(ch==='"')quoted=true;
  else if(ch===sep){row.push(field);field='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&src[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
  else field+=ch;
 }
 if(quoted)fail('File CSV tidak valid: tanda kutip tidak tertutup');
 if(field||row.length){row.push(field);rows.push(row);}
 return rows.filter(r=>r.some(v=>v.trim()));
}
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,mei:5,jun:6,jul:7,aug:8,agu:8,agt:8,sep:9,oct:10,okt:10,nov:11,dec:12,des:12};
// "Added Time" Zoho (mis. 03-Nov-2026 10:20:30 atau 2026-11-03 10:20:30) -> DATETIME; selain itu null.
export function zohoTime(v){
 const s=String(v||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/),y,mo,d,h,mi,se;
 if(m)[,y,mo,d,h,mi,se]=m;else if((m=s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ](\d{4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i))){[,d,mo,y,h,mi,se]=m;mo=MONTHS[mo.toLowerCase()];if(!mo)return null;const ap=(m[7]||'').toUpperCase();h=Number(h);if(ap==='PM'&&h<12)h+=12;if(ap==='AM'&&h===12)h=0;}else return null;
 const p=n=>String(n).padStart(2,'0'),out=`${y}-${p(mo)}-${p(d)} ${p(h)}:${p(mi)}:${p(se||0)}`;
 return Number(mo)>=1&&Number(mo)<=12&&Number(d)>=1&&Number(d)<=31&&Number(h)<24&&Number(mi)<60?out:null;
}
const TIME_COLUMNS=['Added Time','Waktu Ditambahkan','Submitted Time','Added_Time'];
// Export CSV Zoho bisa memakai header dua baris: baris 1 judul field/kelompok (matriks, subform),
// baris 2 sub-kolom. Isi subform ke-2 dst. ada di baris lanjutan yang kolom biasanya kosong.
// ponytail: subform dikenali dari adanya baris lanjutan; subform yang di seluruh file hanya
// berisi satu baris diratakan seperti matriks (nilai tetap utuh, hanya bentuknya datar).
export function csvEntries(text){
 const rows=parseCsv(text);if(rows.length<2)fail('File CSV kosong atau tidak memiliki baris jawaban');
 const h0=rows[0].map(v=>v.trim()),h1=(rows[1]||[]).map(v=>v.trim());
 const two=rows.length>2&&!h1[0]&&h1.some(Boolean)&&h1.every((v,i)=>!v||!h0[i]||!h0[i+1]);
 let group=null;
 const cols=h0.map((v,i)=>{const sub=two?h1[i]||'':'';if(v){group=sub?v:null;return {group,key:sub||v};}return {group:two?group:null,key:sub||'Kolom '+(i+1)};});
 const data=rows.slice(two?2:1),single=cols.map((c,i)=>c.group?-1:i).filter(i=>i>=0);
 const isCont=r=>single.length>0&&single.every(i=>!(r[i]||'').trim())&&r.some(v=>v.trim());
 const subforms=new Set();for(const r of data)if(isCont(r))r.forEach((v,i)=>{if(v.trim()&&cols[i].group)subforms.add(cols[i].group);});
 const grouped=[];for(const r of data){if(isCont(r)&&grouped.length)grouped.at(-1).push(r);else grouped.push([r]);}
 if(grouped.length>20000)fail('Maksimal 20.000 jawaban per impor');
 const timeCol=cols.findIndex(c=>!c.group&&TIME_COLUMNS.includes(c.key));
 return grouped.map(lines=>{
  const payload={},first=lines[0],put=(k,v)=>{let key=k,n=2;while(key in payload)key=k+' ('+(n++)+')';payload[key]=v;};
  cols.forEach((c,i)=>{
   if(c.group&&subforms.has(c.group)){
    if(c.group in payload)return;
    const idx=cols.map((x,j)=>x.group===c.group?j:-1).filter(j=>j>=0);
    put(c.group,lines.map(l=>Object.fromEntries(idx.map(j=>[cols[j].key,(l[j]||'').trim()]))).filter(o=>Object.values(o).some(Boolean)));
   }else put(c.key,(first[i]??'').trim());
  });
  return {payload,time:timeCol>=0?zohoTime(first[timeCol]):null};
 });
}
// Rentang tanggal YYYY-MM-DD (inklusif) atas waktu entri; tanpa tanggal = semua entri form.
export function purgeRange(d){
 const ok=v=>v==null||v===''||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z')));
 const from=d?.from||null,to=d?.to||null;
 if(!ok(from)||!ok(to))fail('Format tanggal tidak valid');
 if(from&&to&&from>to)fail('Tanggal awal melebihi tanggal akhir');
 const sql=(from?' AND received_at>=?':'')+(to?' AND received_at<DATE_ADD(?,INTERVAL 1 DAY)':'');
 return {from,to,sql,args:[from,to].filter(Boolean)};
}
export function columns(entries){const seen=new Set();for(const e of entries)for(const k of Object.keys(e.payload))seen.add(k);return [...seen];}

export async function zohoWebhook(req,segments,{body,response}){
 const [area,slug]=segments;if(area!=='zoho-webhook')return null;
 if(req.method!=='POST')fail('Metode tidak didukung',405);
 const given=new URL(req.url).searchParams.get('key')||req.headers.get('x-edms-key')||'';
 const [f]=await query('SELECT slug,webhook_key FROM v2_zoho_forms WHERE slug=?',[String(slug||'').slice(0,80)]);
 if(!f?.webhook_key||!given||!sameKey(given,f.webhook_key))fail('Kunci webhook tidak valid',401);
 await rate(req,'zoho:'+f.slug,600);
 const payload=await parsePayload(await body(req,1048576),req.headers.get('content-type')||''),json=JSON.stringify(payload);
 // Kiriman ulang Zoho yang identik tidak menggandakan entri.
 await query('INSERT IGNORE INTO v2_zoho_entries(id,form_slug,payload_hash,payload_json) VALUES(?,?,?,?)',[id(),f.slug,sha(f.slug+'\n'+json),json]);
 return response({ok:true});
}

async function form(slug){const [f]=await query('SELECT * FROM v2_zoho_forms WHERE slug=?',[String(slug).slice(0,80)]);if(!f)fail('Form tidak ditemukan',404);return f;}
const entryRow=e=>({id:e.id,receivedAt:e.received_at,source:e.source,payload:JSON.parse(e.payload_json)});

// Kode form dari nama link Zoho (atau judul): huruf kecil, angka dan tanda hubung.
export const slugify=v=>String(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'form';
export function zohoLink(v){if(v==null||v==='')return null;if(typeof v!=='string'||v.length>500||!/^https:\/\/forms\.zoho\.(com|eu|in|jp|sa|ca|com\.au|com\.cn)\/[\w\-\/.]+$/i.test(v.trim()))fail('Link Zoho harus diawali https://forms.zoho.com/');return v.trim();}

export async function zohoForms(req,segments,user,{body,response}){
 const [area,slug,operation,entryId]=segments,method=req.method,url=new URL(req.url);
 if(area!=='zoho-forms')return null;
 if(!editable(user))fail('Anda tidak berhak melihat Form',403);
 const admin=user.role==='Super user';
 if(!slug&&method==='GET'){
  const list=await query('SELECT f.slug,f.title,f.zoho_url zohoUrl,f.webhook_key,(SELECT COUNT(*) FROM v2_zoho_entries e WHERE e.form_slug=f.slug) entries,(SELECT MAX(received_at) FROM v2_zoho_entries e WHERE e.form_slug=f.slug) lastAt FROM v2_zoho_forms f ORDER BY f.sort_order,f.title');
  return response({forms:list.map(({webhook_key,...f})=>({...f,entries:Number(f.entries),hasKey:!!webhook_key,...(admin?{webhookKey:webhook_key}:{})}))});
 }
 if(!slug&&method==='POST'){
  if(!admin)fail('Hanya Super user yang dapat menambah form',403);
  let data;try{data=JSON.parse((await body(req,8192)).toString());}catch(e){if(e.status)throw e;fail('JSON tidak valid');}
  const title=text(data?.title,255),zohoUrl=zohoLink(data?.zohoUrl),key=crypto.randomBytes(32).toString('hex');
  const base=slugify(zohoUrl?.split('/').pop()||title);let created;
  for(let n=1;!created&&n<50;n++){const s=n===1?base:base.slice(0,76)+'-'+n;const r=await query('INSERT IGNORE INTO v2_zoho_forms(slug,title,zoho_url,webhook_key,sort_order) SELECT ?,?,?,?,COALESCE(MAX(sort_order),0)+1 FROM v2_zoho_forms',[s,title,zohoUrl,key]);if(r.affectedRows)created=s;}
  if(!created)fail('Kode form sudah dipakai. Ubah judul form.',409);
  await audit(null,user,req,'ZOHO_FORM_CREATE',null,{form:created,title});
  return response({slug:created,webhookKey:key},201);
 }
 const f=await form(slug);
 // Penghapusan permanen (Super user): satu entri, per periode, atau form beserta seluruh entrinya.
 const readBody=async()=>{try{return JSON.parse((await body(req,8192)).toString()||'{}');}catch(e){if(e.status)throw e;fail('JSON tidak valid');}};
 const requireAdmin=()=>{if(!admin)fail('Hanya Super user yang dapat menghapus',403);};
 if(!operation&&method==='DELETE'){
  requireAdmin();const data=await readBody();if(data?.confirm!=='HAPUS')fail('Ketik HAPUS untuk konfirmasi');
  const deleted=await withTransaction(async c=>{const r=await rows(c,'DELETE FROM v2_zoho_entries WHERE form_slug=?',[f.slug]);await rows(c,'DELETE FROM v2_zoho_forms WHERE slug=?',[f.slug]);await audit(c,user,req,'ZOHO_FORM_DELETE',null,{form:f.slug,title:f.title,entries:r.affectedRows});return r.affectedRows;});
  return response({deleted});
 }
 if(operation==='entries'&&entryId&&method==='DELETE'){
  requireAdmin();if(!/^[a-f0-9-]{36}$/i.test(entryId))fail('ID tidak valid');
  const n=await withTransaction(async c=>{const r=await rows(c,'DELETE FROM v2_zoho_entries WHERE id=? AND form_slug=?',[entryId,f.slug]);if(r.affectedRows)await audit(c,user,req,'ZOHO_ENTRY_DELETE',null,{form:f.slug,entry:entryId});return r.affectedRows;});
  if(!n)fail('Entri tidak ditemukan',404);
  return response({deleted:n});
 }
 if(operation==='purge'&&method==='POST'){
  requireAdmin();const data=await readBody(),range=purgeRange(data);
  if(!data?.dryRun&&data?.confirm!=='HAPUS')fail('Ketik HAPUS untuk konfirmasi');
  const count=await withTransaction(async c=>{
   const [n]=await rows(c,'SELECT COUNT(*) n FROM v2_zoho_entries WHERE form_slug=?'+range.sql,[f.slug,...range.args]);
   if(data?.dryRun||!Number(n.n))return Number(n.n);
   const r=await rows(c,'DELETE FROM v2_zoho_entries WHERE form_slug=?'+range.sql,[f.slug,...range.args]);
   await audit(c,user,req,'ZOHO_ENTRIES_PURGE',null,{form:f.slug,from:range.from,to:range.to,deleted:r.affectedRows});
   return r.affectedRows;
  });
  return response(data?.dryRun?{count}:{deleted:count});
 }
 if(operation==='key'&&method==='POST'){
  if(!admin)fail('Hanya Super user yang dapat membuat kunci webhook',403);
  const key=crypto.randomBytes(32).toString('hex');
  await query('UPDATE v2_zoho_forms SET webhook_key=? WHERE slug=?',[key,f.slug]);
  await audit(null,user,req,'ZOHO_WEBHOOK_KEY',null,{form:f.slug});
  return response({webhookKey:key});
 }
 if(operation==='import'&&method==='POST'){
  // Impor sekali jawaban lama dari CSV export Zoho. Impor ulang file yang sama tidak menggandakan entri.
  if(!admin)fail('Hanya Super user yang dapat mengimpor entri',403);
  const list=csvEntries((await body(req,20*1048576)).toString('utf8'));
  const inserted=await withTransaction(async c=>{let n=0;for(const e of list){const json=JSON.stringify(e.payload);const r=await rows(c,'INSERT IGNORE INTO v2_zoho_entries(id,form_slug,payload_hash,payload_json,source,received_at) VALUES(?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP(3)))',[id(),f.slug,sha(f.slug+'\n'+json),json,'import',e.time]);n+=r.affectedRows;}return n;});
  await audit(null,user,req,'ZOHO_FORM_IMPORT',null,{form:f.slug,rows:list.length,inserted});
  return response({total:list.length,inserted,skipped:list.length-inserted});
 }
 if(operation==='entries'&&method==='GET'){
  const page=Math.max(1,Number(url.searchParams.get('page'))||1);
  const [count]=await query('SELECT COUNT(*) total FROM v2_zoho_entries WHERE form_slug=?',[f.slug]);
  const list=(await query('SELECT id,received_at,source,payload_json FROM v2_zoho_entries WHERE form_slug=? ORDER BY received_at DESC,id LIMIT 50 OFFSET '+((page-1)*50),[f.slug])).map(entryRow);
  return response({title:f.title,zohoUrl:f.zoho_url,total:Number(count.total),page,entries:list});
 }
 if(operation==='export'&&method==='GET'){
  // ponytail: semua entri dimuat sekaligus; cukup untuk ribuan entri form internal, ganti ke batch bila jauh lebih besar.
  const list=(await query('SELECT id,received_at,source,payload_json FROM v2_zoho_entries WHERE form_slug=? ORDER BY received_at,id',[f.slug])).map(entryRow);
  const cols=columns(list),table=[['Waktu','Sumber',...cols],...list.map(e=>[String(e.receivedAt),e.source==='import'?'Impor CSV':'Webhook',...cols.map(c=>cell(e.payload[c]))])];
  await audit(null,user,req,'ZOHO_FORM_EXPORT',null,{form:f.slug,rows:list.length});
  const name=`${f.title.slice(0,80)}-entri-${new Date().toISOString().slice(0,10).replaceAll('-','')}.xlsx`,ascii=name.replace(/[^\w.\-]+/g,'_');
  return new Response(await toXlsx(table),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'no-store'}});
 }
 fail('Endpoint form tidak ditemukan',404);
}
