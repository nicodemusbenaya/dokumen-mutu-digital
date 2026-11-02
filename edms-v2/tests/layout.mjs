// Read-only UI regression: all API responses are synthetic and intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({headless:true,args:['--no-sandbox']});
try {
 const page = await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const doc={id:'dummy-layout',code:'DUMMY-LAYOUT',title:'DUMMY Pemeriksaan tata letak',department:'TEST',kind:'SOP/Prosedur',category:'DUMMY',activeVersion:1,lockVersion:0,status:'Aktif',updatedAt:'2026-10-23 09:00:00',canEdit:false,versions:[{id:'dummy-version',number:1,revision:'0',summary:'DUMMY layout only',actorName:'DUMMY',createdAt:'2026-10-23 09:00:00',files:[]}]};
 await page.setRequestInterception(true);
 page.on('request',async req=>{
  const url=new URL(req.url());
  if(!url.pathname.startsWith('/api/v2/'))return req.continue();
  const p=url.pathname.slice(8);
  let data={};
  if(p==='me')data={user:{id:1,fullName:'DUMMY Pengguna Uji',role:'Super user',bidang:'TEST'},canUpload:true};
  else if(p==='documents')data={documents:Array.from({length:30},(_,i)=>({...doc,id:'dummy-'+i})),total:30,pages:1};
  else if(p.startsWith('documents/'))data=doc;
  else if(p==='audit')data={events:Array.from({length:30},(_,i)=>({id:i,actorName:'DUMMY',action:'TEST_LAYOUT',createdAt:doc.updatedAt,context:{test:'DUMMY'}})),total:30};
  else if(p==='masters')data={values:[...['Manual Mutu','SOP/Prosedur','Instruksi Kerja','Formulir Mutu'].map((value,i)=>({id:'DUMMY-kind-'+i,type:'kind',value,label:value,isActive:1,lockVersion:0})),...['BMK','TEST','Umum'].map((value,i)=>({id:'DUMMY-dept-'+i,type:'department',value,label:value,isActive:1,lockVersion:0})),{id:'DUMMY-category',type:'category',value:'DUMMY Test',label:'DUMMY Test',isActive:1,lockVersion:0}],canManage:true};
 else if(p==='stats')data={documents:30,revisions:30,departments:1,bytes:0,recent:[]};
  await req.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await fs.mkdir('tests/output',{recursive:true});
 const results=[];
 for(const [width,height] of [[1440,900],[1024,500],[820,700],[390,700]]){
  console.log(`LAYOUT_STEP ${width}x${height}: documents, scroll and sidebar`);
  await page.setViewport({width,height});
  await page.goto((process.env.TEST_BASE_URL||'http://localhost:3100')+'/?view=documents',{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  await page.evaluate(()=>window.scrollTo(0,700));
  const layout=await page.evaluate(()=>{
   const sidebar=document.querySelector('aside'),nav=sidebar.querySelector('nav'),logout=sidebar.querySelector('[aria-label="Keluar"]');
   const r=sidebar.getBoundingClientRect(),l=logout.getBoundingClientRect();
   return {top:r.top,bottom:r.bottom,scrollY,logoutVisible:l.top>=0&&l.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,navScrollable:nav.scrollHeight>nav.clientHeight};
  });
  assert(layout.scrollY>0,'Page must actually scroll');
  assert(Math.abs(layout.top)<1,`Sidebar drift ${width}: ${JSON.stringify(layout)}`);
  assert(layout.bottom<=height+1,`Sidebar clipped ${width}`);
  assert(layout.logoutVisible,`Logout inaccessible ${width}`);
  assert(!layout.overflow,`Viewport overflow ${width}`);
  if(width===1024)assert(layout.navScrollable,'Short desktop menu must scroll independently');
  // Locator.filter checks the first matched node; it does not search all buttons.
  await page.locator('nav ::-p-aria([name="Histori Aktivitas"][role="button"])').click();
  await page.waitForSelector('tbody tr details');
  assert.equal(await page.$eval('nav button[aria-current="page"]',b=>b.textContent.trim()),'Histori Aktivitas','Audit navigation did not activate');
  assert(await page.$eval('tbody td:nth-child(4)',e=>getComputedStyle(e).display!=='none'),'Audit details hidden');
  await page.screenshot({path:`tests/output/layout-${width}.png`});
  await page.goto((process.env.TEST_BASE_URL||'http://localhost:3100')+'/?view=detail&doc=dummy-layout',{waitUntil:'networkidle0'});
  await page.waitForSelector('dl');
  assert(await page.$eval('dl',e=>!!e.getClientRects().length),'Document identity hidden');
  assert(await page.$('nav button[aria-current="page"]'),'Detail active navigation missing');
  results.push({width,height,...layout});
  console.log(`LAYOUT_VIEWPORT_PASS ${width}x${height}`);
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,kind:'Synthetic intercepted API; no database writes',results},null,2));
} finally {await browser.close();}
