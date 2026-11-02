import fs from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export async function docxFromPages(pages){
 const z=new JSZip(),rels=[],types=[];let body='';let image=0;
 for(let i=0;i<pages.length;i++){const p=pages[i];if(i)body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
 if(p.text?.trim()){for(const line of p.text.split('\n'))body+='<w:p><w:r><w:t xml:space="preserve">'+xml(line)+'</w:t></w:r></w:p>';}
 else if(p.image){image++;const rid='rId'+image;z.file('word/media/page'+image+'.png',p.image);rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${image}.png"/>`);const width=5486400,height=Math.round(width*(p.height||1)/(p.width||1));body+=`<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${image}" name="Halaman ${i+1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${image}" name="Halaman PDF"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;}
 }
 z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 z.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 z.file('word/_rels/document.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>');
 z.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>');return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
export async function pdfToDocx(input,output){
 const localPython=path.resolve('.python',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 const python=process.env.PDF2DOCX_PYTHON||(existsSync(localPython)?localPython:null)||process.env.PYTHON_BIN||(process.platform==='win32'?'python':'python3');
 const script=new URL('../../scripts/pdf-to-docx.py',import.meta.url);
 return new Promise((resolve,reject)=>{const child=spawn(python,[fileURLToPath(script),input,output],{stdio:['ignore','pipe','pipe'],windowsHide:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout=(stdout+b).slice(-2000));child.stderr.on('data',b=>stderr=(stderr+b).slice(-2000));child.on('error',()=>reject(new Error('Engine PDF ke Word belum tersedia pada runtime ini')));child.on('close',code=>code===0?resolve(stdout.trim().split('\n').pop()):reject(new Error(stderr.trim()||'Konversi PDF ke Word gagal')));});
}
export async function officeToPdf(input,output,work){
 await fs.mkdir(work,{recursive:true});const profile=path.join(work,'profile');const executable=process.env.LIBREOFFICE_BIN||'libreoffice';
 await new Promise((resolve,reject)=>{const child=spawn(executable,['-env:UserInstallation='+new URL('file:///'+profile.replaceAll('\\','/')).href,'--headless','--norestore','--nodefault','--nolockcheck','--convert-to','pdf','--outdir',work,input],{stdio:['ignore','ignore','pipe'],windowsHide:true});let error='';child.stderr.on('data',b=>{error=(error+b).slice(-1000);});const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Konversi Office melewati batas waktu'));},120000);child.on('error',()=>{clearTimeout(timer);reject(new Error('LibreOffice belum tersedia pada runtime ini'));});child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Konversi Office gagal; periksa isi/font/area cetak'));});});
 const result=path.join(work,path.basename(input,path.extname(input))+'.pdf');const data=await fs.readFile(result).catch(()=>{throw new Error('PDF hasil konversi tidak ditemukan');});if(!data.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('PDF hasil konversi tidak valid');await fs.copyFile(result,output);return 'PDF hasil konversi; periksa font, tabel, orientasi dan area cetak.';
}
