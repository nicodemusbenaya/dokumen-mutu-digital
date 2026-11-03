'use client';
import {Fragment} from 'react';
import {SignaturePad} from './SignaturePad';
import {isVisible} from '@/lib/form-logic.mjs';
import s from './Forms.module.css';
import w from '../app/workspace.module.css';
export type Row={id:string;cells:string[];blank?:boolean;no?:string};
export type Column={id:string;label:string;type?:'text'|'date'|'time'|'radio';options?:string[];required?:boolean};
export type FieldType='heading'|'static'|'text'|'textarea'|'date'|'time'|'radio'|'checkbox'|'grid'|'table'|'signature';
export type Field={id:string;type:FieldType;label?:string;text?:string;description?:string;required?:boolean;placeholder?:string;format?:'email'|'number';showIf?:{field:string;anyOf:string[]};range?:boolean;options?:string[];other?:boolean;fixedColumns?:string[];groups?:{title?:string;rows:Row[]}[];choice?:{label:string;options:string[]};remark?:string;columns?:Column[];minRows?:number;maxRows?:number};
export type Definition={schema:1;header?:{code?:string;subtitle?:string;footer?:string};fields:Field[]};
export type Answers=Record<string,any>;
export const OTHER='__other';
type P={f:Field;v:any;set:(v:any)=>void;error?:string;readOnly:boolean};

