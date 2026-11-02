import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {dateCandidates,documentLevel,extractDocumentDate,inferMapParents} from '../src/lib/document-map.mjs';

test('DUMMY: document codes and Lampiran map to the five display levels',()=>{
 assert.equal(documentLevel({code:'MAN.MUTU.UPS.2025.02'}),1);
 assert.equal(documentLevel({code:'PR.UPS.SER3.BMK.01-02'}),2);
 assert.equal(documentLevel({code:'IK.UPS.2026.BST.01-00'}),3);
 assert.equal(documentLevel({code:'FR.UPS.PBR3.BST.01.01A-00'}),4);
 assert.equal(documentLevel({code:'DOC-1234',kind:'Lampiran'}),5);
 assert.equal(documentLevel({code:'DOC-1234',kind:'Manual Mutu',title:'DUMMY Matriks',category:'0. MM - DUMMY',folderPath:'Lampiran'}),5);
 assert.equal(documentLevel({code:'DOC-1234',kind:'Manual Mutu',title:'Lampiran 1 DUMMY'}),5);
});
test('DUMMY: unambiguous Manual Mutu anchors procedures and attachments while other roots stay separate',()=>{
 const documents=[
  {id:'MAN',code:'DOC-DUMMY-MAN',title:'Dokumen Mutu DUMMY',kind:'Manual Mutu',category:'0. MM - DUMMY',parentId:null},
  {id:'OTHER',code:'DOC-DUMMY-OTHER',title:'DUMMY Other manual',kind:'Manual Mutu',parentId:null},
  {id:'PR',code:'PR.UPS.DUMMY.BMK.01-00',title:'DUMMY Prosedur',kind:'SOP/Prosedur',parentId:null},
  {id:'LAMP',code:'DOC-DUMMY-LAMP',title:'Lampiran 1 DUMMY',kind:'Lampiran',category:'0. MM - DUMMY',parentId:null},
  {id:'MATRIX',code:'DOC-DUMMY-MATRIX',title:'DUMMY Matriks',kind:'Manual Mutu',category:'0. MM - DUMMY',folderPath:'Lampiran',parentId:null}
 ];
 const mapped=inferMapParents(documents);
 for(const id of ['PR','LAMP','MATRIX'])assert.equal(mapped.find(d=>d.id===id).parentId,'MAN');
 assert.equal(mapped.find(d=>d.id==='OTHER').parentId,null);
 const otherCategory=inferMapParents([...documents,{id:'OUTSIDE',code:'DOC-DUMMY-OUTSIDE',title:'Lampiran luar DUMMY',kind:'Lampiran',category:'DUMMY lain',parentId:null}]);
 assert.equal(otherCategory.find(d=>d.id==='OUTSIDE').parentId,null);
});
test('DUMMY: filename codes link only unique, supported parent relationships',()=>{
 const docs=[
  {id:'MAN',code:'MAN.MUTU.UPS.2025.02',kind:'Manual Mutu',parentId:null},
  {id:'PR',code:'PR.UPS.SER3.BMK.01-02',kind:'SOP/Prosedur',parentId:null},
  {id:'IK',code:'IK.UPS.2026.BMK.01-00',kind:'Instruksi Kerja',parentId:null},
  {id:'FR',code:'FR.UPS.SER3.BMK.01.01A-00',kind:'Formulir Mutu',parentId:null}
 ];
 const mapped=inferMapParents(docs);
 assert.equal(mapped.find(d=>d.id==='PR').parentId,'MAN');
 assert.equal(mapped.find(d=>d.id==='FR').parentId,'PR');
 assert.equal(mapped.find(d=>d.id==='FR').relationSource,'automatic');
 assert.equal(mapped.find(d=>d.id==='IK').parentId,null);
 assert.match(mapped.find(d=>d.id==='IK').relationNote,/tidak memuat induk/);
 const ambiguous=inferMapParents([...docs,{id:'PR2',code:'PR.UPS.SER3.BMK.01-03',kind:'SOP/Prosedur',parentId:null}]);
 assert.equal(ambiguous.find(d=>d.id==='FR').parentId,null);
 assert.equal(ambiguous.find(d=>d.id==='FR').relationSource,'needs_review');
 const manual=inferMapParents(docs.map(d=>d.id==='FR'?{...d,parentId:'IK'}:d));
 assert.equal(manual.find(d=>d.id==='FR').parentId,'IK');
 assert.equal(manual.find(d=>d.id==='FR').relationSource,'manual');
});
test('DUMMY: date parser accepts Indonesian dates and rejects invalid dates',()=>{
 assert.deepEqual(dateCandidates('DUMMY 07 Agustus 2026, Jakarta 07 Agustus 2026'),['2026-08-07']);
 assert.deepEqual(dateCandidates('DUMMY 31 Februari 2026'),[]);
 assert.deepEqual(dateCandidates('DUMMY 01/10/2026'),['2026-10-01']);
});
test('DUMMY: DOCX date comes from the cover before revision history',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'DUMMY-map-'));
 try{
  const zip=new JSZip();zip.file('word/document.xml','<w:document><w:body><w:p><w:r><w:t>DUMMY PR.UPS.TEST</w:t></w:r></w:p><w:p><w:r><w:t>07 Agustus 2026</w:t></w:r></w:p><w:p><w:r><w:t>RIWAYAT PERUBAHAN</w:t></w:r></w:p><w:p><w:r><w:t>26 Maret 2026</w:t></w:r></w:p></w:body></w:document>');
  const file=path.join(dir,'DUMMY.docx');await fs.writeFile(file,await zip.generateAsync({type:'nodebuffer'}));
  assert.deepEqual(await extractDocumentDate(file,'docx'),{date:'2026-08-07',status:'extracted'});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('DUMMY: PDF date comes from first page only',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'DUMMY-map-'));
 try{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('DUMMY 01 Oktober 2026',{x:50,y:700,font,size:14});
  pdf.addPage().drawText('26 Maret 2026',{x:50,y:700,font,size:14});
  const file=path.join(dir,'DUMMY.pdf');await fs.writeFile(file,await pdf.save());
  assert.deepEqual(await extractDocumentDate(file,'pdf'),{date:'2026-10-01',status:'extracted'});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
