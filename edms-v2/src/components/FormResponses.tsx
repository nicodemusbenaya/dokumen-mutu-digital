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
 const form=useResource<{title:string;status:string;submissions:number;publishedVersion:number|null}>('forms/'+id);
 const list=useResource<{total:number;page:number;submissions:Sub[]}>(`forms/${id}/submissions?page=${page}`);
 const detail=useResource<SubDetail>(selected?'form-submissions/'+selected:null);
 const total=list.data?.total||0,pages=Math.max(1,Math.ceil(total/30)),subs=list.data?.submissions||[];
 async function flag(sub:Sub){const note=sub.flagged?'':window.prompt('Catatan penandaan (opsional):','');if(note===null)return;setBusy(true);setError('');try{await call('form-submissions/'+sub.id,{method:'PATCH',body:JSON.stringify({flagged:!sub.flagged,flagNote:note})});list.reload();detail.reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function remove(sub:Sub){if(!window.confirm('Hapus jawaban ini? Jawaban tidak tampil lagi di daftar dan unduhan, tetapi tetap tercatat di histori.'))return;setBusy(true);setError('');try{await call('form-submissions/'+sub.id,{method:'DELETE'});setSelected(null);list.reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const d=detail.data,[notice,setNotice]=useState('');
 return <>
  <button className={w.back} onClick={back}><IconArrowLeft/>Kembali ke daftar form</button>
  <div className={w.pageHead}><div><h1>Jawaban: {form.data?.title||'…'}</h1><p>{total} jawaban masuk.</p></div><div className={s.exportActions}><a className={w.secondary} href={`/api/v2/forms/${id}/export`}><IconDownload/>Download Excel</a><a className={w.secondary} href={`/forms/print-all/${id}`} target="_blank" rel="noopener"><IconDownload/>Download PDF</a></div></div>
  {error&&<div role="alert" className={w.error}>{error}<button onClick={()=>setError('')}>Tutup</button></div>}
  {notice&&<div role="status" className={w.notice}>{notice}<button onClick={()=>setNotice('')}>Tutup</button></div>}
  <section className={w.panel}>{list.loading&&!list.data?<p role="status" className={w.empty}>Memuat jawaban…</p>:list.error?<div role="alert" className={w.error}>{list.error}<button onClick={list.reload}>Coba lagi</button></div>:!subs.length?<p className={w.empty}>Belum ada jawaban.{form.data&&!form.data.publishedVersion?' Publish form lalu bagikan link-nya.':''}</p>:<>
   <div className={w.tableScroll}><table><thead><tr><th>Waktu kirim</th><th>Pengisi</th><th>Versi</th><th>Tanda</th><th>Aksi</th></tr></thead><tbody>{subs.map(sub=><tr key={sub.id} aria-selected={selected===sub.id}><td>{when(sub.createdAt)}</td><td>{sub.submitterLabel}</td><td>{sub.formVersion}</td><td>{sub.flagged?<span className={s.status} title={sub.flagNote||''}>Ditandai</span>:'–'}</td><td><button className={w.textButton} onClick={()=>setSelected(sub.id)}>Lihat</button></td></tr>)}</tbody></table></div>
   {pages>1&&<div className={w.pagination}><button className={w.secondary} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Sebelumnya</button><span>Halaman {page} dari {pages}</span><button className={w.secondary} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Berikutnya</button></div>}
  </>}</section>
  {form.data&&<PurgePanel id={id} published={form.data.status==='published'} done={n=>{setNotice(n+' jawaban dihapus permanen.');setSelected(null);setPage(1);list.reload();form.reload();}} onError={setError}/>}
  {selected&&<section className={`${w.panel} ${s.detail}`} aria-label="Detail jawaban">{detail.loading&&!d?<p role="status">Memuat detail…</p>:detail.error?<div role="alert" className={w.error}>{detail.error}</div>:d&&<>
   <div className={w.sectionHead}><div><h2>Detail jawaban</h2><div className={s.meta}><span>{when(d.createdAt)}</span><span>{d.submitterLabel}</span><span>Versi form {d.formVersion}</span>{d.flagged&&<span>Ditandai{d.flagNote?': '+d.flagNote:''}</span>}</div></div><div className={s.actions}><button className={w.secondary} disabled={busy} onClick={()=>window.open('/forms/print/'+d.id,'_blank','noopener')}>Cetak / Simpan PDF</button><button className={w.secondary} disabled={busy} onClick={()=>flag(d)}>{d.flagged?'Hapus tanda':'Tandai'}</button><button className={w.secondary} disabled={busy} onClick={()=>remove(d)}>Hapus jawaban</button><button className={w.textButton} onClick={()=>setSelected(null)}>Tutup</button></div></div>
   <FormFill definition={d.definition} answers={d.answers} readOnly/>
  </>}</section>}
 </>;
}

function PurgePanel({id,published,done,onError}:{id:string;published:boolean;done:(n:number)=>void;onError:(m:string)=>void}){
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[count,setCount]=useState<number|null>(null),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false);
 const reset=()=>{setCount(null);setConfirm('');};
 const range={from:from||undefined,to:to||undefined};
 async function check(){setBusy(true);onError('');try{const r=await call('forms/'+id+'/purge',{method:'POST',body:JSON.stringify({...range,dryRun:true})});setCount(r.count);}catch(e:any){onError(e.message);}finally{setBusy(false);}}
 async function purge(){setBusy(true);onError('');try{const r=await call('forms/'+id+'/purge',{method:'POST',body:JSON.stringify({...range,confirm})});reset();done(r.deleted);}catch(e:any){onError(e.message);}finally{setBusy(false);}}
 const period=from||to?`${from||'awal'} s.d. ${to||'hari ini'}`:'semua periode';
 return <section className={`${w.panel} ${s.purge}`} aria-labelledby="purge-title">
  <h2 id="purge-title">Hapus permanen jawaban</h2>
  <p className={w.muted}>Untuk mengosongkan jawaban satu periode yang sudah selesai. Jawaban yang terhapus tidak bisa dikembalikan dari aplikasi, termasuk tanda tangannya. Download Excel/PDF dulu bila masih dibutuhkan sebagai arsip.</p>
  {published?<p className={w.callout}>Form masih dipublish. Unpublish form terlebih dahulu (Edit → Unpublish) agar tidak ada jawaban baru yang ikut terhapus.</p>:<>
   <div className={s.purgeRow}>
    <label>Dari tanggal<input type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);reset();}}/></label>
    <label>Sampai tanggal<input type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);reset();}}/></label>
    <button className={w.secondary} disabled={busy} onClick={check}>Cek jumlah</button>
   </div>
   <p className={w.muted}>Kosongkan tanggal untuk memilih semua jawaban form ini.</p>
   {count!==null&&(count===0?<p role="status">Tidak ada jawaban pada {period}.</p>:<div className={s.purgeConfirm} role="group" aria-label="Konfirmasi hapus permanen">
    <p role="status"><strong>{count} jawaban</strong> pada {period} akan dihapus permanen, termasuk yang sebelumnya disembunyikan.</p>
    <label>Ketik <strong>HAPUS</strong> untuk konfirmasi<input type="text" value={confirm} autoComplete="off" onChange={e=>setConfirm(e.target.value)}/></label>
    <button className={`${w.primary} ${s.danger}`} disabled={busy||confirm!=='HAPUS'} onClick={purge}>Hapus permanen {count} jawaban</button>
   </div>)}
  </>}
 </section>;
}
