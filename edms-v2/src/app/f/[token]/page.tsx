'use client';
import {use,useEffect,useState,FormEvent} from 'react';
import {FormFill,Definition,Answers} from '@/components/FormFill';
import s from '@/components/Forms.module.css';
import w from '../../workspace.module.css';
type Loaded={title:string;definition:Definition;version:number;access:string;user?:{fullName:string}|null};
const Logos=()=><div className={s.logos}><img src="/brand/danantara.svg" alt="Danantara"/><img src="/brand/pln.png" alt="PLN"/></div>;
export default function PublicForm({params}:{params:Promise<{token:string}>}){
 const {token}=use(params);
 const [state,setState]=useState<'loading'|'ready'|'login'|'missing'|'error'|'done'>('loading'),[form,setForm]=useState<Loaded|null>(null),[answers,setAnswers]=useState<Answers>({}),[errors,setErrors]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[stale,setStale]=useState(false);
 const key='form-draft:'+token+':'+(form?.version??'');
 async function load(){
  setState('loading');setMessage('');
  try{const r=await fetch('/api/v2/public-forms/'+token);const d=await r.json();
   if(r.status===401&&d.loginRequired){setState('login');return;}
   if(!r.ok){setMessage(d.error||'Form tidak tersedia');setState(r.status===404?'missing':'error');return;}
   setForm(d);setStale(false);try{const saved=sessionStorage.getItem('form-draft:'+token+':'+d.version);if(saved)setAnswers(JSON.parse(saved));}catch{}setState('ready');
  }catch{setMessage('Tidak dapat terhubung ke server. Coba lagi.');setState('error');}
 }
 useEffect(()=>{load();},[token]);
 function change(next:Answers){setAnswers(next);try{sessionStorage.setItem(key,JSON.stringify(next));}catch{}}
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setErrors({});setMessage('');
  try{const r=await fetch('/api/v2/public-forms/'+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:form!.version,answers})});const d=await r.json();
   if(r.status===401&&d.loginRequired){setState('login');return;}
   if(r.status===409&&d.versionChanged){setStale(true);setMessage(d.error);return;}
   if(!r.ok){setMessage(d.error||'Jawaban gagal dikirim');if(d.fields){setErrors(d.fields);const first=form!.definition.fields.find(f=>d.fields[f.id]);const el=document.getElementById('field-'+first?.id);el?.scrollIntoView({behavior:'smooth',block:'center'});el?.querySelector<HTMLElement>('input,textarea,select,canvas')?.focus({preventScroll:true});}return;}
   try{sessionStorage.removeItem(key);}catch{}setAnswers({});setState('done');window.scrollTo(0,0);
  }catch{setMessage('Tidak dapat terhubung ke server. Isian Anda tetap tersimpan di halaman ini.');}finally{setBusy(false);}
 }
 async function login(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage('');const f=new FormData(e.currentTarget);
  try{const r=await fetch('/api/v2/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:f.get('username'),password:f.get('password')})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Login gagal');await load();}catch(err:any){setMessage(err.message);}finally{setBusy(false);}
 }
 const head=form&&<header className={s.sheetHead}><Logos/>{form.definition.header?.code&&<span className={s.code}>{form.definition.header.code}</span>}</header>;
 return <main className={s.page}><div className={s.sheet}>
  {state==='loading'&&<p role="status">Memuat form…</p>}
  {(state==='missing'||state==='error')&&<><Logos/><h1 className={s.title}>Form tidak tersedia</h1><p>{message||'Form belum dipublish, sudah ditutup, atau link tidak benar.'}</p>{state==='error'&&<div className={s.actions}><button className={w.secondary} onClick={load}>Coba lagi</button></div>}</>}
  {state==='login'&&<form className={s.fill} onSubmit={login}><Logos/><h1 className={s.title}>Login untuk mengisi form</h1><p>Form ini hanya dapat diisi oleh pengguna EDMS. Masuk dengan akun Anda.</p>{message&&<div role="alert" className={w.error}>{message}</div>}<label className={s.grow}>Username<input name="username" autoComplete="username" required/></label><label className={s.grow}>Password<input name="password" type="password" autoComplete="current-password" required/></label><div className={s.actions}><button className={w.primary} disabled={busy}>{busy?'Memproses…':'Masuk'}</button></div></form>}
  {state==='done'&&form&&<>{head}<h1 className={s.title}>Terima kasih</h1><p>Jawaban Anda untuk <strong>{form.title}</strong> sudah tersimpan.</p><div className={s.actions}><button className={w.primary} onClick={()=>setState('ready')}>Isi lagi</button></div></>}
  {state==='ready'&&form&&<form noValidate onSubmit={submit} className={s.fill}>{head}<div><h1 className={s.title}>{form.title}</h1>{form.definition.header?.subtitle&&<p>{form.definition.header.subtitle}</p>}{form.user&&<p className={s.code}>Mengisi sebagai {form.user.fullName}</p>}</div><FormFill definition={form.definition} answers={answers} onChange={change} errors={errors}/>{form.definition.header?.footer&&<p className={s.footerNote}>{form.definition.header.footer}</p>}{message&&<div role="alert" className={w.error}>{message}</div>}<div className={s.actions}>{stale?<button type="button" className={w.primary} onClick={load}>Muat ulang form</button>:<button className={w.primary} disabled={busy}>{busy?'Mengirim…':'Kirim jawaban'}</button>}</div></form>}
 </div></main>;
}
