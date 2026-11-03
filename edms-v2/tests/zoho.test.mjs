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
 assert.throws(()=>csvEntries('Nama,Nama\nA,B'));
});
