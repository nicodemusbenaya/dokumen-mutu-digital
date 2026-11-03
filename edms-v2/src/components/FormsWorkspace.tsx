'use client';
import {useRef,useState,FormEvent} from 'react';
import {useResource} from './useResource';
import {FormBuilder} from './FormBuilder';
import {FormResponses} from './FormResponses';
import {call,formLink} from './forms-client';
import {IconPlus,IconFileText} from './Icons';
import s from './Forms.module.css';
import w from '../app/workspace.module.css';
type FormSummary={id:string;title:string;department:string|null;status:'draft'|'published'|'closed';access:'login'|'public';publicToken:string;publishedVersion:number|null;submissions:number;hasUnpublishedChanges:boolean;updatedAt:string};
const statusName={draft:'Draf',published:'Dipublish',closed:'Tidak dipublish'};
export function FormsWorkspace({user}:{user:{role:string}}){
 const list=useResource<{forms:FormSummary[]}>('forms');
 const [open,setOpen]=useState<{mode:'builder'|'responses';id:string;imported?:boolean}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const file=useRef<HTMLInputElement>(null);
 const close=()=>{setOpen(null);list.reload();};
 if(open?.mode==='builder')return <FormBuilder key={open.id} id={open.id} user={user} imported={open.imported} back={close}/>;
 if(open?.mode==='responses')return <FormResponses key={open.id} id={open.id} back={close}/>;
 async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();const title=String(new FormData(e.currentTarget).get('title')||'').trim();if(!title)return;setBusy(true);setError('');try{const d=await call('forms',{method:'POST',body:JSON.stringify({title})});setOpen({mode:'builder',id:d.id});}catch(err:any){setError(err.message);}finally{setBusy(false);}}
 async function importWord(f:File){if(!/\.docx$/i.test(f.name)){setError('Pilih file Word berformat .docx.');return;}if(f.size>5*1024*1024){setError('Ukuran file Word maksimal 5 MB.');return;}setBusy(true);setError('');try{const draft=await call('forms/import',{method:'POST',body:f,headers:{'Content-Type':'application/octet-stream'}});const d=await call('forms',{method:'POST',body:JSON.stringify(draft)});setOpen({mode:'builder',id:d.id,imported:true});}catch(err:any){setError(err.message);}finally{setBusy(false);if(file.current)file.current.value='';}}
 async function copy(token:string){const link=formLink(token);try{await navigator.clipboard.writeText(link);setNotice('Link disalin: '+link);}catch{window.prompt('Salin link form ini:',link);}}
 const forms=list.data?.forms||[];
 return <>
  <div className={w.pageHead}><div><h1>Form</h1><p>Buat form, bagikan link, dan kelola jawaban yang masuk.</p></div><div className={s.actions}><button className={w.secondary} disabled={busy} onClick={()=>file.current?.click()}><IconFileText/>Impor dari Word</button><input ref={file} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importWord(f);}}/></div></div>
  {error&&<div role="alert" className={w.error}>{error}<button onClick={()=>setError('')}>Tutup</button></div>}
  {notice&&<div role="status" className={w.notice}>{notice}<button onClick={()=>setNotice('')}>Tutup</button></div>}
  <section className={w.panel}><form className={s.actions} onSubmit={create}><label className={s.grow}>Judul form baru<input name="title" required maxLength={255}/></label><button className={w.primary} disabled={busy}><IconPlus/>Buat form</button></form></section>
  <section className={w.panel}>{list.loading&&!list.data?<p role="status" className={w.empty}>Memuat form…</p>:list.error?<div role="alert" className={w.error}>{list.error}<button onClick={list.reload}>Coba lagi</button></div>:!forms.length?<p className={w.empty}>Belum ada form. Buat form baru atau impor dari Word.</p>:<div className={w.tableScroll}><table><thead><tr><th>Judul</th><th>Status</th><th>Bidang</th><th>Akses</th><th>Jawaban</th><th>Aksi</th></tr></thead><tbody>{forms.map(f=><tr key={f.id}><td><strong>{f.title}</strong>{f.hasUnpublishedChanges&&<div className={s.code}>Ada perubahan belum dipublish</div>}</td><td><span className={s.status}>{statusName[f.status]}</span></td><td>{f.department||'Belum ada bidang'}</td><td>{f.access==='public'?'Tanpa login':'Wajib login'}</td><td>{f.submissions}</td><td><div className={s.actions}><button className={w.textButton} onClick={()=>setOpen({mode:'builder',id:f.id})}>Edit</button><button className={w.textButton} onClick={()=>setOpen({mode:'responses',id:f.id})}>Jawaban</button>{f.status==='published'&&<button className={w.textButton} onClick={()=>copy(f.publicToken)}>Salin link</button>}</div></td></tr>)}</tbody></table></div>}</section>
 </>;
}
