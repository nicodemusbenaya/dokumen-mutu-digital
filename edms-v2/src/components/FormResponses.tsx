'use client';
import {useState} from 'react';
import {useResource} from './useResource';
import {FormFill,Definition,Answers} from './FormFill';
import {call} from './forms-client';
import {IconArrowLeft,IconDownload} from './Icons';
import s from './Forms.module.css';
import w from '../app/workspace.module.css';
type Sub={id:string;formVersion:number;submitterLabel:string;flagged:boolean;flagNote:string|null;createdAt:string};
type SubDetail=Sub&{formTitle:string;definition:Definition;answers:Answers};
const when=(v:string)=>new Date(v.replace(' ','T')).toLocaleString('id-ID');
export function FormResponses({id,back}:{id:string;back:()=>void}){
 const [page,setPage]=useState(1),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const form=useResource<{title:string;submissions:number;publishedVersion:number|null}>('forms/'+id);
 const list=useResource<{total:number;page:number;submissions:Sub[]}>(`forms/${id}/submissions?page=${page}`);
 const detail=useResource<SubDetail>(selected?'form-submissions/'+selected:null);
 const total=list.data?.total||0,pages=Math.max(1,Math.ceil(total/30)),subs=list.data?.submissions||[];
 async function flag(sub:Sub){const note=sub.flagged?'':window.prompt('Catatan penandaan (opsional):','');if(note===null)return;setBusy(true);setError('');try{await call('form-submissions/'+sub.id,{method:'PATCH',body:JSON.stringify({flagged:!sub.flagged,flagNote:note})});list.reload();detail.reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function remove(sub:Sub){if(!window.confirm('Hapus jawaban ini? Jawaban tidak tampil lagi di daftar dan unduhan, tetapi tetap tercatat di histori.'))return;setBusy(true);setError('');try{await call('form-submissions/'+sub.id,{method:'DELETE'});setSelected(null);list.reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const d=detail.data;
 return <>
  <button className={w.back} onClick={back}><IconArrowLeft/>Kembali ke daftar form</button>
  <div className={w.pageHead}><div><h1>Jawaban: {form.data?.title||'…'}</h1><p>{total} jawaban masuk.</p></div><div className={s.exportActions}><a className={w.secondary} href={`/api/v2/forms/${id}/export`}><IconDownload/>Download Excel</a><a className={w.secondary} href={`/forms/print-all/${id}`} target="_blank" rel="noopener"><IconDownload/>Download PDF</a></div></div>
  {error&&<div role="alert" className={w.error}>{error}<button onClick={()=>setError('')}>Tutup</button></div>}
  <section className={w.panel}>{list.loading&&!list.data?<p role="status" className={w.empty}>Memuat jawaban…</p>:list.error?<div role="alert" className={w.error}>{list.error}<button onClick={list.reload}>Coba lagi</button></div>:!subs.length?<p className={w.empty}>Belum ada jawaban.{form.data&&!form.data.publishedVersion?' Publish form lalu bagikan link-nya.':''}</p>:<>
   <div className={w.tableScroll}><table><thead><tr><th>Waktu kirim</th><th>Pengisi</th><th>Versi</th><th>Tanda</th><th>Aksi</th></tr></thead><tbody>{subs.map(sub=><tr key={sub.id} aria-selected={selected===sub.id}><td>{when(sub.createdAt)}</td><td>{sub.submitterLabel}</td><td>{sub.formVersion}</td><td>{sub.flagged?<span className={s.status} title={sub.flagNote||''}>Ditandai</span>:'–'}</td><td><button className={w.textButton} onClick={()=>setSelected(sub.id)}>Lihat</button></td></tr>)}</tbody></table></div>
   {pages>1&&<div className={w.pagination}><button className={w.secondary} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Sebelumnya</button><span>Halaman {page} dari {pages}</span><button className={w.secondary} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Berikutnya</button></div>}
  </>}</section>
  {selected&&<section className={`${w.panel} ${s.detail}`} aria-label="Detail jawaban">{detail.loading&&!d?<p role="status">Memuat detail…</p>:detail.error?<div role="alert" className={w.error}>{detail.error}</div>:d&&<>
   <div className={w.sectionHead}><div><h2>Detail jawaban</h2><div className={s.meta}><span>{when(d.createdAt)}</span><span>{d.submitterLabel}</span><span>Versi form {d.formVersion}</span>{d.flagged&&<span>Ditandai{d.flagNote?': '+d.flagNote:''}</span>}</div></div><div className={s.actions}><button className={w.secondary} disabled={busy} onClick={()=>window.open('/forms/print/'+d.id,'_blank','noopener')}>Cetak / Simpan PDF</button><button className={w.secondary} disabled={busy} onClick={()=>flag(d)}>{d.flagged?'Hapus tanda':'Tandai'}</button><button className={w.secondary} disabled={busy} onClick={()=>remove(d)}>Hapus jawaban</button><button className={w.textButton} onClick={()=>setSelected(null)}>Tutup</button></div></div>
   <FormFill definition={d.definition} answers={d.answers} readOnly/>
  </>}</section>}
 </>;
}
