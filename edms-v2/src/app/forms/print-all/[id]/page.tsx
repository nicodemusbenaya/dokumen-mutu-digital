'use client';
import {use,useEffect} from 'react';
import {useResource} from '@/components/useResource';
import {FormFill,Definition,Answers} from '@/components/FormFill';
import s from '@/components/Forms.module.css';
import w from '../../../workspace.module.css';
type Sub={id:string;formVersion:number;definition:Definition;answers:Answers;submitterLabel:string;createdAt:string};
export default function PrintAllSubmissions({params}:{params:Promise<{id:string}>}){
 const {id}=use(params),r=useResource<{title:string;submissions:Sub[]}>('forms/'+id+'/print'),d=r.data;
 // Dialog cetak dibuka otomatis; pilih "Simpan sebagai PDF" sebagai printer.
 useEffect(()=>{if(d?.submissions.length){const t=setTimeout(()=>window.print(),600);return ()=>clearTimeout(t);}},[d]);
 return <main className={s.page}>
  {r.loading&&!d&&<p role="status">Memuat jawaban…</p>}
  {r.error&&<div role="alert" className={w.error}>{r.error}. Pastikan Anda sudah login di aplikasi EDMS dan berhak mengelola form ini.</div>}
  {d&&!d.submissions.length&&<p className={w.empty}>Belum ada jawaban.</p>}
  {d&&d.submissions.length>0&&<div className={`${s.actions} ${s.noPrint} ${s.printBar}`}><span>{d.submissions.length} jawaban siap dicetak.</span><button className={w.primary} onClick={()=>window.print()}>Simpan PDF</button></div>}
  {d?.submissions.map((x,i)=><div key={x.id} className={`${s.sheet} ${s.printSheet}`}>
   <header className={s.sheetHead}><div className={s.logos}><img src="/brand/danantara.svg" alt="Danantara"/><img src="/brand/pln.png" alt="PLN"/></div><span className={s.code}>{x.definition.header?.code||''} · Jawaban {i+1} dari {d.submissions.length}</span></header>
   <h1 className={s.title}>{d.title}</h1>
   <div className={s.meta}><span>Dikirim: {new Date(x.createdAt.replace(' ','T')).toLocaleString('id-ID')}</span><span>Pengisi: {x.submitterLabel}</span><span>Versi form: {x.formVersion}</span><span>ID: {x.id}</span></div>
   <FormFill definition={x.definition} answers={x.answers} readOnly/>
   {x.definition.header?.footer&&<p className={s.footerNote}>{x.definition.header.footer}</p>}
  </div>)}
 </main>;
}
