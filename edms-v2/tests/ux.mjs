// Synthetic browser regression only. Every API call is intercepted; no DB writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
let page;
try{
 page=await browser.newPage();const base=process.env.TEST_BASE_URL||'http://localhost:3100';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const sample={id:'DUMMY-doc',code:'DUMMY-01',title:'DUMMY Dokumen pasangan',department:'TEST',kind:'SOP/Prosedur',category:'DUMMY',status:'Aktif',activeVersion:2,lockVersion:3,canEdit:true,updatedAt:'2026-10-23 10:00:00',versions:[{id:'DUMMY-version',number:2,revision:'R1',summary:'DUMMY revision',actorName:'DUMMY',createdAt:'2026-10-23 10:00:00',files:[{id:'DUMMY-pdf',extension:'pdf',origin:'original',name:'DUMMY.pdf',size:100}]}]};
 const job={id:'DUMMY-job',kind:'import',state:'partial',progress:100,items:[{id:'DUMMY-item',originalPath:'DUMMY-pasangan.docx',state:'needs_review',stage:'pairing'}]};
 let holdPart,partStarted,resolveBody,parts=0,deletes=0,completed=0,failDocuments=false,failStats=false;
 let started=new Promise(r=>partStarted=r);
 await page.setRequestInterception(true);
 page.on('request',async req=>{
  const url=new URL(req.url());if(!url.pathname.startsWith('/api/v2/'))return req.continue();
  const p=url.pathname.slice(8);let data={},status=200;
  if(p==='me')data={user:{id:1,username:'DUMMY',fullName:'DUMMY User',role:'Super user',bidang:'TEST'},canUpload:true};
  else if(p==='masters')data={values:[...['Manual Mutu','SOP/Prosedur','Instruksi Kerja','Formulir Mutu'].map((value,i)=>({id:'DUMMY-kind-'+i,type:'kind',value,label:value,isActive:1,lockVersion:0})),...['BMK','TEST','Umum'].map((value,i)=>({id:'DUMMY-dept-'+i,type:'department',value,label:value,isActive:1,lockVersion:0})),{id:'DUMMY-category',type:'category',value:'DUMMY Test',label:'DUMMY Test',isActive:1,lockVersion:0}],canManage:true};
 else if(p==='stats'){if(failStats){status=503;data={error:'DUMMY ringkasan gagal'};}else data={documents:1,revisions:1,departments:1,bytes:100,recent:[sample]};}
  else if(p==='documents'){if(failDocuments){status=503;data={error:'DUMMY register gagal'};}else data={documents:url.searchParams.get('search')==='kosong'?[]:[sample],total:1,pages:1};}
  else if(p==='documents/'+sample.id)data=sample;
  else if(p==='jobs')data={jobs:[job]};
  else if(p.endsWith('/resolve')){resolveBody=JSON.parse(req.postData());data={ok:true};}
  else if(p==='jobs/'+job.id)data=job;
  else if(p==='uploads')data={id:'DUMMY-upload',parts:2,chunkSize:10};
  else if(p==='uploads/DUMMY-upload/part'){parts++;partStarted();await new Promise(r=>holdPart=r);data={ok:true};}
  else if(p==='uploads/DUMMY-upload/complete'){completed++;data={jobId:job.id};}
  else if(p==='uploads/DUMMY-upload'&&req.method()==='DELETE'){deletes++;data={ok:true};}
  else if(p==='audit')data={events:[],total:0};
  await req.respond({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 const visible=t=>page.waitForFunction(text=>document.body.innerText.includes(text),{},t);
 async function click(text){const handle=await page.waitForFunction(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t),{},text);await handle.asElement().click();}
 console.log('UX_STEP: unsent revision guards');
 await page.goto(base+'/?view=documents',{waitUntil:'networkidle0'});await click(sample.title);
 await click('Update dokumen');await page.type('textarea[name=summary]','DUMMY isian harus terjaga');
 page.once('dialog',d=>d.dismiss());await click('Daftar Dokumen');
 assert.equal(await page.$eval('textarea[name=summary]',e=>e.value),'DUMMY isian harus terjaga');
 page.once('dialog',d=>d.dismiss());await page.goBack().catch(()=>{});
 assert.equal(await page.$eval('textarea[name=summary]',e=>e.value),'DUMMY isian harus terjaga');
 page.once('dialog',d=>d.accept());await click('Daftar Dokumen');await visible('DUMMY Dokumen pasangan');
 console.log('UX_STEP: register error, retry and empty result');
 failDocuments=true;await page.click('button[aria-label="Muat ulang"]');
 await visible('DUMMY register gagal');assert(!await page.evaluate(()=>document.body.innerText.includes('Belum ada dokumen')));
 failDocuments=false;await click('Coba lagi');await visible('DUMMY Dokumen pasangan');
 await page.type('input[aria-label="Cari dokumen"]','kosong');await visible('Tidak ada hasil yang cocok');
 console.log('UX_STEP: cross-view upload progress and cancellation');
 await click('Upload & Impor');await visible('Pilih file dokumen atau ZIP');
 await fs.mkdir('tests/output',{recursive:true});const fixture=path.resolve('tests/output/DUMMY-ux.pdf');const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('DUMMY SYNTHETIC UX ONLY',{font});await fs.writeFile(fixture,await pdf.save());
 await (await page.$('input[type=file]')).uploadFile(fixture);await page.select('select[name=kind]','SOP/Prosedur');await page.select('select[name=department]','TEST');
 await click('Upload dan proses');await Promise.race([started,new Promise((_,reject)=>setTimeout(async()=>{const state=await page.evaluate(()=>({url:location.href,body:document.body.innerText.slice(-1600),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent.trim(),disabled:b.disabled})).slice(-12)})).catch(()=>({}));reject(new Error('DUMMY upload part was not requested; parts='+parts+' state='+JSON.stringify(state)));},15000))]);
 await click('Histori Aktivitas');await page.waitForSelector('[aria-label="Upload berjalan"]');
 await click('Batalkan upload berjalan');holdPart();
 await visible('Upload dibatalkan');assert.equal(parts,1);assert.equal(deletes,1);assert.equal(completed,0);
 console.log('UX_STEP: search, select and save document pairing');
 await click('Upload & Impor');
 const importJobButton=await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent?.trim().startsWith('Impor dokumen')));
 await importJobButton.asElement().click();await importJobButton.dispose();await visible('DUMMY-pasangan.docx');
 await page.click('summary');await page.type('[aria-label="Pilih pasangan dokumen"] input:not([type=hidden])','DUMMY');
 await click('DUMMY-01 — DUMMY Dokumen pasangan');await visible('Pasangan dipilih:');await visible('Revisi R1');await visible('PDF (asli)');
 // Other forms legitimately retain disabled buttons (upload without a selected file).
 const [resolveResponse]=await Promise.all([
  page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v2/jobs/'+job.id+'/resolve'&&r.request().method()==='POST'),
  click('Simpan dan proses ulang'),
 ]);
 assert.equal(resolveResponse.status(),200,'Pairing request failed');
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Simpan dan proses ulang'&&!b.disabled));
 assert(resolveBody,'Pairing request was not sent');
 assert.equal(resolveBody.itemId,'DUMMY-item');
 assert.equal(resolveBody.metadata.mode,'attach');
 assert.equal(resolveBody.metadata.documentId,sample.id);assert.equal(resolveBody.metadata.expectedVersion,2);assert.equal(resolveBody.metadata.expectedLockVersion,3);assert.equal(resolveBody.metadata.revision,'R1');
 console.log('UX_STEP: dashboard failure state');
 failStats=true;await click('Ringkasan');await visible('DUMMY ringkasan gagal');assert(!await page.evaluate(()=>document.body.innerText.includes('Register siap diisi')));
 await page.screenshot({path:'tests/output/ux-error.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('UX_PASS: revision discard guards, failed/empty/retry states, cross-view upload cancellation, pairing with version checks; intercepted DUMMY APIs only');
}catch(error){
 if(page){try{await fs.mkdir('tests/output',{recursive:true});await page.screenshot({path:'tests/output/ux-failure.png',fullPage:true});console.error('UX_FAILURE_STATE',await page.evaluate(()=>({url:location.href,alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent),disabledButtons:[...document.querySelectorAll('button:disabled')].map(e=>e.textContent.trim())})));}catch{}}
 throw error;
}finally{await browser.close();}
