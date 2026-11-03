import JSZip from 'jszip';
import {fail} from './core.mjs';
const MAX_XML=10485760,BOX=/[□☐]/g,DOTS=/(\.{3,}|…+|_{3,})/,SIG=/\(\s*[.…_\s]{3,}\)/;
const ENT={lt:'<',gt:'>',amp:'&',quot:'"',apos:"'"};
const decode=t=>t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(m,c)=>c[0]==='#'?String.fromCodePoint(c[1].toLowerCase()==='x'?parseInt(c.slice(2),16):parseInt(c.slice(1),10)):ENT[c.toLowerCase()]??m);
function paraText(p){let out='';for(const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:sym\b[^>]*w:char="(F0A8|F06F|F0FE|F0FD|2610|25A1)"[^>]*\/>|<w:tab\/>|<w:br\/>/gi))out+=m[1]!==undefined?decode(m[1]):m[2]?'□':m[0].startsWith('<w:tab')?' ':'\n';return out.replace(/[ \t ]+/g,' ').trim();}
const isBold=p=>/<w:b\/>|<w:b w:val="(1|true|on)"\/>|<w:pStyle w:val="(Heading|Title|Judul)/i.test(p);
function blocks(body){
 const out=[];let depth=0,start=0;
 for(const m of body.matchAll(/<w:tbl>|<w:tbl\s[^>]*>|<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)){
  const t=m[0];
  if(t.startsWith('<w:tbl')){if(depth++===0)start=m.index;}
  else if(t==='</w:tbl>'){if(--depth===0)out.push({table:body.slice(start,m.index+t.length)});}
  else if(depth===0)out.push({p:t});
 }
 return out;
}
// Batasan: tabel bersarang tidak dipisah dan isinya bisa menyatu ke baris induk; rapikan di builder bila terjadi.
const tableRows=xml=>[...xml.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map(r=>[...r[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)].map(c=>[...c[1].matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map(p=>paraText(p[0])).filter(Boolean).join('\n')));
const kindOf=label=>/tanggal|tgl/i.test(label)?'date':/\b(jam|waktu)\b/i.test(label)?'time':'text';
function lineField(rawLabel,value,ctx){
 const label=rawLabel.replace(/[:*\s]+$/,'').trim().slice(0,500);if(!label)return null;
 if(BOX.test(value)){
  BOX.lastIndex=0;
  const parts=value.split(/[□☐]/).map(x=>x.trim()).filter(Boolean),other=parts.some(x=>/^lainnya/i.test(x));
  const options=[...new Set(parts.filter(x=>!/^lainnya/i.test(x)).map(x=>x.replace(DOTS,'').replace(/[:\s]+$/,'').trim()).filter(Boolean))];
  if(options.length)return {id:ctx.next(),type:'checkbox',label,options,...(other&&{other:true})};
 }
 BOX.lastIndex=0;
 if(!value.trim())return {id:ctx.next(),type:'text',label};
 if(DOTS.test(value)){const type=kindOf(label);return {id:ctx.next(),type,label,...(type==='time'&&/s\.?\s?d\.?|–|-/.test(value)&&{range:true})};}
 return null;
}
function fromParagraph(text,ctx){
 if(/^[A-H]\.\s+\S/.test(text)&&text.length<=150)return {id:ctx.next(),type:'heading',label:text};
 if((text.match(BOX)||[]).length>=2){const i=text.search(/[□☐]/);const f=lineField(text.slice(0,i)||'Pilihan',text.slice(i),ctx);if(f)return f;}
 const m=/^([^:]{2,80}?)\s*:\s*(.*)$/.exec(text);
 if(m&&!DOTS.test(m[1])){if(!m[2].trim())return {id:ctx.next(),type:'textarea',label:m[1].trim()};if(DOTS.test(m[2])||BOX.test(m[2])){BOX.lastIndex=0;const f=lineField(m[1],m[2],ctx);if(f)return f;}}
 BOX.lastIndex=0;
 return {id:ctx.next(),type:'static',text:text.slice(0,20000)};
}
function fromTable(rows,ctx,out){
 const nonEmpty=rows.filter(r=>r.some(c=>c.trim()));if(!nonEmpty.length)return;
 if(nonEmpty.every(r=>r[1]?.trim()===':')){for(const r of nonEmpty)out.push(lineField(r[0],r.slice(2).join(' '),ctx)||{id:ctx.next(),type:'static',text:r.filter(c=>c.trim()&&c.trim()!==':').join(': ')});return;}
 if(nonEmpty.every(r=>r.filter(c=>c.trim()).every(c=>SIG.test(c)))){
  for(const r of nonEmpty)for(const c of r.filter(x=>x.trim())){const lines=c.split('\n').map(x=>x.replace(SIG,'').trim()).filter(Boolean);const label=(lines.at(-1)||'Tanda tangan').replace(/^.*[.…]{3,}\s*/,'').trim()||'Tanda tangan';out.push({id:ctx.next(),type:'signature',label:label.slice(0,200)});}
  return;
 }
 const head=nonEmpty[0].map(c=>c.trim()),start=rows.indexOf(nonEmpty[0]);
 let choiceIdx=head.map((c,i)=>/^(ya|tidak|n\/?a)$/i.test(c)?i:-1).filter(i=>i>=0),choiceLabel='Jawaban',options=choiceIdx.map(i=>head[i]);
 const combo=head.findIndex(c=>/\(\s*ya\s*\/\s*tidak/i.test(c));
 if(choiceIdx.length<2&&combo>=0){choiceIdx=[combo];choiceLabel=head[combo].replace(/\(.*$/,'').trim()||'Jawaban';options=/\(([^)]*)\)/.exec(head[combo])[1].split('/').map(x=>x.trim()).filter(Boolean);}
 if(choiceIdx.length&&options.length>=2){
  const noIdx=head.findIndex(c=>/^no\.?$/i.test(c)),remarkIdx=head.findIndex(c=>/^ket/i.test(c));
  const fixedIdx=head.map((_,i)=>i).filter(i=>i!==noIdx&&i!==remarkIdx&&!choiceIdx.includes(i));
  const groups=[{title:'',rows:[]}];let n=0;
  for(const r of nonEmpty.slice(1)){
   const filled=r.map(c=>c.trim()).filter(Boolean);
   if(r.length===1||filled.length===1&&!/^\d+$/.test(filled[0])){groups.push({title:filled[0].slice(0,200),rows:[]});continue;}
   const cells=fixedIdx.map(i=>(r[i]||'').trim());if(!cells.some(Boolean))continue;
   groups.at(-1).rows.push({id:'r'+(++n),cells,...(DOTS.test(cells.join(' '))&&{blank:true})});
  }
  const used=groups.filter(g=>g.rows.length);
  if(used.length&&fixedIdx.length){out.push({id:ctx.next(),type:'grid',label:'Ceklis',fixedColumns:fixedIdx.map(i=>head[i]),choice:{label:choiceLabel,options},...(remarkIdx>=0&&{remark:head[remarkIdx]}),groups:used});return;}
 }
 const colIdx=head.map((_,i)=>i).filter(i=>head[i]&&!/(^|\s)no\.?$/i.test(head[i])),body=rows.slice(start+1);
 if(body.length&&colIdx.length&&body.every(r=>colIdx.every(i=>!(r[i]||'').trim()))){
  out.push({id:ctx.next(),type:'table',label:(head.find(c=>/^[A-H]\.\s/.test(c))||'Tabel').replace(/\s*No\.?$/i,'').slice(0,500),columns:colIdx.map((i,k)=>{const type=kindOf(head[i]);return {id:'c'+(k+1),label:head[i].slice(0,200),...(type!=='text'&&{type})};}),minRows:1,maxRows:Math.min(Math.max(body.length*2,10),200)});
  return;
 }
 out.push({id:ctx.next(),type:'static',text:nonEmpty.map(r=>r.map(c=>c.trim()).filter(Boolean).join(' | ')).join('\n').slice(0,20000)});
}
// Ukuran di header zip bisa dipalsukan: hitung byte saat didekompresi dan hentikan begitu melewati batas.
function readCapped(entry){
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0,done=false;const stream=entry.nodeStream('nodebuffer');
  const stop=e=>{if(done)return;done=true;stream.pause?.();reject(e);};
  stream.on('data',c=>{if(done)return;size+=c.length;if(size>MAX_XML){const e=new Error('Isi dokumen Word terlalu besar');e.status=413;return stop(e);}chunks.push(c);});
  stream.on('error',()=>stop(Object.assign(new Error('Bukan file Word (.docx) yang valid'),{status:400})));
  stream.on('end',()=>{if(!done){done=true;resolve(Buffer.concat(chunks).toString('utf8'));}});
 });
}
export async function importDocx(buffer){
 let zip;try{zip=await JSZip.loadAsync(buffer);}catch{fail('Bukan file Word (.docx) yang valid');}
 const entry=zip.file('word/document.xml');if(!entry)fail('Bukan file Word (.docx) yang valid');
 const xml=await readCapped(entry);
 const from=xml.indexOf('<w:body'),to=xml.lastIndexOf('</w:body>');
 const body=from>=0&&to>from?xml.slice(from,to):'';
 let n=0,title='';const ctx={next:()=>'f'+(++n)},fields=[],header={};
 for(const b of blocks(body)){
  if(b.table){fromTable(tableRows(b.table),ctx,fields);continue;}
  const text=paraText(b.p);if(!text)continue;
  const code=/^(FR\.[\w.\-]+|Lampiran\s+[\d.]+)/i.exec(text);
  if(code&&!header.code){header.code=code[1];if(text===code[1])continue;}
  if(!title&&!fields.length&&text.length<=200&&(isBold(b.p)||text===text.toUpperCase()&&/[A-Z]/.test(text))){title=text;continue;}
  fields.push(fromParagraph(text,ctx));
 }
 if(!fields.length)fail('Tidak ada isi yang dapat dikenali dari dokumen Word');
 return {title:(title||'Form hasil impor').slice(0,255),definition:{schema:1,header,fields}};
}
