'use client';
import {useEffect,useRef,useState,FormEvent} from 'react';
import {useResource} from './useResource';
import {IconArrowLeft,IconDownload,IconFileText,IconPlus,IconRefresh,IconTemplate} from './Icons';
import s from './Forms.module.css';
import w from '../app/workspace.module.css';
type ZohoForm={slug:string;title:string;zohoUrl:string|null;entries:number;lastAt:string|null;hasKey:boolean;webhookKey?:string|null};
type Entry={id:string;receivedAt:string;source:'webhook'|'import';payload:Record<string,unknown>};
const REFRESH_MS=10000;
const when=(v:string|null)=>v?new Date(v.replace(' ','T')).toLocaleString('id-ID'):'–';
const cell=(v:unknown):string=>v==null?'':Array.isArray(v)?v.map(cell).filter(Boolean).join('; '):typeof v==='object'?Object.entries(v as object).map(([k,x])=>k+': '+cell(x)).join(', '):String(v);
// Alamat publik webhook lewat Tailscale Funnel (hanya jalur /api/v2/zoho-webhook yang dibuka ke internet).
// ponytail: nama host tetap di kode; ubah di sini bila perangkat Tailscale NAS diganti (lihat docs/FORM_ZOHO_WEBHOOK.md).
const PUBLIC_WEBHOOK_ORIGIN='https://nasups01.tail10ea24.ts.net';
const webhookUrl=(slug:string,key:string)=>`${PUBLIC_WEBHOOK_ORIGIN}/api/v2/zoho-webhook/${slug}?key=${key}`;
async function send(path:string,method:string,body?:unknown){const r=await fetch('/api/v2/'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Permintaan gagal');return d;}

// Entri tampil hampir real time: data dimuat ulang tiap 10 detik selama halaman terbuka.
function useAutoReload(reload:()=>void){useEffect(()=>{const t=setInterval(()=>{if(document.visibilityState==='visible')reload();},REFRESH_MS);return()=>clearInterval(t);},[reload]);}

export function FormsWorkspace({user}:{user:{role:string}}){
 const list=useResource<{forms:ZohoForm[]}>('zoho-forms');
 const [open,setOpen]=useState<string|null>(null);
 useAutoReload(list.reload);
 if(open)return <Entries key={open} slug={open} admin={user.role==='Super user'} back={()=>{setOpen(null);list.reload();}}/>;
 const forms=list.data?.forms||[];
 return <>
  <div className={w.pageHead}><div><h1>Form</h1><p>Form diisi di Zoho Forms. Setiap entri baru otomatis masuk ke sini dalam hitungan detik.</p></div></div>
  <section className={w.panel}>{list.loading&&!list.data?<p role="status" className={w.empty}>Memuat form…</p>:list.error?<div role="alert" className={w.error}>{list.error}<button onClick={list.reload}>Coba lagi</button></div>:!forms.length?<p className={w.empty}>Belum ada form Zoho yang terdaftar.</p>:
   <div className={w.tableScroll}><table><thead><tr><th>Form</th><th>Entri</th><th>Entri terakhir</th><th>Aksi</th></tr></thead><tbody>{forms.map(f=><tr key={f.slug}><td><IconTemplate size={16}/> {f.title}{!f.hasKey&&<span className={w.badge}> Webhook belum aktif</span>}</td><td>{f.entries}</td><td>{when(f.lastAt)}</td><td><button className={w.textButton} onClick={()=>setOpen(f.slug)}>Lihat entri</button>{f.zohoUrl&&<> · <a className={w.textButton} href={f.zohoUrl} target="_blank" rel="noopener noreferrer">Buka di Zoho</a></>}</td></tr>)}</tbody></table></div>}
  </section>
  {user.role==='Super user'&&list.data&&<WebhookPanel forms={forms} changed={list.reload}/>}
 </>;
}

function Entries({slug,admin,back}:{slug:string;admin:boolean;back:()=>void}){
 const [page,setPage]=useState(1),[selected,setSelected]=useState<Entry|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const file=useRef<HTMLInputElement>(null);
 const list=useResource<{title:string;zohoUrl:string|null;total:number;entries:Entry[]}>(`zoho-forms/${slug}/entries?page=${page}`);
 useAutoReload(list.reload);
 async function importCsv(f:File){
  if(!/.csv$/i.test(f.name)){setError('Pilih file CSV hasil Export dari Zoho (All Entries → Export → CSV).');return;}
  if(!window.confirm('Impor jawaban dari "'+f.name+'" ke form ini? Pastikan file berasal dari form yang sama di Zoho. Jawaban yang sudah ada tidak digandakan.'))return;
  setBusy(true);setError('');setNotice('');
  try{const r=await fetch(`/api/v2/zoho-forms/${slug}/import`,{method:'POST',headers:{'Content-Type':'text/csv'},body:f});const res=await r.json();if(!r.ok)throw new Error(res.error||'Impor gagal');setNotice(`${res.inserted} jawaban diimpor dari ${res.total} baris${res.skipped?`, ${res.skipped} dilewati karena sudah ada`:''}.`);setPage(1);list.reload();}
  catch(err:any){setError(err.message);}finally{setBusy(false);if(file.current)file.current.value='';}
 }
 async function removeEntry(e:Entry){
  if(!window.confirm('Hapus permanen entri ini dari EDMS? Data di Zoho tidak ikut terhapus.'))return;
  setBusy(true);setError('');
  try{await send(`zoho-forms/${slug}/entries/${e.id}`,'DELETE');setSelected(null);setNotice('Entri dihapus.');list.reload();}catch(err:any){setError(err.message);}finally{setBusy(false);}
 }
 const d=list.data,entries=d?.entries||[],pages=Math.max(1,Math.ceil((d?.total||0)/50));
 // Semua kolom form tampil sesuai urutan field kiriman Zoho (per form, tidak digabung); geser tabel ke samping bila lebar.
 const cols=[...new Set(entries.flatMap(e=>Object.keys(e.payload)))];
 return <>
  <button className={w.back} onClick={back}><IconArrowLeft/>Kembali ke daftar form</button>
  <div className={w.pageHead}><div><h1>{d?.title||'Entri form'}</h1><p>{d?d.total+' entri. Diperbarui otomatis tiap 10 detik.':'…'}</p></div><div className={s.exportActions}><button className={w.secondary} onClick={list.reload}><IconRefresh/>Muat ulang</button><a className={w.secondary} href={`/api/v2/zoho-forms/${slug}/export`}><IconDownload/>Download Excel</a>{admin&&<><button className={w.secondary} disabled={busy} onClick={()=>file.current?.click()}><IconFileText/>{busy?'Mengimpor…':'Impor entri lama (CSV Zoho)'}</button><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importCsv(f);}}/></>}</div></div>
  {error&&<div role="alert" className={w.error}>{error}<button onClick={()=>setError('')}>Tutup</button></div>}
  {notice&&<div role="status" className={w.notice}>{notice}<button onClick={()=>setNotice('')}>Tutup</button></div>}
  <section className={w.panel}>{list.loading&&!d?<p role="status" className={w.empty}>Memuat entri…</p>:list.error?<div role="alert" className={w.error}>{list.error}<button onClick={list.reload}>Coba lagi</button></div>:!entries.length?<p className={w.empty}>Belum ada entri. Entri muncul di sini setelah ada yang mengisi form di Zoho.</p>:<>
   <div className={w.tableScroll}><table><thead><tr><th>Aksi</th><th>Waktu</th>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{entries.map(e=><tr key={e.id} aria-selected={selected?.id===e.id}><td><button className={w.textButton} onClick={()=>setSelected(e)}>Lihat</button></td><td className={s.nowrap}>{when(e.receivedAt)}</td>{cols.map(c=>{const v=cell(e.payload[c]);return <td key={c} className={s.entryCell} title={v.length>60?v:undefined}>{v.length>60?v.slice(0,60)+'…':v}</td>;})}</tr>)}</tbody></table></div>
   {pages>1&&<div className={w.pagination}><button className={w.secondary} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Sebelumnya</button><span>Halaman {page} dari {pages}</span><button className={w.secondary} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Berikutnya</button></div>}
  </>}</section>
  {admin&&d&&<PurgePanel slug={slug} done={n=>{setNotice(n+' entri dihapus permanen.');setSelected(null);setPage(1);list.reload();}} onError={setError}/>}
  {selected&&<section className={`${w.panel} ${s.detail}`} aria-label="Detail entri" data-print-entry>
   <div className={w.sectionHead}><div><h2>Detail entri</h2><p className={w.muted}>{when(selected.receivedAt)} · {selected.source==='import'?'Impor CSV Zoho':'Webhook Zoho'}</p></div><div className={s.actions}><button className={w.secondary} onClick={printEntry}>Cetak / Simpan PDF</button>{admin&&<button className={w.secondary} disabled={busy} onClick={()=>removeEntry(selected)}>Hapus entri</button>}<button className={w.textButton} onClick={()=>setSelected(null)}>Tutup</button></div></div>
   <dl className={s.entry}>{Object.entries(selected.payload).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{cell(v)||'–'}</dd></div>)}</dl>
  </section>}
 </>;
}

