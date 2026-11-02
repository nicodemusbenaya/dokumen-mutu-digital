import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {pdfToDocx} from '../src/lib/conversion.mjs';

test('DUMMY PDF text remains editable and embedded raster visuals remain in Word',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'DUMMY-pdf-visual-'));
 try{
  const pdf=await PDFDocument.create(),page=pdf.addPage([400,400]),font=await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('DUMMY EDITABLE VISUAL',{x:30,y:340,font,size:20});page.drawRectangle({x:30,y:200,width:180,height:90,color:rgb(0,0.5,1)});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p7sAAAAASUVORK5CYII=','base64');page.drawImage(await pdf.embedPng(png),{x:40,y:40,width:70,height:70});
  const input=path.join(dir,'DUMMY-visual.pdf'),output=path.join(dir,'DUMMY-visual.docx');await fs.writeFile(input,await pdf.save());
  await pdfToDocx(input,output);const zip=await JSZip.loadAsync(await fs.readFile(output));
  const xml=await zip.file('word/document.xml').async('string');
  assert.match(xml,/DUMMY EDITABLE VISUAL/,'PDF text must be editable Word text');
  assert.ok(Object.keys(zip.files).some(name=>name.startsWith('word/media/')),'embedded raster visual must be retained');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
