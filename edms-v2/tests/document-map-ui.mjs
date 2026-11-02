// DUMMY visual check: all API responses are intercepted; no database or document writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer';

const documents=[{id:'DUMMY-manual',code:'DOC-DUMMY-MAN',title:'Dokumen Mutu DUMMY',kind:'Manual Mutu',department:'Umum',parentId:null,relationSource:'unlinked',documentDate:null,dateStatus:'missing',level:1,lockVersion:0}];
for(let n=1;n<=20;n++){
 const id='DUMMY-pr-'+n;
 documents.push({id,code:`PR.UPS.DUMMY.BMK.${String(n).padStart(2,'0')}-00`,title:`DUMMY Prosedur ${n}`,kind:'SOP/Prosedur',department:'BMK',parentId:'DUMMY-manual',relationSource:'automatic',documentDate:null,dateStatus:'missing',level:2,lockVersion:0});
 for(let i=1;i<=10;i++)documents.push({id:`DUMMY-fr-${n}-${i}`,code:`FR.UPS.DUMMY.BMK.${String(n).padStart(2,'0')}.${String(i).padStart(2,'0')}-00`,title:`DUMMY Formulir ${n}.${i}`,kind:'Formulir Mutu',department:'BMK',parentId:id,relationSource:'automatic',documentDate:null,dateStatus:'missing',level:4,lockVersion:0});
}
for(let i=1;i<=12;i++)documents.push({id:`DUMMY-lamp-${i}`,code:`DOC-DUMMY-LAMP-${i}`,title:`Lampiran ${i} DUMMY`,kind:'Lampiran',department:'Umum',parentId:'DUMMY-manual',relationSource:'automatic',documentDate:null,dateStatus:'missing',level:5,lockVersion:0});
for(let i=1;i<=125;i++)documents.push({id:`DUMMY-orphan-${i}`,code:`DOC-DUMMY-ORPHAN-${i}`,title:`DUMMY Belum Dipetakan ${i}`,kind:'DUMMY',department:'Umum',parentId:null,relationSource:'unlinked',documentDate:null,dateStatus:'missing',level:null,lockVersion:0});

const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  const url=new URL(request.url());
  if(!url.pathname.startsWith('/api/v2/'))return request.continue();
  const endpoint=url.pathname.slice(8);
  const data=endpoint==='me'?{user:{id:1,fullName:'DUMMY Admin',role:'Super user',bidang:'Umum'},canUpload:true}:
   endpoint==='document-map'?{documents}:endpoint==='masters'?{values:[],canManage:true}:{};
  await request.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await fs.mkdir('tests/output',{recursive:true});
 for(const [width,height] of [[1440,900],[390,800]]){
  await page.setViewport({width,height});
  await page.goto((process.env.TEST_BASE_URL||'http://localhost:3100')+'/?view=map',{waitUntil:'networkidle0'});
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Bagan hubungan'))?.click());
  await page.waitForSelector('button[aria-expanded]');
  const initial=await page.evaluate(()=>({height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,nodes:document.querySelectorAll('article').length}));
  assert(initial.height<2200,`Bagan awal terlalu panjang pada ${width}: ${JSON.stringify(initial)}`);
  assert(!initial.overflow,`Bagan meluber pada ${width}`);
  assert(initial.nodes<=2,`Cabang belum diringkas pada ${width}: ${initial.nodes}`);
  await page.screenshot({path:`tests/output/DUMMY-document-map-${width}.png`,fullPage:true});
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Lihat 32 turunan'))?.click());
  const opened=await page.evaluate(()=>({nodes:document.querySelectorAll('article').length,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert(opened.nodes>2&&opened.nodes<=14,`Jumlah cabang awal tidak dibatasi: ${JSON.stringify(opened)}`);
  assert(!opened.overflow,`Cabang terbuka meluber pada ${width}`);
  await page.screenshot({path:`tests/output/DUMMY-document-map-open-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('DUMMY_MAP_UI_PASS: compact initial graph, bounded branches, desktop and mobile');
}finally{await browser.close();}
