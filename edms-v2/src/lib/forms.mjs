import {randomBytes} from 'node:crypto';
import {fail} from './core.mjs';
import {departmentsMatch} from './document-classification.mjs';
import {isVisible} from './form-logic.mjs';
export const FIELD_TYPES=['heading','static','text','textarea','date','time','radio','checkbox','grid','table','signature'];
export const OTHER='__other';
const ID=/^[a-z0-9_]{1,40}$/i,DATE=/^\d{4}-\d{2}-\d{2}$/,TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
const PNG=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),MAX_SIGNATURE=204800;
export const publicToken=()=>randomBytes(16).toString('hex');
export function canManage(user,form){return user?.role==='Super user'||(user?.role==='Editor'&&!!user.bidang?.trim()&&!!form?.department?.trim()&&departmentsMatch(form.department,user.bidang));}
const str=(v,max)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const unique=list=>new Set(list).size===list.length;
export function validateDefinition(def){
 if(!def||typeof def!=='object'||!Array.isArray(def.fields))fail('Definisi form tidak valid');
 if(JSON.stringify(def).length>1048576)fail('Definisi form terlalu besar',413);
 if(!def.fields.length)fail('Form belum memiliki field');
 const ids=new Set();
 for(const f of def.fields){
  const where='Field "'+String(f?.label||f?.id||'?').slice(0,60)+'": ';
  if(!f||!FIELD_TYPES.includes(f.type))fail(where+'jenis field tidak dikenal');
  if(!ID.test(f.id||'')||ids.has(f.id))fail(where+'ID field kosong atau ganda');
  ids.add(f.id);
  if(f.type==='static'?!str(f.text,20000):!str(f.label,500))fail(where+(f.type==='static'?'teks':'label')+' wajib diisi');
  if((f.type==='radio'||f.type==='checkbox')&&!(Array.isArray(f.options)&&f.options.length&&f.options.every(o=>str(o,200)&&o!==OTHER)&&unique(f.options)))fail(where+'butuh minimal satu opsi unik');
  if(f.type==='table'){const min=f.minRows??0,max=f.maxRows??50;if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<1||max>200||min>max)fail(where+'baris minimal/maksimal tabel tidak valid (0–200, minimal ≤ maksimal)');}
  if(f.type==='grid'){
   const rows=Array.isArray(f.groups)?f.groups.flatMap(g=>Array.isArray(g?.rows)?g.rows:[]):[];
   if(!rows.length||!Array.isArray(f.choice?.options)||!f.choice.options.length||!f.choice.options.every(o=>str(o,60))||!unique(f.choice.options))fail(where+'grid butuh baris dan pilihan jawaban');
   if(!Array.isArray(f.fixedColumns)||!f.fixedColumns.length)fail(where+'grid butuh minimal satu kolom tetap');
   if(!rows.every(r=>ID.test(r?.id||'')&&Array.isArray(r.cells))||!unique(rows.map(r=>r.id)))fail(where+'ID baris kosong atau ganda');
  }
  if(f.format!==undefined&&!(f.type==='text'&&['email','number'].includes(f.format)))fail(where+'format hanya email/number untuk teks singkat');
  if(f.showIf!==undefined&&!(ids.has(f.showIf?.field)&&f.showIf.field!==f.id&&Array.isArray(f.showIf.anyOf)&&f.showIf.anyOf.length&&f.showIf.anyOf.every(o=>str(o,200))))fail(where+'syarat tampil harus merujuk field sebelumnya dan punya nilai');
  if(f.type==='table'&&!(Array.isArray(f.columns)&&f.columns.length&&f.columns.every(c=>ID.test(c?.id||'')&&str(c.label,200))&&unique(f.columns.map(c=>c.id))))fail(where+'tabel butuh kolom dengan ID unik');
 }
 return def;
}
const bad=message=>{throw new Error(message);};
const filled=v=>v!==undefined&&v!==null&&v!=='';
function plain(v,max){if(!filled(v))return;if(typeof v!=='string')bad('Format isian tidak valid');const t=v.trim();if(!t)return;if(t.length>max)bad('Maksimal '+max+' karakter');return t;}
function date(v){const t=plain(v,10);if(!t)return;const d=new Date(t+'T00:00:00Z');if(!DATE.test(t)||isNaN(d)||d.toISOString().slice(0,10)!==t)bad('Tanggal tidak valid');return t;}
function time(v){const t=plain(v,5);if(t&&!TIME.test(t))bad('Jam tidak valid');return t;}
function pick(f,v){
 if(!filled(v?.value))return;
 if(v.value===OTHER){if(!f.other)bad('Opsi tidak tersedia');return {value:OTHER,other:plain(v.other,500)||bad('Isi keterangan "Lainnya"')};}
 if(!f.options.includes(v.value))bad('Opsi tidak tersedia');
 return {value:v.value};
}
function many(f,v){
 const list=Array.isArray(v?.values)?[...new Set(v.values)]:[];
 if(!list.length)return;
 for(const x of list)if(x===OTHER?!f.other:!f.options.includes(x))bad('Opsi tidak tersedia');
 const out={values:list};
 if(list.includes(OTHER))out.other=plain(v.other,500)||bad('Isi keterangan "Lainnya"');
 return out;
}
function grid(f,v){
 const src=v&&typeof v==='object'&&!Array.isArray(v)?v:{},out={};let missing=false;
 for(const r of f.groups.flatMap(g=>g.rows)){
  const a=src[r.id]&&typeof src[r.id]==='object'?src[r.id]:{};
  const choice=filled(a.choice)?a.choice:undefined;
  if(choice!==undefined&&!f.choice.options.includes(choice))bad('Pilihan baris tidak valid');
  const remark=f.remark?plain(a.remark,1000):undefined,blank=r.blank?plain(a.blank,500):undefined;
  if(!choice&&f.required)missing=true;
  if(choice||remark||blank)out[r.id]={...(choice&&{choice}),...(remark&&{remark}),...(blank&&{blank})};
 }
 if(missing)bad('Semua baris wajib dipilih');
 return Object.keys(out).length?out:undefined;
}
function table(f,v){
 if(filled(v)&&!Array.isArray(v))bad('Format tabel tidak valid');
 const list=(v||[]).map(row=>{const out={};for(const c of f.columns){const x=row?.[c.id];let t;if(c.type==='date')t=date(x);else if(c.type==='time')t=time(x);else{t=plain(x,1000);if(t&&c.type==='radio'&&!(c.options||[]).includes(t))bad('Pilihan kolom "'+c.label+'" tidak valid');}if(t)out[c.id]=t;}return out;}).filter(r=>Object.keys(r).length);
 for(const r of list)for(const c of f.columns)if(c.required&&!r[c.id])bad('Kolom "'+c.label+'" wajib diisi pada setiap baris');
 const max=Math.min(f.maxRows??50,200),min=f.minRows??0;
 if(list.length>max)bad('Maksimal '+max+' baris');
 if(list.length&&list.length<min)bad('Minimal '+min+' baris');
 return list.length?list:undefined;
}
function signature(v){
 if(!filled(v?.image)&&!filled(v?.name))return;
 const name=plain(v.name,160)||bad('Nama penanda tangan wajib diisi');
 const m=/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(typeof v.image==='string'?v.image:'');
 if(!m)bad('Tanda tangan belum digambar');
 const buf=Buffer.from(m[1],'base64');
 if(buf.length>MAX_SIGNATURE)bad('Gambar tanda tangan terlalu besar');
 if(!buf.subarray(0,8).equals(PNG))bad('Gambar tanda tangan tidak valid');
 // Kanvas tanda tangan 600×200; PNG kecil berdimensi raksasa bisa membekukan browser saat dilihat/dicetak.
 if(buf.length<24||buf.toString('latin1',12,16)!=='IHDR'||buf.readUInt32BE(16)>2000||buf.readUInt32BE(20)>1000)bad('Ukuran gambar tanda tangan tidak valid');
 return {name,image:v.image,signedAt:new Date().toISOString()};
}
function check(f,v){
 switch(f.type){
  case 'text':{const t=plain(v,500);if(t&&f.format==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))bad('Email tidak valid');if(t&&f.format==='number'&&!/^-?\d+([.,]\d+)?$/.test(t))bad('Isi dengan angka');return t;}
  case 'textarea':return plain(v,10000);
  case 'date':return date(v);
  case 'time':if(!f.range)return time(v);if(!filled(v?.from)&&!filled(v?.to))return;{const from=time(v.from),to=time(v.to);if(!from||!to)bad('Isi jam mulai dan selesai');return {from,to};}
  case 'radio':return pick(f,v);
  case 'checkbox':return many(f,v);
  case 'grid':return grid(f,v);
  case 'table':return table(f,v);
  case 'signature':return signature(v);
 }
}
export function validateAnswers(def,input){
 const answers=input&&typeof input==='object'&&!Array.isArray(input)?input:{},out={},errors={};
 for(const f of def.fields){
  if(f.type==='heading'||f.type==='static'||!isVisible(f,def,answers))continue;
  try{const clean=check(f,answers[f.id]);if(clean!==undefined)out[f.id]=clean;else if(f.required)bad('Wajib diisi');}catch(e){errors[f.id]=e.message;}
 }
 if(Object.keys(errors).length){const e=new Error('Periksa kembali isian yang ditandai');e.status=400;e.fields=errors;throw e;}
 return out;
}