export function FormFill({definition,answers,onChange,errors={},readOnly=false}:{definition:Definition;answers:Answers;onChange?:(next:Answers)=>void;errors?:Record<string,string>;readOnly?:boolean}){
 const view=(f:Field)=><FieldView key={f.id} f={f} v={answers[f.id]} set={v=>onChange?.({...answers,[f.id]:v})} error={errors[f.id]} readOnly={readOnly}/>;
 const chunks:Field[][]=[];
 for(const f of definition.fields.filter(f=>isVisible(f,definition,answers))){const last=chunks.at(-1);if(f.type==='signature'&&last?.[0].type==='signature')last.push(f);else chunks.push([f]);}
 return <div className={s.fill}>{chunks.map(c=>c[0].type==='signature'?<div key={c[0].id} className={s.signatures}>{c.map(view)}</div>:view(c[0]))}</div>;
}
function StaticText({text}:{text:string}){
 const blocks:(string|string[])[]=[];
 for(const line of text.split('\n')){if(line.startsWith('- ')){const last=blocks.at(-1);if(Array.isArray(last))last.push(line.slice(2));else blocks.push([line.slice(2)]);}else if(line.trim())blocks.push(line);}
 return <div className={s.static}>{blocks.map((b,i)=>Array.isArray(b)?<ul key={i}>{b.map((x,j)=><li key={j}>{x}</li>)}</ul>:<p key={i}>{b}</p>)}</div>;
}
function FieldView(p:P){
 const {f,error}=p;
 if(f.type==='heading')return <h2 className={s.heading}>{f.label}{f.description&&<span>{f.description}</span>}</h2>;
 if(f.type==='static')return <StaticText text={f.text||''}/>;
 const single=f.type==='text'||f.type==='textarea'||f.type==='date'||f.type==='time'&&!f.range;
 const title=<>{f.label}{f.required&&<span className={s.req} aria-hidden="true">*</span>}</>;
 const help=f.description&&<span className={s.help}>{f.description}</span>;
 const err=error&&<span id={'err-'+f.id} className={s.errorText} role="alert">{error}</span>;
 const cls=`${s.field} ${error?s.invalid:''}`;
 return single?<div id={'field-'+f.id} className={cls}><label htmlFor={'q-'+f.id}>{title}</label>{help}<Input {...p}/>{err}</div>
  :<fieldset id={'field-'+f.id} className={cls} aria-describedby={error?'err-'+f.id:undefined}><legend>{title}</legend>{help}<Input {...p}/>{err}</fieldset>;
}
function Input({f,v,set,error,readOnly}:P){
 const common={id:'q-'+f.id,disabled:readOnly,'aria-invalid':error?true:undefined,'aria-required':f.required||undefined,'aria-describedby':error?'err-'+f.id:undefined};
 switch(f.type){
  case 'text':return <input type={f.format==='email'?'email':'text'} inputMode={f.format==='number'?'decimal':undefined} {...common} value={v||''} placeholder={f.placeholder} maxLength={500} onChange={e=>set(e.target.value)}/>;
  case 'textarea':return <textarea {...common} value={v||''} maxLength={10000} onChange={e=>set(e.target.value)}/>;
  case 'date':return <input type="date" {...common} value={v||''} onChange={e=>set(e.target.value)}/>;
  case 'time':return f.range?<div className={s.range}><input type="time" aria-label={f.label+' mulai'} disabled={readOnly} value={v?.from||''} onChange={e=>set({...v,from:e.target.value})}/><span>s.d.</span><input type="time" aria-label={f.label+' selesai'} disabled={readOnly} value={v?.to||''} onChange={e=>set({...v,to:e.target.value})}/></div>:<input type="time" {...common} value={v||''} onChange={e=>set(e.target.value)}/>;
  case 'radio':return <Choices f={f} multi={false} v={v} set={set} readOnly={readOnly}/>;
  case 'checkbox':return <Choices f={f} multi v={v} set={set} readOnly={readOnly}/>;
  case 'grid':return <Grid f={f} v={v} set={set} readOnly={readOnly}/>;
  case 'table':return <Table f={f} v={v} set={set} readOnly={readOnly}/>;
  case 'signature':return <Signature f={f} v={v} set={set} readOnly={readOnly}/>;
 }
 return null;
}
type C={f:Field;v:any;set:(v:any)=>void;readOnly:boolean};
function Choices({f,multi,v,set,readOnly}:C&{multi:boolean}){
 const selected:string[]=multi?v?.values||[]:v?.value?[v.value]:[];
 const toggle=(o:string)=>{if(!multi)return set({value:o,...(o===OTHER&&{other:v?.other||''})});const values=selected.includes(o)?selected.filter(x=>x!==o):[...selected,o];set(values.length?{values,...(values.includes(OTHER)&&{other:v?.other||''})}:undefined);};
 return <div className={s.options}>{[...(f.options||[]),...(f.other?[OTHER]:[])].map(o=><label key={o} className={s.option}><input type={multi?'checkbox':'radio'} name={'q-'+f.id} disabled={readOnly} checked={selected.includes(o)} onChange={()=>toggle(o)} onClick={()=>{if(!multi&&selected.includes(o))set(undefined);}}/>{o===OTHER?'Lainnya':o}</label>)}{f.other&&selected.includes(OTHER)&&<input type="text" aria-label={f.label+' — Lainnya'} disabled={readOnly} value={v?.other||''} maxLength={500} onChange={e=>set({...v,other:e.target.value})}/>}</div>;
}
function Grid({f,v,set,readOnly}:C){
 const val=v||{},opts=f.choice?.options||[],fixed=f.fixedColumns||[],span=1+fixed.length+opts.length+(f.remark?1:0);
 const put=(rowId:string,patch:any)=>set({...val,[rowId]:{...val[rowId],...patch}});
 return <div className={s.gridWrap}><table className={s.grid}><thead><tr><th scope="col">No.</th>{fixed.map((c,ci)=><th key={ci} scope="col">{c}</th>)}{opts.map(o=><th key={o} scope="col" className={s.choice}>{o}</th>)}{f.remark&&<th scope="col">{f.remark}</th>}</tr></thead><tbody>{(f.groups||[]).map((g,gi)=><Fragment key={gi}>{g.title&&<tr className={s.group}><td colSpan={span}>{g.title}</td></tr>}{g.rows.map((r,i)=>{const a=val[r.id]||{},label=r.cells.filter(Boolean).join(' — ');return <tr key={r.id}><td data-label="No.">{r.no??i+1}</td>{fixed.map((c,ci)=><td key={ci} data-label={c}>{r.cells[ci]}{ci===0&&r.blank&&<input className={s.blank} type="text" aria-label={'Isian: '+label} disabled={readOnly} value={a.blank||''} maxLength={500} onChange={e=>put(r.id,{blank:e.target.value})}/>}</td>)}{opts.map(o=><td key={o} className={s.choice}><label><input type="radio" name={`q-${f.id}-${r.id}`} aria-label={o+': '+label} disabled={readOnly} checked={a.choice===o} onChange={()=>put(r.id,{choice:o})} onClick={()=>{if(a.choice===o)put(r.id,{choice:undefined});}}/><span className={s.mobileOnly}>{o}</span></label></td>)}{f.remark&&<td data-label={f.remark}><input type="text" aria-label={f.remark+': '+label} disabled={readOnly} value={a.remark||''} maxLength={1000} onChange={e=>put(r.id,{remark:e.target.value})}/></td>}</tr>;})}</Fragment>)}</tbody></table></div>;
}
function Table({f,v,set,readOnly}:C){
 const cols=f.columns||[],max=f.maxRows??50,rows:any[]=Array.isArray(v)&&v.length?v:Array.from({length:Math.max(1,f.minRows||1)},()=>({}));
 const put=(i:number,col:string,x:string)=>set(rows.map((r,j)=>j===i?{...r,[col]:x}:r));
 return <div><div className={s.tableWrap}><table className={s.table}><thead><tr><th scope="col">No.</th>{cols.map(c=><th key={c.id} scope="col">{c.label}{c.required&&<span className={s.req} aria-hidden="true">*</span>}</th>)}{!readOnly&&<th scope="col"><span className={w.srOnly}>Aksi</span></th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{i+1}</td>{cols.map(c=><td key={c.id}>{c.type==='radio'?<select aria-label={c.label+' baris '+(i+1)} disabled={readOnly} value={r[c.id]||''} onChange={e=>put(i,c.id,e.target.value)}><option value="">–</option>{(c.options||[]).map(o=><option key={o}>{o}</option>)}</select>:<input type={c.type==='date'?'date':c.type==='time'?'time':'text'} aria-label={c.label+' baris '+(i+1)} disabled={readOnly} value={r[c.id]||''} onChange={e=>put(i,c.id,e.target.value)}/>}</td>)}{!readOnly&&<td><button type="button" className={s.linkButton} disabled={rows.length<=1} onClick={()=>set(rows.filter((_,j)=>j!==i))}>Hapus</button></td>}</tr>)}</tbody></table></div>{!readOnly&&rows.length<max&&<button type="button" className={s.iconButton} onClick={()=>set([...rows,{}])}>Tambah baris</button>}</div>;
}
function Signature({f,v,set,readOnly}:C){
 if(readOnly)return <div className={s.signature}>{v?.image?<img className={s.signatureImage} src={v.image} alt={'Tanda tangan '+(v.name||f.label)}/>:<span className={s.code}>Belum ditandatangani</span>}<strong>{v?.name||'—'}</strong>{v?.signedAt&&<span className={s.code}>{new Date(v.signedAt).toLocaleString('id-ID')}</span>}</div>;
 return <div className={s.signature}><SignaturePad label={f.label||''} value={v?.image} onChange={image=>set({...v,image})}/><label className={s.signatureName}>Nama penanda tangan<input type="text" value={v?.name||''} maxLength={160} onChange={e=>set({...v,name:e.target.value})}/></label></div>;
}
