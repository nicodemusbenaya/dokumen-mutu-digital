import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {filenameIdentity,resolveFilenameIdentity} from '../src/lib/filename-identity.mjs';
import {identity} from '../src/lib/core.mjs';
import {publish} from '../src/lib/documents.mjs';
import {classifyDocumentCode,departmentLabels} from '../src/lib/document-classification.mjs';

test('reference file codes populate the four document types, field aliases and official revision',()=>{
 const cases=[
  ['MAN.MUTU.UPS.2025.01 DUMMY Manual.pdf','Manual Mutu',null,'01'],
  ['PR.UPS.SER3.BMK.01-02 DUMMY Prosedur.pdf','SOP/Prosedur','BMK','02'],
  ['IK.UPS.PBR3.BMA.03-01 DUMMY Instruksi.pdf','Instruksi Kerja','BMA','01'],
  ['FR.UPS.SER3.BST.01.04-00 DUMMY Formulir.pdf','Formulir Mutu','BST','00'],
  ['FR.UPS.DUMMY.BST.01.01A-00 DUMMY Formulir.docx','Formulir Mutu','BST','00'],
  ['FR.UPS.DUMMY.BST.01.01B-00 DUMMY Formulir.docx.pdf','Formulir Mutu','BST','00'],
  ['PR.UPS.DUMMY.BMK03-02 DUMMY Prosedur.pdf','SOP/Prosedur','BMK','02'],
 ];
 for(const [name,kind,field,revision] of cases){
  const result=filenameIdentity(name);assert.equal(result.kind,kind);assert.equal(result.fieldCode,field);assert.equal(result.department,field?departmentLabels[field]:null);assert.equal(result.revision,revision);assert.equal(result.recognized,true);
 }
 assert.equal(classifyDocumentCode('DUMMYPR.UPS.SER3.BMK.01-02.pdf'),null,'Do not infer a code embedded in an unrelated token');
 assert.equal(classifyDocumentCode('FR.UPS.DUMMY.BST.01.01AB-00 DUMMY.pdf'),null,'Reject ambiguous form suffixes');
 assert.equal(classifyDocumentCode('FR.UPS.DUMMY.BST.01.01A-00Z DUMMY.pdf'),null,'Reject partial revision matches');
});

test('full PLN filename keeps the title and separates .REV.01 from document code',()=>{
 const name='PR.UPS.PBR3.BST.02-01.REV.01 PEMELIHARAAN SERTIFIKASI KOMPETENSI.pdf';
 const result=identity(name);
 assert.equal(result.code,'PR.UPS.PBR3.BST.02-01');
 assert.equal(result.title,name.slice(0,-4));assert.equal(result.revision,'01');assert.equal(result.shortName,false);
});
test('known names, Unicode paths, extension case and revision markers remain supported',()=>{
 for(const suffix of ['-REV2','.REV.02',' REV_02']){
  const result=filenameIdentity('Folder Uji/PR.UPS.SER3.BMK.01-02'+suffix+' DUMMY.PDF');
  assert.equal(result.code,'PR.UPS.SER3.BMK.01-02');assert.equal(Number(result.revision),2);
 }
 assert.equal(identity('Folder Üji\\FR.UPS.BMK.01.01-00 DUMMY.docx').code,'FR.UPS.BMK.01.01-00');
 assert.equal(identity('MM.UPS.01.REV.01 DUMMY.xlsx').code,'MM.UPS.01');
 assert.equal(identity('DUMMY prosedur.docx.pdf').title,'DUMMY prosedur');
});
test('Windows short aliases require review instead of a misleading title and generated DOC code',()=>{
 for(const name of ['PRUPSP~1.pdf','PRUPSP~1.PDF','DUMMY~12 (1).docx']){
  assert.equal(filenameIdentity(name).shortName,true);assert.equal(filenameIdentity(name).code,null);
  assert.throws(()=>resolveFilenameIdentity(name),e=>e.status===409&&e.message.includes('nama pendek Windows'));
 }
});
test('manual code and title resolve a short alias without rewriting its original filename',()=>{
 const metadata={code:' PR.UPS.PBR3.BST.02-01 ',title:' PEMELIHARAAN SERTIFIKASI KOMPETENSI '};
 const result=resolveFilenameIdentity('PRUPSP~1.pdf',metadata);
 assert.equal(result.code,'PR.UPS.PBR3.BST.02-01');assert.equal(result.title,'PEMELIHARAAN SERTIFIKASI KOMPETENSI');
 for(const incomplete of [{code:'DUMMY'},{title:'DUMMY'},{code:' ',title:'DUMMY'}])assert.throws(()=>resolveFilenameIdentity('PRUPSP~1.pdf',incomplete),e=>e.status===409);
});
test('ordinary unnamed-code documents keep the existing generated-code fallback policy',()=>{
 const result=resolveFilenameIdentity('DUMMY Panduan biasa.pdf');assert.equal(result.code,null);assert.equal(result.title,'DUMMY Panduan biasa');assert.equal(result.shortName,false);
 assert.equal(filenameIdentity('NOTPR.ABC.pdf').code,null,'Do not match a prefix inside another word');
});
test('DUMMY files named Lampiran use the Lampiran kind without borrowing the folder name',()=>{
 for(const name of ['Lampiran 1 DUMMY Istilah.pdf','LAMPIRAN_02 DUMMY.xlsx','Lampiran3 DUMMY.docx']){
  const result=filenameIdentity(name);assert.equal(result.kind,'Lampiran');assert.equal(result.recognized,false);
 }
 assert.equal(filenameIdentity('Folder Lampiran/DUMMY Dokumen Mutu.pdf').kind,null);
 const coded=filenameIdentity('FR.UPS.DUMMY.BST.01.01A-00 Lampiran DUMMY.pdf');
 assert.equal(coded.kind,'Lampiran');assert.equal(coded.code,'FR.UPS.DUMMY.BST.01.01A-00');assert.equal(coded.fieldCode,'BST');
 assert.equal(filenameIdentity('DUMMY Pelampiran.pdf').kind,null);
});
test('DUMMY alias publication is stopped before database access or original-file copying',async()=>{
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('DUMMY TEST short filename',{font});
 await fs.mkdir('tests/output',{recursive:true});const file='tests/output/DUMMY-short-name.pdf';await fs.writeFile(file,await pdf.save());
 await assert.rejects(()=>publish(file,'PRUPSP~1.pdf',{}, {id:1,role:'Super user'}),e=>e.status===409&&e.message.includes('PRUPSP~1.pdf'));
});
