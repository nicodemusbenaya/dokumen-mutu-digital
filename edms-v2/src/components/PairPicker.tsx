'use client';
import {useState} from 'react';
import {useResource} from './useResource';
import s from '../app/workspace.module.css';

type Candidate={id:string;code:string;title:string;canEdit:boolean;activeVersion:number};
type Detail=Candidate&{status:string;lockVersion:number;versions:{number:number;revision:string;files:{id:string;extension:string;origin:string}[]}[]};
export function PairPicker({disabled=false}:{disabled?:boolean}){
 const [query,setQuery]=useState(''),[id,setId]=useState(''),[page,setPage]=useState(1);
 const results=useResource<{documents:Candidate[];pages:number}>(query.trim().length>=2?'documents?'+new URLSearchParams({search:query,page:String(page)}):null,250);
 const detail=useResource<Detail>(id?'documents/'+id:null);
 const selected=detail.data;
 const active=selected?.versions.find(v=>v.number===selected.activeVersion);
 const valid=!!selected&&selected.canEdit&&selected.status==='Aktif'&&!!active&&!detail.loading&&!detail.error;
 return <section className={s.pairPicker} aria-label="Pilih pasangan dokumen">
  <label>Cari pasangan berdasarkan kode atau judul<input value={query} disabled={disabled} placeholder="Ketik minimal 2 karakter" onChange={e=>{setQuery(e.target.value);setId('');setPage(1);}}/></label>
  {query.trim().length>=2&&<>
   {results.loading?<p role="status">Mencari dokumen pasangan…</p>:results.error?<p role="alert">{results.error} <button type="button" className={s.textButton} onClick={results.reload}>Coba lagi pencarian</button></p>:<>
    <ul className={s.pairResults}>{results.data?.documents.map(d=><li key={d.id}><button type="button" className={s.secondary} disabled={disabled||!d.canEdit} aria-pressed={id===d.id} onClick={()=>{if(id===d.id)detail.reload();else setId(d.id);}}>{d.code} — {d.title}{!d.canEdit?' (tidak memiliki izin update)':''}</button></li>)}</ul>
    {!results.data?.documents.length&&<p>Tidak ada pasangan yang cocok. Coba kode atau judul lain.</p>}
    {(results.data?.pages||0)>1&&<div className={s.actions}><button type="button" className={s.secondary} disabled={disabled||page<=1} onClick={()=>setPage(p=>p-1)}>Hasil sebelumnya</button><span>Halaman {page}</span><button type="button" className={s.secondary} disabled={disabled||page>=(results.data?.pages||0)} onClick={()=>setPage(p=>p+1)}>Hasil berikutnya</button></div>}
   </>}
  </>}
  {id&&<div className={s.callout}>
   {detail.loading?<p role="status">Memeriksa revisi dan format pasangan…</p>:detail.error?<p role="alert">{detail.error} <button type="button" className={s.textButton} onClick={detail.reload}>Coba lagi detail pasangan</button></p>:valid?<><strong>Pasangan dipilih: {selected!.code} — {selected!.title}</strong><p>Versi {selected!.activeVersion} · Revisi {active!.revision}</p><p>Format tersedia: {active!.files.map(f=>f.extension.toUpperCase()+(f.origin==='converted'?' (konversi)':' (asli)')).join(', ')||'Belum tersedia'}</p><p>Pastikan file yang diimpor berasal dari dokumen dan revisi yang sama.</p></>:<p role="alert">Dokumen ini tidak lagi dapat dipasangkan. Pilih dokumen aktif yang dapat Anda perbarui.</p>}
   <button type="button" className={s.textButton} disabled={disabled} onClick={()=>setId('')}>Batal pilih pasangan</button>
  </div>}
  <input type="hidden" name="documentId" value={valid?id:''}/>
  <input type="hidden" name="pairSelection" value={id?'pending':''}/>
  <input type="hidden" name="pairExpectedVersion" value={valid?selected!.activeVersion:''}/>
  <input type="hidden" name="pairExpectedLockVersion" value={valid?selected!.lockVersion:''}/>
  <input type="hidden" name="pairRevision" value={valid?active!.revision:''}/>
 </section>;
}
