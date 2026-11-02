'use client';
import {useState,FormEvent} from 'react';
import {useResource} from './useResource';
import s from './Management.module.css';
import w from '../app/workspace.module.css';
export type MasterValue={id:string;type:string;value:string;label:string;isActive:number;lockVersion:number};
const names:Record<string,string>={category:'Kategori / folder',department:'Bidang',kind:'Jenis dokumen'};
export function MasterManager({changed}:{changed:()=>void}){
 const resource=useResource<{values:MasterValue[]}>('masters');
 const [type,setType]=useState('category'),[editing,setEditing]=useState<MasterValue|null>(null),[form,setForm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  const values=Object.fromEntries(new FormData(e.currentTarget));
  try{const r=await fetch('/api/v2/masters'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,type,isActive:values.isActive==='1',lockVersion:editing?.lockVersion})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Master gagal disimpan');setForm(false);setNotice('Master tersimpan. Pilihan upload telah diperbarui.');resource.reload();changed();}catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 return <><div className={w.pageHead}><div><h1>Kelola master</h1><p>Atur pilihan kategori/folder, bidang, dan jenis dokumen. Master yang dinonaktifkan tidak dapat dipilih untuk upload baru.</p></div><button className={w.primary} disabled={busy} onClick={()=>{setEditing(null);setForm(true);setError('');setNotice('');}}>Tambah master</button></div>
  <label className={s.method}>Kelompok master<select value={type} disabled={busy} onChange={e=>{setType(e.target.value);setForm(false);setEditing(null);setError('');setNotice('');}}>{Object.entries(names).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  {(error||resource.error)&&<p role="alert" className={w.error}>{error||resource.error}<button onClick={resource.reload}>Muat ulang master</button></p>}{notice&&<p role="status" className={w.notice}>{notice}</p>}
  {form&&<section className={w.panel}><h2>{editing?'Edit':'Tambah'} {names[type]}</h2><form className={w.form} onSubmit={save} key={editing?.id||type}>
   <label>Nilai {type==='category'?'kategori / path folder':'master'}<input name="value" required maxLength={type==='category'?500:80} defaultValue={editing?.value} readOnly={!!editing} placeholder={type==='category'?'Contoh: Sistem Mutu/Prosedur':undefined}/><small>Nilai disimpan pada dokumen. Setelah dibuat, nilai tetap agar referensi dokumen dan histori terjaga.</small></label>
   <label>Nama tampilan<input name="label" required maxLength={type==='category'?500:80} defaultValue={editing?.label}/><small>Nama yang terlihat pada dropdown dapat diubah.</small></label>
   <label>Status<select name="isActive" defaultValue={editing&&!editing.isActive?'0':'1'}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></label>
   <div className={w.actions}><button className={w.primary} disabled={busy}>{busy?'Menyimpan…':'Simpan master'}</button><button type="button" className={w.secondary} disabled={busy} onClick={()=>setForm(false)}>Batal</button></div>
  </form></section>}
  <section className={w.panel}>{resource.loading?<p role="status">Memuat master…</p>:!resource.error&&<>{!resource.data?.values.some(v=>v.type===type)?<p className={w.empty}>Belum ada {names[type].toLowerCase()}. Tambahkan master untuk menyediakan pilihan upload.</p>:<div className={s.tableWrap}><table><thead><tr><th>Nama tampilan</th><th>Nilai tersimpan</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>{resource.data?.values.filter(v=>v.type===type).map(v=><tr key={v.id}><td>{v.label}</td><td>{v.value}</td><td>{v.isActive?'Aktif':'Nonaktif'}</td><td><button className={w.secondary} disabled={busy} onClick={()=>{setEditing(v);setForm(true);setError('');}}>Edit master</button></td></tr>)}</tbody></table></div>}</>}</section>
 </>;
}
