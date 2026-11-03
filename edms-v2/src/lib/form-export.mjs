import JSZip from 'jszip';
import {OTHER} from './forms.mjs';
// Getter memeriksa bentuk nilai: kolom diambil dari versi terbaru, sedangkan jawaban lama bisa berasal dari jenis field lain.
const str=v=>typeof v==='string'?v:'';
const choiceText=v=>typeof v?.value!=='string'?'':v.value===OTHER?'Lainnya: '+(v.other||''):v.value;
const manyText=v=>!Array.isArray(v?.values)?'':v.values.map(x=>x===OTHER?'Lainnya: '+(v.other||''):x).join('; ');
function fieldColumns(f){
 const one=get=>[{key:f.id,label:f.label,get:a=>get(a[f.id])}];
 switch(f.type){
  case 'text':case 'textarea':case 'date':return one(str);
  case 'time':return one(v=>typeof v==='string'?v:v?.from?v.from+'–'+v.to:'');
  case 'radio':return one(choiceText);
  case 'checkbox':return one(manyText);
  case 'table':return one(v=>(Array.isArray(v)?v:[]).map(r=>f.columns.map(c=>r[c.id]||'').join(' | ')).join('\n'));
  case 'signature':return [{key:f.id+'.name',label:f.label+' — Nama',get:a=>str(a[f.id]?.name)},{key:f.id+'.sig',label:f.label+' — Tanda tangan',get:a=>a[f.id]?.image?'Ditandatangani':''}];
  case 'grid':return f.groups.flatMap(g=>g.rows.flatMap((r,i)=>{
   const label=[g.title,(r.no??i+1)+'.',r.cells.slice(0,2).filter(Boolean).join(' — ').slice(0,120)].filter(Boolean).join(' ');
   const cols=[{key:f.id+'.'+r.id,label:label+' — '+f.choice.label,get:a=>str(a[f.id]?.[r.id]?.choice)}];
   if(f.remark||r.blank)cols.push({key:f.id+'.'+r.id+'.remark',label:label+' — '+(f.remark||'Keterangan'),get:a=>{const x=a[f.id]?.[r.id];return x&&typeof x==='object'?[x.blank,x.remark].filter(v=>typeof v==='string').filter(Boolean).join('; '):'';}});
   return cols;
  }));
  default:return [];
 }
}
export function flatten(versions,submissions){
 const seen=new Map();
 for(const [,def] of [...versions.entries()].sort((a,b)=>b[0]-a[0]))for(const f of def.fields)for(const c of fieldColumns(f))if(!seen.has(c.key))seen.set(c.key,c);
 const cols=[...seen.values()];
 return [['Waktu Kirim','ID Jawaban','Pengisi','Versi Form','Ditandai',...cols.map(c=>c.label)],...submissions.map(s=>[s.createdAt,s.id,s.submitterLabel,String(s.formVersion),s.flagged?'Ya':'',...cols.map(c=>c.get(s.answers||{}))])];
}
// Batas sel Excel 32767; buang surrogate tunggal (termasuk yang terpotong) dan U+FFFE/U+FFFF agar file tidak minta "repair".
const xml=t=>String(t??'').slice(0,32767).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|[￾￿]/g,'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const colName=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export async function toXlsx(table){
 const zip=new JSZip();
 const rows=table.map((r,i)=>`<row r="${i+1}">`+r.map((v,j)=>`<c r="${colName(j)}${i+1}" t="inlineStr" s="${i?2:1}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')+'</row>').join('');
 const cols=(table[0]||[]).map((_,j)=>`<col min="${j+1}" max="${j+1}" width="${j<5?20:34}" customWidth="1"/>`).join('');
 zip.file('[Content_Types].xml',HEAD+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
 zip.file('_rels/.rels',HEAD+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 zip.file('xl/workbook.xml',HEAD+`<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="Jawaban" sheetId="1" r:id="rId1"/></sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',HEAD+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',HEAD+`<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>`);
 zip.file('xl/worksheets/sheet1.xml',HEAD+`<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`);
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
