'use client';
import {useEffect,useState} from 'react';
import {useResource} from './useResource';
import {FormFill,Definition,Field,FieldType,Row,Column,Answers} from './FormFill';
import {call,formLink} from './forms-client';
import {textToRows as rowsFromText,textToCols as colsFromText} from '@/lib/form-ids.mjs';
const textToRows=(t:string,old:Row[]):Row[]=>rowsFromText(t,old);
const textToCols=(t:string,old:Column[]):Column[]=>colsFromText(t,old);
import {IconArrowLeft,IconPlus} from './Icons';
import s from './Forms.module.css';
import w from '../app/workspace.module.css';
type Detail={id:string;title:string;department:string|null;status:'draft'|'published'|'closed';access:'login'|'public';publicToken:string;publishedVersion:number|null;lockVersion:number;submissions:number;hasUnpublishedChanges:boolean;definition:Definition};
const TYPES:[FieldType,string][]=[['heading','Judul bagian'],['static','Teks/pernyataan'],['text','Teks singkat'],['textarea','Teks panjang'],['date','Tanggal'],['time','Jam'],['radio','Pilihan satu'],['checkbox','Pilihan banyak'],['grid','Ceklis / matriks'],['table','Tabel berulang'],['signature','Tanda tangan']];
const typeName=Object.fromEntries(TYPES) as Record<FieldType,string>;
const statusName={draft:'Draf',published:'Dipublish',closed:'Ditutup'};
const newId=(p='f')=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const lines=(t:string)=>t.split('\n').map(x=>x.trim()).filter(Boolean);
const rowsToText=(rows:Row[])=>rows.map(r=>r.cells.join(' | ')).join('\n');
const colsToText=(cols:Column[])=>cols.map(c=>c.label+(c.type==='date'?' | tanggal':c.type==='time'?' | jam':c.type==='radio'?' | pilihan: '+(c.options||[]).join(', '):'')).join('\n');
function blank(type:FieldType):Field{
 const id=newId();
 switch(type){
  case 'heading':return {id,type,label:'Bagian baru'};
  case 'static':return {id,type,text:'Teks pernyataan'};
  case 'radio':case 'checkbox':return {id,type,label:'Pertanyaan',options:['Opsi 1','Opsi 2']};
  case 'grid':return {id,type,label:'Ceklis',fixedColumns:['Item'],choice:{label:'Jawaban',options:['Ya','Tidak','N/A']},remark:'Keterangan',groups:[{title:'',rows:[{id:newId('r'),cells:['Item pertama']}]}]};
  case 'table':return {id,type,label:'Tabel',columns:[{id:newId('c'),label:'Kolom 1'}],minRows:1,maxRows:20};
  case 'signature':return {id,type,label:'Tanda tangan',required:true};
  default:return {id,type,label:'Pertanyaan'};
 }
}
function LinesInput({label,value,onCommit,hint}:{label:string;value:string;onCommit:(t:string)=>void;hint?:string}){
 const [raw,setRaw]=useState(value);useEffect(()=>setRaw(value),[value]);
 return <label>{label}<textarea value={raw} onChange={e=>setRaw(e.target.value)} onBlur={()=>{if(raw!==value)onCommit(raw);}}/>{hint&&<small className={s.code}>{hint}</small>}</label>;
}
function GridEditor({f,update}:{f:Field;update:(p:Partial<Field>)=>void}){
 const groups=f.groups||[];
 const setGroup=(i:number,patch:Partial<{title:string;rows:Row[]}>)=>update({groups:groups.map((g,j)=>j===i?{...g,...patch}:g)});
 return <>
  <LinesInput label="Kolom tetap (satu per baris)" value={(f.fixedColumns||[]).join('\n')} onCommit={t=>update({fixedColumns:lines(t)})}/>
  <label>Judul kolom jawaban<input value={f.choice?.label||''} onChange={e=>update({choice:{options:f.choice?.options||[],label:e.target.value}})}/></label>
  <LinesInput label="Pilihan jawaban (satu per baris)" value={(f.choice?.options||[]).join('\n')} onCommit={t=>update({choice:{label:f.choice?.label||'Jawaban',options:lines(t)}})}/>
  <label>Kolom keterangan (kosongkan bila tidak ada)<input value={f.remark||''} onChange={e=>update({remark:e.target.value||undefined})}/></label>
  {groups.map((g,i)=><div key={i} className={s.fieldCard}><label>Judul kelompok<input value={g.title||''} onChange={e=>setGroup(i,{title:e.target.value})}/></label><LinesInput label="Baris (satu per baris; pisahkan kolom tetap dengan |)" hint="Tulis '......' untuk isian kecil di dalam item." value={rowsToText(g.rows)} onCommit={t=>setGroup(i,{rows:textToRows(t,g.rows)})}/><button type="button" className={s.linkButton} disabled={groups.length<=1} onClick={()=>update({groups:groups.filter((_,j)=>j!==i)})}>Hapus kelompok</button></div>)}
  <button type="button" className={s.iconButton} onClick={()=>update({groups:[...groups,{title:'',rows:[{id:newId('r'),cells:['Item baru']}]}]})}>Tambah kelompok</button>
 </>;
}
function FieldEditor({f,update}:{f:Field;update:(p:Partial<Field>)=>void}){
 const input=f.type!=='heading'&&f.type!=='static';
 return <div className={s.editorGrid}>
  {f.type==='static'?<LinesInput label="Teks (baris diawali '- ' menjadi poin)" value={f.text||''} onCommit={text=>update({text})}/>:<label>{f.type==='heading'?'Judul bagian':'Label'}<input value={f.label||''} maxLength={500} onChange={e=>update({label:e.target.value})}/></label>}
  {f.type!=='static'&&<label>Keterangan<input value={f.description||''} onChange={e=>update({description:e.target.value||undefined})}/></label>}
  {input&&<label className={s.check}><input type="checkbox" checked={!!f.required} onChange={e=>update({required:e.target.checked})}/>Wajib diisi</label>}
  {f.type==='text'&&<label>Format isian<select value={f.format||''} onChange={e=>update({format:(e.target.value||undefined) as Field['format']})}><option value="">Teks bebas</option><option value="email">Email</option><option value="number">Angka</option></select></label>}
  {f.type==='text'&&<label>Placeholder<input value={f.placeholder||''} onChange={e=>update({placeholder:e.target.value||undefined})}/></label>}
  {f.type==='time'&&<label className={s.check}><input type="checkbox" checked={!!f.range} onChange={e=>update({range:e.target.checked})}/>Rentang jam (mulai s.d. selesai)</label>}
  {(f.type==='radio'||f.type==='checkbox')&&<><LinesInput label="Opsi (satu per baris)" value={(f.options||[]).join('\n')} onCommit={t=>update({options:[...new Set(lines(t))]})}/><label className={s.check}><input type="checkbox" checked={!!f.other} onChange={e=>update({other:e.target.checked})}/>Tambahkan opsi "Lainnya"</label></>}
  {f.type==='grid'&&<GridEditor f={f} update={update}/>}
  {f.type==='table'&&<><LinesInput label="Kolom (satu per baris)" hint="Tambahkan '| tanggal', '| jam', atau '| pilihan: Ya, Tidak' untuk jenis kolom." value={colsToText(f.columns||[])} onCommit={t=>update({columns:textToCols(t,f.columns||[])})}/><label>Baris minimal<input type="number" min={0} max={200} value={f.minRows??1} onChange={e=>update({minRows:Number(e.target.value)})}/></label><label>Baris maksimal<input type="number" min={1} max={200} value={f.maxRows??50} onChange={e=>update({maxRows:Number(e.target.value)})}/></label></>}
 </div>;
}
export function FormBuilder({id,user,imported,back}:{id:string;user:{role:string};imported?:boolean;back:()=>void}){
 const res=useResource<Detail>('forms/'+id);
 const masters=useResource<{values:{type:string;value:string;label:string;isActive:number}[]}>(user.role==='Super user'?'masters':null);
 const [form,setForm]=useState<Detail|null>(null),[open,setOpen]=useState<string|null>(null),[preview,setPreview]=useState(false),[previewAnswers,setPreviewAnswers]=useState<Answers>({}),[addType,setAddType]=useState<FieldType>('text'),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(res.data)setForm(res.data);},[res.data]);
 useEffect(()=>{if(!dirty)return;const h=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',h);return()=>window.removeEventListener('beforeunload',h);},[dirty]);
 if(!form)return res.error?<div role="alert" className={w.error}>{res.error}<button onClick={res.reload}>Coba lagi</button></div>:<p role="status" className={w.empty}>Memuat form…</p>;
 const fields=form.definition.fields,header=form.definition.header||{};
 const edit=(patch:Partial<Detail>)=>{setForm({...form,...patch});setDirty(true);setNotice('');};
 const setHeader=(patch:Record<string,string|undefined>)=>edit({definition:{...form.definition,header:{...header,...patch}}});
 const setFields=(next:Field[])=>edit({definition:{...form.definition,fields:next}});
 const updateField=(fid:string,patch:Partial<Field>)=>setFields(fields.map(f=>f.id===fid?{...f,...patch}:f));
 const move=(i:number,d:number)=>{const j=i+d;if(j<0||j>=fields.length)return;const next=[...fields];[next[i],next[j]]=[next[j],next[i]];setFields(next);};
 const add=()=>{const f=blank(addType);setFields([...fields,f]);setOpen(f.id);};
 async function save(){setBusy(true);setError('');try{const d=await call('forms/'+id,{method:'PUT',body:JSON.stringify({title:form!.title,department:form!.department,access:form!.access,definition:form!.definition,expectedVersion:form!.lockVersion})});setForm({...form!,lockVersion:d.lockVersion});setDirty(false);setNotice('Draf tersimpan.');return true;}catch(e:any){setError(e.message);return false;}finally{setBusy(false);}}
 async function publish(){if(dirty&&!await save())return;setBusy(true);setError('');try{await call('forms/'+id+'/publish',{method:'POST',body:'{}'});setNotice('Form dipublish. Link siap dibagikan.');res.reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function close(){if(!window.confirm('Tutup form? Link tidak dapat diisi sampai form dipublish lagi.'))return;setBusy(true);try{await call('forms/'+id+'/close',{method:'POST',body:'{}'});setNotice('Form ditutup.');res.reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function remove(){if(!window.confirm('Hapus form ini secara permanen?'))return;setBusy(true);try{await call('forms/'+id,{method:'DELETE'});back();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 function leave(){if(dirty&&!window.confirm('Perubahan belum disimpan. Tinggalkan builder?'))return;back();}
 const departments=(masters.data?.values||[]).filter(v=>v.type==='department'&&v.isActive);
 return <>
  <button className={w.back} onClick={leave}><IconArrowLeft/>Kembali ke daftar form</button>
  <div className={w.pageHead}><div><h1>{form.title||'Form tanpa judul'}</h1><p>{statusName[form.status]} · versi publish {form.publishedVersion||'–'} · {form.submissions} jawaban{dirty?' · ada perubahan belum disimpan':''}</p></div><div className={s.actions}><button className={w.secondary} onClick={()=>setPreview(p=>!p)}>{preview?'Kembali ke editor':'Pratinjau'}</button><button className={w.secondary} disabled={busy||!dirty} onClick={save}>Simpan draf</button><button className={w.primary} disabled={busy} onClick={publish}>{form.status==='published'?'Publish perubahan':'Publish'}</button></div></div>
  {imported&&<div className={s.banner}>Hasil impor otomatis. Periksa dan rapikan setiap field sebelum publish.</div>}
  {error&&<div role="alert" className={w.error}>{error}<button onClick={()=>setError('')}>Tutup</button></div>}
  {notice&&<div role="status" className={w.notice}>{notice}<button onClick={()=>setNotice('')}>Tutup</button></div>}
  {form.status==='published'&&<section className={w.panel}><p>Link form: <a href={formLink(form.publicToken)} target="_blank" rel="noreferrer">{formLink(form.publicToken)}</a></p>{form.hasUnpublishedChanges&&<p className={s.code}>Ada perubahan yang belum dipublish. Pengisi masih melihat versi sebelumnya.</p>}</section>}
  <section className={w.panel}><div className={s.settings}>
   <label>Judul form<input value={form.title} maxLength={255} onChange={e=>edit({title:e.target.value})}/></label>
   <label>Kode formulir<input value={header.code||''} onChange={e=>setHeader({code:e.target.value||undefined})}/></label>
   <label>Subjudul<input value={header.subtitle||''} onChange={e=>setHeader({subtitle:e.target.value||undefined})}/></label>
   <label>Catatan kaki<input value={header.footer||''} onChange={e=>setHeader({footer:e.target.value||undefined})}/></label>
   {user.role==='Super user'&&<label>Bidang<select value={form.department||''} onChange={e=>edit({department:e.target.value||null})}><option value="">Belum ada bidang</option>{form.department&&!departments.some(d=>d.value===form.department)&&<option value={form.department}>{form.department}</option>}{departments.map(d=><option key={d.value} value={d.value}>{d.label||d.value}</option>)}</select></label>}
   <label>Akses pengisi<select value={form.access} onChange={e=>edit({access:e.target.value as Detail['access']})}><option value="login">Wajib login EDMS</option><option value="public">Tanpa login (siapa pun yang punya link)</option></select><small className={s.code}>Perubahan akses berlaku setelah disimpan.</small></label>
  </div></section>
  {preview?<section className={w.panel}><FormFill definition={form.definition} answers={previewAnswers} onChange={setPreviewAnswers}/></section>:<section className={s.builder} aria-label="Daftar field">
   {fields.map((f,i)=><article key={f.id} className={s.fieldCard}><header><div><span className={s.typeTag}>{typeName[f.type]}</span><strong>{f.type==='static'?(f.text||'').slice(0,80):f.label}</strong>{f.required&&<span className={s.req} aria-label="wajib">*</span>}</div><div className={s.actions}><button type="button" className={s.iconButton} disabled={i===0} onClick={()=>move(i,-1)} aria-label={'Naikkan '+(f.label||'field')}>Naik</button><button type="button" className={s.iconButton} disabled={i===fields.length-1} onClick={()=>move(i,1)} aria-label={'Turunkan '+(f.label||'field')}>Turun</button><button type="button" className={s.iconButton} aria-expanded={open===f.id} onClick={()=>setOpen(open===f.id?null:f.id)}>{open===f.id?'Tutup':'Ubah'}</button><button type="button" className={s.iconButton} onClick={()=>{if(window.confirm('Hapus field ini?'))setFields(fields.filter(x=>x.id!==f.id));}}>Hapus</button></div></header>{open===f.id&&<FieldEditor f={f} update={p=>updateField(f.id,p)}/>}</article>)}
   <div className={s.actions}><label className={s.grow}>Jenis field baru<select value={addType} onChange={e=>setAddType(e.target.value as FieldType)}>{TYPES.map(([t,n])=><option key={t} value={t}>{n}</option>)}</select></label><button type="button" className={w.secondary} onClick={add}><IconPlus/>Tambah field</button></div>
  </section>}
  <div className={s.actions}>{form.status==='published'&&<button className={w.secondary} disabled={busy} onClick={close}>Tutup form</button>}{form.submissions===0&&<button className={w.secondary} disabled={busy} onClick={remove}>Hapus form</button>}</div>
 </>;
}
