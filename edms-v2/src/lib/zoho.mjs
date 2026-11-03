// Form Zoho: entri diisi di Zoho Forms, dikirim ke EDMS lewat webhook dan hanya ditampilkan (read-only).
import crypto from 'node:crypto';
import {query} from './db.mjs';
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
const entryRow=e=>({id:e.id,receivedAt:e.received_at,payload:JSON.parse(e.payload_json)});

// Kode form dari nama link Zoho (atau judul): huruf kecil, angka dan tanda hubung.
export const slugify=v=>String(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'form';
export function zohoLink(v){if(v==null||v==='')return null;if(typeof v!=='string'||v.length>500||!/^https:\/\/forms\.zoho\.(com|eu|in|jp|sa|ca|com\.au|com\.cn)\/[\w\-\/.]+$/i.test(v.trim()))fail('Link Zoho harus diawali https://forms.zoho.com/');return v.trim();}

export async function zohoForms(req,segments,user,{body,response}){
 const [area,slug,operation]=segments,method=req.method,url=new URL(req.url);
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
 if(operation==='key'&&method==='POST'){
  if(!admin)fail('Hanya Super user yang dapat membuat kunci webhook',403);
  const key=crypto.randomBytes(32).toString('hex');
  await query('UPDATE v2_zoho_forms SET webhook_key=? WHERE slug=?',[key,f.slug]);
  await audit(null,user,req,'ZOHO_WEBHOOK_KEY',null,{form:f.slug});
  return response({webhookKey:key});
 }
 if(operation==='entries'&&method==='GET'){
  const page=Math.max(1,Number(url.searchParams.get('page'))||1);
  const [count]=await query('SELECT COUNT(*) total FROM v2_zoho_entries WHERE form_slug=?',[f.slug]);
  const list=(await query('SELECT id,received_at,payload_json FROM v2_zoho_entries WHERE form_slug=? ORDER BY received_at DESC,id LIMIT 50 OFFSET '+((page-1)*50),[f.slug])).map(entryRow);
  return response({title:f.title,zohoUrl:f.zoho_url,total:Number(count.total),page,entries:list});
 }
 if(operation==='export'&&method==='GET'){
  // ponytail: semua entri dimuat sekaligus; cukup untuk ribuan entri form internal, ganti ke batch bila jauh lebih besar.
  const list=(await query('SELECT id,received_at,payload_json FROM v2_zoho_entries WHERE form_slug=? ORDER BY received_at,id',[f.slug])).map(entryRow);
  const cols=columns(list),table=[['Diterima EDMS',...cols],...list.map(e=>[String(e.receivedAt),...cols.map(c=>cell(e.payload[c]))])];
  await audit(null,user,req,'ZOHO_FORM_EXPORT',null,{form:f.slug,rows:list.length});
  const name=`${f.title.slice(0,80)}-entri-${new Date().toISOString().slice(0,10).replaceAll('-','')}.xlsx`,ascii=name.replace(/[^\w.\-]+/g,'_');
  return new Response(await toXlsx(table),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'no-store'}});
 }
 fail('Endpoint form tidak ditemukan',404);
}
