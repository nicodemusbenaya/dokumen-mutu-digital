'use client';
import {useMemo,useState,FormEvent,Fragment,ReactNode} from 'react';
import {useResource} from './useResource';
import {IconPeta,IconRefresh,IconSearch} from './Icons';
import s from './DocumentMap.module.css';

type MapDocument={id:string;code:string;title:string;kind:string;department:string;category:string;parentId:string|null;relationSource:'manual'|'automatic'|'needs_review'|'unlinked';relationNote:string|null;documentDate:string|null;dateStatus:string;level:number|null;lockVersion:number};
const labels=['','Dokumen Mutu','Prosedur / SOP','Instruksi Kerja','Formulir Mutu','Lampiran'];
function displayDate(value:string|null){if(!value)return 'Perlu pemeriksaan';const [y,m,d]=value.slice(0,10).split('-').map(Number);return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));}
function validParent(parent:MapDocument|undefined,child:MapDocument){return !!parent?.level&&(child.level===parent.level+1||child.level===4&&parent.level===2||child.level===5&&parent.level===1);}
function arrange(documents:MapDocument[]){
 const byId=new Map(documents.map(d=>[d.id,d]));
 const children=new Map<string,MapDocument[]>();
 for(const d of documents){const parent=d.parentId?byId.get(d.parentId):undefined;if(validParent(parent,d)){const list=children.get(parent!.id)||[];list.push(d);children.set(parent!.id,list);}}
 const sort=(a:MapDocument,b:MapDocument)=>(a.level??99)-(b.level??99)||a.code.localeCompare(b.code,'id')||a.title.localeCompare(b.title,'id');
 const result:{doc:MapDocument;depth:number;group:string}[]=[],seen=new Set<string>();
 const visit=(d:MapDocument,depth:number,group:string)=>{if(seen.has(d.id))return;seen.add(d.id);result.push({doc:d,depth,group});for(const child of (children.get(d.id)||[]).sort(sort))visit(child,depth+1,group);};
 for(const d of documents.filter(d=>d.level===1).sort(sort))visit(d,0,'hierarchy');
 for(const d of documents.filter(d=>!seen.has(d.id)&&d.level!==null).sort(sort))visit(d,0,'unassigned');
 for(const d of documents.filter(d=>!seen.has(d.id)).sort(sort))visit(d,0,'unknown');
 return result;
}
function graphOf(documents:MapDocument[]){
 const byId=new Map(documents.map(d=>[d.id,d]));
 const children=new Map<string,MapDocument[]>();
 const sort=(a:MapDocument,b:MapDocument)=>(a.level??99)-(b.level??99)||a.code.localeCompare(b.code,'id')||a.title.localeCompare(b.title,'id');
 for(const doc of documents){
  const parent=doc.parentId?byId.get(doc.parentId):undefined;
  if(validParent(parent,doc)){const list=children.get(parent!.id)||[];list.push(doc);children.set(parent!.id,list);}
 }
 for(const list of children.values())list.sort(sort);
 return {children,roots:documents.filter(d=>d.level===1).sort(sort),unlinked:documents.filter(d=>{const parent=d.parentId?byId.get(d.parentId):undefined;return d.level!==1&&!validParent(parent,d);}).sort(sort)};
}
export function DocumentMap({admin,onOpen}:{admin:boolean;onOpen:(id:string)=>void}){
 const resource=useResource<{documents:MapDocument[]}>('document-map');
 const [search,setSearch]=useState(''),[mode,setMode]=useState<'table'|'graph'>('table'),[editing,setEditing]=useState<string|null>(null),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const [expanded,setExpanded]=useState<Set<string>>(()=>new Set()),[childLimits,setChildLimits]=useState<Record<string,number>>({});
 const [showUnlinked,setShowUnlinked]=useState(false),[unlinkedLimit,setUnlinkedLimit]=useState(24);
 const documents=resource.data?.documents||[];
 const rows=useMemo(()=>arrange(documents),[documents]);
 const graph=useMemo(()=>graphOf(documents),[documents]);
 const filtered=rows.filter(({doc})=>`${doc.title} ${doc.code} ${doc.department} ${doc.kind}`.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')));
 const visibleIds=useMemo(()=>{
  if(!search.trim())return new Set(documents.map(d=>d.id));
  const matches=new Set(filtered.map(row=>row.doc.id));
  const byId=new Map(documents.map(d=>[d.id,d]));
  for(const id of [...matches]){let parent=byId.get(id)?.parentId;const seen=new Set<string>();while(parent&&byId.has(parent)&&!seen.has(parent)){matches.add(parent);seen.add(parent);parent=byId.get(parent)?.parentId||null;}}
  return matches;
 },[documents,filtered,search]);
 const graphNode=(doc:MapDocument):ReactNode=>{
  if(!visibleIds.has(doc.id))return null;
  const children=(graph.children.get(doc.id)||[]).filter(child=>visibleIds.has(child.id));
  const isExpanded=!!search.trim()||expanded.has(doc.id),limit=search.trim()?children.length:childLimits[doc.id]||12;
  const visibleChildren=children.slice(0,limit);
  return <li key={doc.id}><article className={s.node}><div className={s.nodeTop}><span>{doc.level?`Level ${doc.level} · ${labels[doc.level]}`:'Level belum dikenali'}</span><span>{doc.department}</span></div><button onClick={()=>onOpen(doc.id)}>{doc.title}</button><code>{doc.code}</code><small>{displayDate(doc.documentDate)}</small>{doc.relationSource==='automatic'&&<small className={s.inferred}>Terhubung otomatis</small>}{doc.relationSource==='needs_review'&&<small className={s.review}>{doc.relationNote||'Hubungan perlu pemeriksaan'}</small>}{children.length>0&&!search.trim()&&<button type="button" className={s.branchToggle} aria-expanded={isExpanded} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(next.has(doc.id))next.delete(doc.id);else next.add(doc.id);return next;})}>{isExpanded?'Sembunyikan turunan':`Lihat ${children.length} turunan`}</button>}</article>{isExpanded&&children.length>0&&<ul className={s.branch}>{visibleChildren.map(graphNode)}{visibleChildren.length<children.length&&<li className={s.moreItem}><button type="button" className={s.moreButton} onClick={()=>setChildLimits(previous=>({...previous,[doc.id]:limit+12}))}>Tampilkan 12 turunan berikutnya ({children.length-visibleChildren.length} tersisa)</button></li>}</ul>}</li>;
 };
 async function save(e:FormEvent<HTMLFormElement>,doc:MapDocument){
  e.preventDefault();setSaving(true);setError('');const data=new FormData(e.currentTarget);
  try{const response=await fetch('/api/v2/document-map/'+doc.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({parentId:data.get('parentId')||null,documentDate:data.get('documentDate')||null,lockVersion:doc.lockVersion})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Gagal menyimpan Peta Dokumen');setEditing(null);resource.reload();}
  catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan Peta Dokumen');}finally{setSaving(false);}
 }
 async function readDate(doc:MapDocument){
  setSaving(true);setError('');
  try{const response=await fetch('/api/v2/document-map/'+doc.id+'/read-date',{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Tanggal tidak dapat dibaca');resource.reload();}
  catch(e){setError(e instanceof Error?e.message:'Tanggal tidak dapat dibaca');}finally{setSaving(false);}
 }
 return <div className={s.map}>
  <div className={s.head}><div><h1>Peta Dokumen</h1><p>Hierarki dokumen terdaftar menurut level. Tanggal berasal dari file aktif atau hasil pemeriksaan admin.</p></div><button className={s.reload} onClick={resource.reload}><IconRefresh/>Muat ulang</button></div>
  <div className={s.tools}><label className={s.search}><IconSearch/><span className={s.srOnly}>Cari Peta Dokumen</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul, kode, atau bidang"/></label><div className={s.viewSwitch} role="group" aria-label="Tampilan Peta Dokumen"><button aria-pressed={mode==='table'} onClick={()=>setMode('table')}>Daftar hierarki</button><button aria-pressed={mode==='graph'} onClick={()=>setMode('graph')}>Bagan hubungan</button></div><span>{documents.length} dokumen aktif</span></div>
  {error&&<p role="alert" className={s.error}>{error}</p>}
  {resource.loading&&!resource.data?<p role="status" className={s.message}>Memuat Peta Dokumen…</p>:resource.error?<p role="alert" className={s.error}>{resource.error} <button onClick={resource.reload}>Coba lagi</button></p>:!documents.length?<div className={s.message}><IconPeta size={34}/><h2>Belum ada dokumen terdaftar</h2><p>Peta akan terisi setelah dokumen diunggah ke register.</p></div>:!filtered.length?<p className={s.message}>Tidak ada dokumen yang cocok. Coba kata kunci lain.</p>:
  mode==='graph'?<div className={s.graph}>
   <div className={s.levelGuide}>{labels.slice(1).map((label,i)=><div key={label}><span>{i+1}</span>{label}</div>)}</div>
   <p className={s.graphIntro}>Buka cabang induk untuk melihat dokumen yang terkait. Hubungan otomatis tetap perlu diperiksa bila kode atau jenis dokumen tidak pasti.</p>
   {graph.roots.some(d=>visibleIds.has(d.id))?<section><h2>Hubungan terpetakan</h2><ul className={s.forest}>{graph.roots.map(graphNode)}</ul></section>:<p className={s.graphNote}>Belum ada dokumen Level 1 yang terdaftar dalam hasil ini.</p>}
   {graph.unlinked.some(d=>visibleIds.has(d.id))&&<section><div className={s.unlinkedHead}><div><h2>Belum terhubung ke induk · {graph.unlinked.filter(d=>visibleIds.has(d.id)).length}</h2><p>Kode atau jenis dokumen belum menunjukkan induk secara pasti. {admin?'Pilih “Atur” pada Daftar hierarki untuk memasangkan dokumen.':'Admin dapat menghubungkan dokumen ini.'}</p></div>{!search.trim()&&<button type="button" className={s.moreButton} aria-expanded={showUnlinked} onClick={()=>setShowUnlinked(value=>!value)}>{showUnlinked?'Sembunyikan daftar':'Lihat dokumen'}</button>}</div>{(showUnlinked||!!search.trim())&&<><ul className={s.unlinked}>{graph.unlinked.filter(d=>visibleIds.has(d.id)).slice(0,search.trim()?undefined:unlinkedLimit).map(graphNode)}</ul>{!search.trim()&&unlinkedLimit<graph.unlinked.length&&<button type="button" className={s.moreButton} onClick={()=>setUnlinkedLimit(value=>value+24)}>Tampilkan 24 dokumen berikutnya</button>}</>}</section>}
  </div>:
  <div className={s.scroll}><table><thead><tr><th scope="col">Nama dokumen</th>{labels.slice(1).map(x=><th scope="col" key={x}>{x}</th>)}<th scope="col">Tanggal dokumen</th>{admin&&<th scope="col">Pengaturan</th>}</tr></thead><tbody>{filtered.map(({doc,depth,group},index)=>{
    const heading=group!==filtered[index-1]?.group;
    const candidates=documents.filter(p=>validParent(p,doc)&&p.id!==doc.id);
    return <Fragment key={doc.id}>{heading&&<tr className={s.group}><th colSpan={admin?8:7} scope="rowgroup">{group==='hierarchy'?'Hierarki dokumen':group==='unassigned'?'Belum memiliki induk':'Level belum dikenali'}</th></tr>}
      <tr><td><div className={s.docName} style={{paddingInlineStart:`${depth*18}px`}}><span className={s.level}>{doc.level?`L${doc.level}`:'—'}</span><button onClick={()=>onOpen(doc.id)}>{doc.title}</button></div><small>{doc.department}{doc.relationSource==='automatic'?' · Terhubung otomatis':doc.relationSource==='needs_review'?' · Hubungan perlu pemeriksaan':''}</small></td>{[1,2,3,4,5].map(level=><td key={level} className={s.code}>{doc.level===level?doc.code:'—'}</td>)}<td className={s.date}>{displayDate(doc.documentDate)}<small>{doc.dateStatus==='verified'?'Diperiksa admin':doc.dateStatus==='extracted'?'Dibaca dari file':'Perlu pemeriksaan'}</small></td>{admin&&<td><div className={s.rowActions}><button className={s.edit} disabled={!doc.level} aria-expanded={editing===doc.id} onClick={()=>{setError('');setEditing(editing===doc.id?null:doc.id);}}>Atur</button>{doc.dateStatus!=='verified'&&<button className={s.edit} disabled={saving} onClick={()=>readDate(doc)}>Baca tanggal</button>}</div></td>}</tr>
      {admin&&editing===doc.id&&<tr><td colSpan={8}><form className={s.editor} onSubmit={e=>save(e,doc)}><label>Induk dokumen<select name="parentId" defaultValue={doc.parentId||''}><option value="">{doc.level===1?'Tidak ada (Level 1)':'Belum dipetakan'}</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</select></label><label>Tanggal pada dokumen<input type="date" name="documentDate" defaultValue={doc.documentDate?.slice(0,10)||''}/></label><div className={s.editorActions}><button type="button" onClick={()=>setEditing(null)}>Batal</button><button type="submit" disabled={saving}>{saving?'Menyimpan…':'Simpan'}</button></div></form><p className={s.hint}>Induk dipilih dari level di atasnya. Formulir boleh langsung terkait Prosedur; Lampiran terkait Dokumen Mutu. Kosongkan tanggal jika belum dapat dipastikan.</p></td></tr>}
    </Fragment>;
  })}</tbody></table></div>}
 </div>;
}
