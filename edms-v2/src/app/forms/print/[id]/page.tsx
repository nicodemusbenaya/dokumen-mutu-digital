'use client';
import {use} from 'react';
import {useResource} from '@/components/useResource';
import {FormFill,Definition,Answers} from '@/components/FormFill';
import s from '@/components/Forms.module.css';
import w from '../../../workspace.module.css';
type Sub={id:string;formTitle:string;formVersion:number;definition:Definition;answers:Answers;submitterLabel:string;flagged:boolean;flagNote:string|null;createdAt:string};
export default function PrintSubmission({params}:{params:Promise<{id:string}>}){
 const {id}=use(params),r=useResource<Sub>('form-submissions/'+id),d=r.data;
 return <main className={s.page}><div className={s.sheet}>
  {r.loading&&!d&&<p role="status">Memuat jawaban…</p>}
  {r.error&&<div role="alert" className={w.error}>{r.error}. Pastikan Anda sudah login di aplikasi EDMS dan berhak mengelola form ini.</div>}
  {d&&<>
   <header className={s.sheetHead}><div className={s.logos}><img src="/brand/danantara.svg" alt="Danantara"/><img src="/brand/pln.png" alt="PLN"/></div>{d.definition.header?.code&&<span className={s.code}>{d.definition.header.code}</span>}</header>
   <h1 className={s.title}>{d.formTitle}</h1>
   <div className={s.meta}><span>Dikirim: {new Date(d.createdAt.replace(' ','T')).toLocaleString('id-ID')}</span><span>Pengisi: {d.submitterLabel}</span><span>Versi form: {d.formVersion}</span><span>ID: {d.id}</span></div>
   <FormFill definition={d.definition} answers={d.answers} readOnly/>
   {d.definition.header?.footer&&<p className={s.footerNote}>{d.definition.header.footer}</p>}
   <div className={`${s.actions} ${s.noPrint}`}><button className={w.primary} onClick={()=>window.print()}>Cetak / Simpan PDF</button></div>
  </>}
 </div></main>;
}