function PurgePanel({slug,done,onError}:{slug:string;done:(n:number)=>void;onError:(m:string)=>void}){
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[count,setCount]=useState<number|null>(null),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false);
 const reset=()=>{setCount(null);setConfirm('');};
 async function check(){setBusy(true);try{const d=await send(`zoho-forms/${slug}/purge`,'POST',{from,to,dryRun:true});setCount(d.count);}catch(e:any){onError(e.message);}finally{setBusy(false);}}
 async function purge(){setBusy(true);try{const d=await send(`zoho-forms/${slug}/purge`,'POST',{from,to,confirm});reset();done(d.deleted);}catch(e:any){onError(e.message);}finally{setBusy(false);}}
 return <section className={w.panel} aria-label="Hapus entri per periode">
  <div className={w.sectionHead}><div><h2>Hapus entri per periode (Super user)</h2><p className={w.muted}>Untuk form yang periodenya sudah selesai. Penghapusan permanen dari EDMS dan tercatat di Histori Aktivitas. Kosongkan kedua tanggal untuk semua entri. Data di Zoho tidak ikut terhapus.</p></div></div>
  <div className={s.purgeRow}><label>Dari tanggal<input type="date" value={from} onChange={e=>{setFrom(e.target.value);reset();}}/></label><label>Sampai tanggal<input type="date" value={to} onChange={e=>{setTo(e.target.value);reset();}}/></label><button className={w.secondary} disabled={busy} onClick={check}>Cek jumlah</button></div>
  {count!==null&&(count===0?<p className={w.muted}>Tidak ada entri pada periode ini.</p>:<div className={s.purgeRow}><label>Ketik HAPUS untuk menghapus {count} entri<input value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off"/></label><button className={w.secondary} disabled={busy||confirm!=='HAPUS'} onClick={purge}>Hapus permanen</button></div>)}
 </section>;
}

function printEntry(){document.body.classList.add('print-entry');addEventListener('afterprint',()=>document.body.classList.remove('print-entry'),{once:true});window.print();}

function WebhookPanel({forms,changed}:{forms:ZohoForm[];changed:()=>void}){
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function makeKey(f:ZohoForm){
  if(f.hasKey&&!window.confirm('Buat kunci baru untuk "'+f.title+'"? URL webhook lama di Zoho langsung berhenti bekerja dan harus diganti.'))return;
  setBusy(f.slug);setError('');
  try{const r=await fetch(`/api/v2/zoho-forms/${f.slug}/key`,{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Gagal membuat kunci');changed();setNotice('Kunci baru dibuat. Salin URL webhook ke Zoho.');}catch(e:any){setError(e.message);}finally{setBusy('');}
 }
 async function add(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const el=e.currentTarget,data=new FormData(el);setBusy('new');setError('');
  try{const r=await fetch('/api/v2/zoho-forms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:data.get('title'),zohoUrl:data.get('zohoUrl')})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Gagal menambah form');el.reset();changed();setNotice('Form ditambahkan. Salin URL webhook-nya lalu pasang di Zoho.');}catch(err:any){setError(err.message);}finally{setBusy('');}
 }
 async function removeForm(f:ZohoForm){
  const typed=window.prompt('Hapus form "'+f.title+'" beserta '+f.entries+' entrinya secara permanen dari EDMS?\nMatikan juga webhook form ini di Zoho.\n\nKetik HAPUS untuk melanjutkan:');
  if(typed===null)return;
  setBusy(f.slug);setError('');
  try{const d=await send('zoho-forms/'+f.slug,'DELETE',{confirm:typed.trim()});changed();setNotice('Form dihapus beserta '+d.deleted+' entri. Jangan lupa matikan webhook-nya di Zoho.');}catch(e:any){setError(e.message);}finally{setBusy('');}
 }
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('URL webhook disalin.');}catch{window.prompt('Salin URL webhook ini:',text);}}
 return <section className={w.panel} aria-label="Pengaturan webhook">
  <div className={w.sectionHead}><div><h2>Kelola form &amp; webhook Zoho (Super user)</h2><p className={w.muted}>Tempel URL ini di Zoho Forms → Integrations → Webhooks. Rahasiakan URL ini. Form yang periodenya selesai dapat dihapus beserta entrinya.</p></div></div>
  {error&&<div role="alert" className={w.error}>{error}<button onClick={()=>setError('')}>Tutup</button></div>}
  {notice&&<div role="status" className={w.notice}>{notice}<button onClick={()=>setNotice('')}>Tutup</button></div>}
  <form className={s.addForm} onSubmit={add}><label>Judul form<input name="title" required maxLength={255} placeholder="Sama seperti judul di Zoho"/></label><label>Link form Zoho (opsional)<input name="zohoUrl" type="url" maxLength={500} placeholder="https://forms.zoho.com/plnups/form/..."/></label><button className={w.primary} disabled={busy==='new'}><IconPlus/>Tambah form</button></form>
  <div className={w.tableScroll}><table><thead><tr><th>Form</th><th>URL webhook</th><th>Aksi</th></tr></thead><tbody>{forms.map(f=><tr key={f.slug}><td>{f.title}</td><td>{f.webhookKey?<code className={s.code}>{webhookUrl(f.slug,f.webhookKey)}</code>:'Belum ada kunci'}</td><td>{f.webhookKey&&<><button className={w.textButton} onClick={()=>copy(webhookUrl(f.slug,f.webhookKey!))}>Salin</button> · </>}<button className={w.textButton} disabled={busy===f.slug} onClick={()=>makeKey(f)}>{f.webhookKey?'Ganti kunci':'Buat kunci'}</button> · <button className={w.textButton} disabled={busy===f.slug} onClick={()=>removeForm(f)}>Hapus form</button></td></tr>)}</tbody></table></div>
 </section>;
}
