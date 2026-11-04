import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePayload,cell,columns} from '../src/lib/zoho.mjs';

test('payload JSON, urlencoded, multipart dan teks mentah', async()=>{
 assert.deepEqual(await parsePayload(Buffer.from('{"Nama":"DUMMY","Nilai":3}'),'application/json'),{Nama:'DUMMY',Nilai:3});
 assert.deepEqual(await parsePayload(Buffer.from('[1,2]'),'application/json'),{data:[1,2]});
 assert.deepEqual(await parsePayload(Buffer.from('Nama=DUMMY+TEST&Pilih=A&Pilih=B'),'application/x-www-form-urlencoded'),{Nama:'DUMMY TEST',Pilih:['A','B']});
 const fd=new FormData();fd.append('Nama','DUMMY');const r=new Response(fd);
 assert.deepEqual(await parsePayload(Buffer.from(await r.arrayBuffer()),r.headers.get('content-type')),{Nama:'DUMMY'});
 assert.deepEqual(await parsePayload(Buffer.from('halo'),'text/plain'),{_raw:'halo'});
 assert.deepEqual(await parsePayload(Buffer.from(''),''),{});
});
test('nilai bersarang diratakan dan kolom urut kemunculan', ()=>{
 assert.equal(cell({first:'A',last:'B'}),'first: A, last: B');
 assert.equal(cell([{x:1},null,'y']),'x: 1; y');
 assert.equal(cell(null),'');
 assert.deepEqual(columns([{payload:{a:1,b:2}},{payload:{c:3,a:4}}]),['a','b','c']);
});
test('kode form dan link Zoho', async()=>{
 const {slugify,zohoLink}=await import('../src/lib/zoho.mjs');
 assert.equal(slugify('FRUPS2026BST010300Matriks'),'frups2026bst010300matriks');
 assert.equal(slugify('Kode Etik & Deklarasi'),'kode-etik-deklarasi');
 assert.equal(slugify('***'),'form');
 assert.equal(zohoLink(''),null);
 assert.equal(zohoLink('https://forms.zoho.com/plnups/form/ABC'),'https://forms.zoho.com/plnups/form/ABC');
 for(const bad of ['http://forms.zoho.com/x','https://forms.zoho.com.evil.com/x','https://evil.com/x','javascript:alert(1)'])assert.throws(()=>zohoLink(bad));
});
test('CSV export Zoho: kutip, baris baru dalam sel, BOM, titik koma, Added Time', async()=>{
 const {parseCsv,csvEntries}=await import('../src/lib/zoho.mjs');
 assert.deepEqual(parseCsv('\uFEFFa,b\r\n"x, y","say ""hi""\nbaris 2"\r\n\r\n'),[['a','b'],['x, y','say "hi"\nbaris 2']]);
 assert.deepEqual(parseCsv('a;b\n1;2'),[['a','b'],['1','2']]);
 assert.throws(()=>parseCsv('a\n"tidak tertutup'));
 const e=csvEntries('Added Time,Nama,Catatan\n03-Nov-2026 02:05:00 PM,DUMMY A,\n,DUMMY B,ok\n');
 assert.equal(e.length,2);
 assert.deepEqual(e[0],{payload:{'Added Time':'03-Nov-2026 02:05:00 PM',Nama:'DUMMY A',Catatan:''},time:'2026-11-03 14:05:00'});
 assert.equal(e[1].time,null);
 assert.throws(()=>csvEntries('Nama\n'));
 assert.deepEqual(csvEntries('Nama,Nama\nA,B')[0].payload,{Nama:'A','Nama (2)':'B'});
});
test('CSV Zoho header dua baris: matriks datar, subform dari baris lanjutan', async()=>{
 const {csvEntries}=await import('../src/lib/zoho.mjs');
 const csv=['Nama,Konflik?,,Daftar Kandidat,,Added Time',',1. Keluarga,2. Kerja,Nama Kandidat,NIP,',
  'DUMMY A,Tidak,Ya,K1,11,03-Nov-2026 10:00:00',',,,K2,12,','DUMMY B,Ya,Tidak,,,02-Nov-2026 09:00:00'].join('\n');
 const e=csvEntries(csv);
 assert.equal(e.length,2);
 assert.deepEqual(e[0].payload,{Nama:'DUMMY A','1. Keluarga':'Tidak','2. Kerja':'Ya','Daftar Kandidat':[{'Nama Kandidat':'K1',NIP:'11'},{'Nama Kandidat':'K2',NIP:'12'}],'Added Time':'03-Nov-2026 10:00:00'});
 assert.deepEqual(e[1].payload['Daftar Kandidat'],[]);
 assert.equal(e[1].time,'2026-11-02 09:00:00');
});
test('rentang tanggal hapus per periode', async()=>{
 const {purgeRange}=await import('../src/lib/zoho.mjs');
 assert.deepEqual(purgeRange({}),{from:null,to:null,sql:'',args:[]});
 const r=purgeRange({from:'2026-11-01',to:'2026-11-03'});
 assert.equal(r.sql,' AND received_at>=? AND received_at<DATE_ADD(?,INTERVAL 1 DAY)');
 assert.deepEqual(r.args,['2026-11-01','2026-11-03']);
 assert.throws(()=>purgeRange({from:'2026-11-05',to:'2026-11-01'}));
 assert.throws(()=>purgeRange({from:"2026-11-01' OR 1=1"}));
});
