import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDefinition,validateAnswers,canManage,publicToken} from '../src/lib/forms.mjs';
const PNG_HEAD=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const PNG='data:image/png;base64,'+(()=>{const b=Buffer.concat([PNG_HEAD,Buffer.alloc(20)]);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(600,16);b.writeUInt32BE(200,20);return b;})().toString('base64');
const def={schema:1,fields:[
 {id:'h',type:'heading',label:'A. DUMMY'},
 {id:'nama',type:'text',label:'Nama',required:true},
 {id:'tgl',type:'date',label:'Tanggal'},
 {id:'jam',type:'time',label:'Waktu',range:true},
 {id:'mode',type:'radio',label:'Mode',options:['Luring','Daring'],other:true},
 {id:'metode',type:'checkbox',label:'Metode',options:['Tulis','Lisan']},
 {id:'cek',type:'grid',label:'Ceklis',required:true,fixedColumns:['Item'],choice:{label:'Jawaban',options:['Ya','Tidak','N/A']},remark:'Keterangan',groups:[{title:'A',rows:[{id:'r1',cells:['Item 1']},{id:'r2',cells:['Jumlah: ......'],blank:true}]}]},
 {id:'log',type:'table',label:'Log',columns:[{id:'nm',label:'Nama'},{id:'out',label:'Keluar',type:'time'},{id:'k',label:'Konflik',type:'radio',options:['Ya','Tidak']}],maxRows:2},
 {id:'ttd',type:'signature',label:'Pengawas',required:true}]};
const ok={nama:'DUMMY Pengawas',tgl:'2026-11-02',jam:{from:'08:00',to:'09:30'},mode:{value:'__other',other:'Hybrid'},metode:{values:['Tulis','Tulis']},cek:{r1:{choice:'Ya'},r2:{choice:'N/A',blank:'3'}},log:[{nm:'DUMMY A',out:'10:00',k:'Tidak'},{}],ttd:{name:'DUMMY',image:PNG},asing:'x'};
const fieldsOf=fn=>{try{fn();}catch(e){return e.fields||{error:e.message};}assert.fail('seharusnya gagal');};

test('jawaban valid dibersihkan',()=>{
 const a=validateAnswers(validateDefinition(def),ok);
 assert.equal(a.asing,undefined);
 assert.deepEqual(a.metode,{values:['Tulis']});
 assert.equal(a.log.length,1);
 assert.equal(a.ttd.name,'DUMMY');
 assert.ok(a.ttd.signedAt);
 assert.equal(a.cek.r2.blank,'3');
 assert.deepEqual(a.mode,{value:'__other',other:'Hybrid'});
});
test('field wajib',()=>{const f=fieldsOf(()=>validateAnswers(def,{...ok,nama:'  ',ttd:undefined}));assert.ok(f.nama);assert.ok(f.ttd);});
test('opsi asing dan Lainnya',()=>{
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,mode:{value:'Hack'}})).mode);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,metode:{values:['__other'],other:'x'}})).metode);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,mode:{value:'__other',other:''}})).mode);
});
test('tanggal dan jam',()=>{
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,tgl:'2026-02-30'})).tgl);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,tgl:'02/11/2026'})).tgl);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,jam:{from:'25:00',to:'09:00'}})).jam);
});
test('grid wajib semua baris dan pilihan sah',()=>{
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,cek:{r1:{choice:'Ya'}}})).cek);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,cek:{r1:{choice:'Mungkin'},r2:{choice:'Ya'}}})).cek);
});
test('tabel maksimal baris dan pilihan kolom',()=>{
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,log:[{nm:'1'},{nm:'2'},{nm:'3'}]})).log);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,log:[{k:'Mungkin'}]})).log);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,log:'bukan array'})).log);
});
test('tanda tangan harus PNG, maksimal 200 KB, dan bernama',()=>{
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,ttd:{name:'X',image:'data:image/png;base64,'+Buffer.from('bukan png').toString('base64')}})).ttd);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,ttd:{name:'',image:PNG}})).ttd);
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,ttd:{name:'X',image:'data:image/jpeg;base64,AAAA'}})).ttd);
 const big='data:image/png;base64,'+Buffer.concat([PNG_HEAD,Buffer.alloc(210000)]).toString('base64');
 assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,ttd:{name:'X',image:big}})).ttd);
});
test('teks terlalu panjang',()=>{assert.ok(fieldsOf(()=>validateAnswers(def,{...ok,nama:'x'.repeat(501)})).nama);});
test('answers bukan objek dianggap kosong',()=>{const f=fieldsOf(()=>validateAnswers(def,'x'));assert.ok(f.nama&&f.cek&&f.ttd);});
test('validateDefinition menolak definisi rusak',()=>{
 for(const bad of [null,{fields:[]},{fields:[{id:'a',type:'aneh',label:'x'}]},{fields:[{id:'a',type:'text',label:'x'},{id:'a',type:'text',label:'y'}]},{fields:[{id:'a b',type:'text',label:'x'}]},{fields:[{id:'a',type:'text',label:''}]},{fields:[{id:'a',type:'static'}]},{fields:[{id:'a',type:'radio',label:'x',options:[]}]},{fields:[{id:'a',type:'grid',label:'x',fixedColumns:['Item'],choice:{options:['Ya']},groups:[{rows:[]}]}]},{fields:[{id:'a',type:'grid',label:'x',fixedColumns:['Item'],choice:{options:['Ya']},groups:[{rows:[{id:'r',cells:[]},{id:'r',cells:[]}]}]}]},{fields:[{id:'a',type:'table',label:'x',columns:[]}]}])
  assert.throws(()=>validateDefinition(bad));
 assert.throws(()=>validateDefinition({fields:[{id:'a',type:'static',text:'x'.repeat(1048577)}]}),e=>e.status===413||e.status===400);
});
test('canManage',()=>{
 assert.ok(canManage({role:'Super user'},{department:null}));
 assert.ok(!canManage({role:'Editor',bidang:'Bidang A'},{department:null}));
 assert.ok(canManage({role:'Editor',bidang:'Bidang A'},{department:'Bidang A'}));
 assert.ok(!canManage({role:'Editor',bidang:'Bidang A'},{department:'Bidang B'}));
 assert.ok(!canManage({role:'Editor',bidang:''},{department:'Bidang A'}));
 assert.ok(!canManage({role:'Viewer',bidang:'Bidang A'},{department:'Bidang A'}));
});
test('publicToken 32 hex dan unik',()=>{const a=publicToken(),b=publicToken();assert.match(a,/^[a-f0-9]{32}$/);assert.notEqual(a,b);});
import JSZip from 'jszip';
import {flatten,toXlsx} from '../src/lib/form-export.mjs';
test('flatten: grid, tabel, tanda tangan, Lainnya, gabungan versi',()=>{
 const v1={schema:1,fields:[{id:'lama',type:'text',label:'Field Lama'},{id:'nama',type:'text',label:'Nama'}]};
 const v2={schema:1,fields:[{id:'h',type:'heading',label:'A. Bagian'},{id:'nama',type:'text',label:'Nama Lengkap'},{id:'cek',type:'grid',label:'Ceklis',fixedColumns:['Item'],choice:{label:'Jawaban',options:['Ya','Tidak']},remark:'Keterangan',groups:[{title:'A.',rows:[{id:'r1',cells:['Segel utuh; jumlah: ......'],blank:true}]}]},{id:'log',type:'table',label:'Log',columns:[{id:'a',label:'Nama'},{id:'b',label:'Jam'}]},{id:'ttd',type:'signature',label:'Pengawas'},{id:'m',type:'checkbox',label:'Metode',options:['Tulis'],other:true},{id:'w',type:'time',label:'Waktu',range:true}]};
 const t=flatten(new Map([[1,v1],[2,v2]]),[
  {id:'s1',formVersion:1,submitterLabel:'Anonim (link publik)',flagged:0,createdAt:'2026-11-02 08:00:00',answers:{lama:'x',nama:'DUMMY 1'}},
  {id:'s2',formVersion:2,submitterLabel:'DUMMY',flagged:1,createdAt:'2026-11-02 09:00:00',answers:{nama:'DUMMY 2',cek:{r1:{choice:'Ya',blank:'3',remark:'ok'}},log:[{a:'X',b:'10:00'},{a:'Y'}],ttd:{name:'DUMMY',image:'data:image/png;base64,AA'},m:{values:['Tulis','__other'],other:'Lisan'},w:{from:'08:00',to:'09:30'}}}]);
 const h=t[0];
 assert.deepEqual(h.slice(0,6),['Waktu Kirim','ID Jawaban','Pengisi','Versi Form','Ditandai','Nama Lengkap']);
 assert.ok(!h.includes('A. Bagian'));
 assert.ok(h.indexOf('Field Lama')>h.indexOf('Waktu'));
 const row=i=>Object.fromEntries(h.map((k,j)=>[k,t[i][j]]));
 assert.equal(row(1)['Field Lama'],'x');
 assert.equal(row(1)['Nama Lengkap'],'DUMMY 1');
 assert.equal(row(2)['A. 1. Segel utuh; jumlah: ...... — Jawaban'],'Ya');
 assert.equal(row(2)['A. 1. Segel utuh; jumlah: ...... — Keterangan'],'3; ok');
 assert.equal(row(2)['Log'],'X | 10:00\nY | ');
 assert.equal(row(2)['Pengawas — Nama'],'DUMMY');
 assert.equal(row(2)['Pengawas — Tanda tangan'],'Ditandatangani');
 assert.equal(row(2)['Metode'],'Tulis; Lainnya: Lisan');
 assert.equal(row(2)['Waktu'],'08:00–09:30');
 assert.equal(row(2)['Ditandai'],'Ya');
 assert.equal(row(1)['Ditandai'],'');
});
test('XLSX: zip valid berisi sheet dengan teks ter-escape',async()=>{
 const buf=await toXlsx([['Nama','Catatan'],['DUMMY & <A>','=SUM(1)']]);
 assert.equal(buf.subarray(0,2).toString(),'PK');
 const zip=await JSZip.loadAsync(buf);
 const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.ok(sheet.includes('DUMMY &amp; &lt;A&gt;'));
 assert.ok(sheet.includes('t="inlineStr"'));
 for(const p of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml'])assert.ok(zip.file(p),p);
});
import {importDocx} from '../src/lib/form-import.mjs';
const wp=(t,bold)=>`<w:p>${bold?'<w:pPr><w:rPr><w:b/></w:rPr></w:pPr>':''}<w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const wtbl=rows=>`<w:tbl><w:tblPr/>${rows.map(r=>`<w:tr><w:trPr/>${r.map(c=>`<w:tc><w:tcPr/>${c.split('\n').map(x=>wp(x)).join('')}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
async function dummyDocx(body){const z=new JSZip();z.file('[Content_Types].xml','<Types/>');z.file('word/document.xml',`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);return z.generateAsync({type:'nodebuffer'});}
test('impor docx DUMMY menjadi draf form',async()=>{
 const buf=await dummyDocx([wp('DUMMY CEKLIS UJI',true),wp('FR.DUMMY.2026.01-00'),
  wtbl([['Skema',':','..........'],['Mode Uji',':','□ Luring □ Daring □ Lainnya: ....'],['Hari/Tanggal',':','..........'],['Waktu Kejadian',':','...... s.d. ...... WIB']]),
  wp('A. PERSIAPAN'),
  wtbl([['No.','Item','Ya','Tidak','N/A','Keterangan'],['A. PERSIAPAN'],['1','Surat tugas &amp; ID diterima','','','',''],['2','Jumlah paket: ......','','','','']]),
  wtbl([['No.','Mode','Potensi','Penerapan (Ya/Tidak/NA)'],['1','Luring','Perjokian',''],['2','Daring','Akses AI','']]),
  wtbl([['F. LOG IZIN No.','Nama Peserta','Jam Keluar','Paraf'],['1','','',''],['2','','','']]),
  wtbl([['...., ...... 20.... Pengawas\n(..........)','Asesor\n(..........)']]),
  wp('Kronologi Kejadian:'),
  wp('Catatan DUMMY penutup.')].join(''));
 const {title,definition}=await importDocx(buf);
 const {validateDefinition}=await import('../src/lib/forms.mjs');
 validateDefinition(definition);
 assert.equal(title,'DUMMY CEKLIS UJI');
 assert.equal(definition.header.code,'FR.DUMMY.2026.01-00');
 const by=t=>definition.fields.filter(f=>f.type===t),named=l=>definition.fields.find(f=>f.label===l);
 assert.equal(named('Skema').type,'text');
 assert.equal(named('Hari/Tanggal').type,'date');
 assert.equal(named('Waktu Kejadian').type,'time');
 assert.equal(named('Waktu Kejadian').range,true);
 const mode=named('Mode Uji');assert.equal(mode.type,'checkbox');assert.deepEqual(mode.options,['Luring','Daring']);assert.equal(mode.other,true);
 assert.ok(by('heading').some(f=>f.label==='A. PERSIAPAN'));
 const [g,m]=by('grid');
 assert.deepEqual(g.choice.options,['Ya','Tidak','N/A']);assert.equal(g.remark,'Keterangan');assert.deepEqual(g.fixedColumns,['Item']);
 assert.equal(g.groups[0].title,'A. PERSIAPAN');assert.equal(g.groups[0].rows.length,2);
 assert.equal(g.groups[0].rows[0].cells[0],'Surat tugas & ID diterima');assert.equal(g.groups[0].rows[1].blank,true);
 assert.deepEqual(m.fixedColumns,['Mode','Potensi']);assert.deepEqual(m.choice,{label:'Penerapan',options:['Ya','Tidak','NA']});assert.equal(m.groups[0].rows.length,2);
 const t=by('table')[0];assert.deepEqual(t.columns.map(c=>c.label),['Nama Peserta','Jam Keluar','Paraf']);assert.equal(t.columns[1].type,'time');assert.equal(t.maxRows,10);
 assert.deepEqual(by('signature').map(f=>f.label),['Pengawas','Asesor']);
 assert.equal(named('Kronologi Kejadian').type,'textarea');
 assert.ok(by('static').some(f=>f.text.includes('Catatan DUMMY')));
});
test('impor menolak file bukan docx',async()=>{
 await assert.rejects(importDocx(Buffer.from('bukan zip')),/Word/);
 const z=new JSZip();z.file('a.txt','x');
 await assert.rejects(importDocx(await z.generateAsync({type:'nodebuffer'})),/Word/);
 await assert.rejects(importDocx(await dummyDocx('')),/dikenali/);
});
import fs from 'node:fs/promises';
test('4 template form sama dengan Zoho Forms (plnups)',async()=>{
 const dir=new URL('../scripts/form-templates/',import.meta.url);
 const files=(await fs.readdir(dir)).filter(n=>n.endsWith('.json')).sort();
 assert.deepEqual(files,['berita-acara-kecurangan.json','ceklis-pengawasan.json','kode-etik-deklarasi.json','matriks-potensi-kecurangan.json']);
 const t=Object.fromEntries(await Promise.all(files.map(async n=>[n.replace('.json',''),JSON.parse(await fs.readFile(new URL(n,dir),'utf8'))])));
 for(const v of Object.values(t))validateDefinition(v.definition);
 const F=n=>t[n].definition.fields,get=(n,id)=>F(n).find(f=>f.id===id);
 const grids=n=>F(n).filter(f=>f.type==='grid');
 const sigs=n=>F(n).filter(f=>f.type==='signature').map(f=>f.label);
 assert.equal(t['ceklis-pengawasan'].title,'FR.UPS.2026.BST.01.01-00 Ceklis Pengawasan Pelaksanaan Uji Kompetensi');
 assert.equal(t['berita-acara-kecurangan'].title,'FR.UPS.2026.BST.01.02-00 Berita Acara Kejadian/Dugaan Kecurangan');
 assert.equal(t['matriks-potensi-kecurangan'].title,'FR.UPS.2026.BST.01.03-00 Matriks Potensi Kecurangan dan Pengendaliannya');
 assert.equal(t['kode-etik-deklarasi'].title,'Kode Etik & Deklarasi Ketidakberpihakan');
 // Ceklis: satu grid per bagian A–E (6,5,5,7,5); butir D8 jadi pilihan Ada/Tidak dengan isian bersyarat.
 assert.deepEqual(grids('ceklis-pengawasan').map(g=>g.groups[0].rows.length),[6,5,5,7,5]);
 assert.deepEqual(get('ceklis-pengawasan','kejadian').options,['Ada','Tidak']);
 assert.deepEqual(['no_ba','peserta_dikeluarkan'].map(id=>get('ceklis-pengawasan',id).showIf),[{field:'kejadian',anyOf:['Ada']},{field:'kejadian',anyOf:['Ada']}]);
 assert.deepEqual(['jumlah_paket','peserta_hadir','peserta_terdaftar'].map(id=>get('ceklis-pengawasan',id).format),['number','number','number']);
 assert.deepEqual(get('ceklis-pengawasan','log_izin').columns.map(c=>c.label),['Nama Peserta/No. Meja','Jam Keluar','Jam Masuk','Diparaf Pengawas']);
 assert.deepEqual(sigs('ceklis-pengawasan'),['Tanda tangan Pengawas','Tanda tangan Asesor/Ketua Tim Uji']);
 // Berita Acara: metode berupa centang, sanksi tampil sesuai peran terlapor.
 assert.equal(get('berita-acara-kecurangan','metode').type,'checkbox');
 assert.equal(get('berita-acara-kecurangan','jenis').options.length,10);assert.equal(get('berita-acara-kecurangan','jenis').other,true);
 assert.deepEqual(get('berita-acara-kecurangan','sanksi_peserta').showIf,{field:'peran',anyOf:['Peserta']});
 assert.deepEqual(get('berita-acara-kecurangan','lama_penundaan').showIf,{field:'sanksi_personil',anyOf:['Penundaan penugasan']});
 assert.deepEqual(sigs('berita-acara-kecurangan'),['Tanda tangan Peserta','Tanda tangan Pengawas','Tanda tangan Saksi','Tanda tangan Asesor/Ketua Tim Uji']);
 // Matriks: 27 baris terbagi 4 kelompok mode, nomor asli dipertahankan.
 const m=grids('matriks-potensi-kecurangan');
 assert.deepEqual(m.map(g=>g.groups[0].rows.map(r=>r.no).join(',')),['1,2,3,4,5,6,7,11,14','8,9,10,12,13','15,16,17,18,19,20,21','22,23,24,25,26,27']);
 assert.ok(m.every(g=>g.choice.options.join()==='Ya,Tidak,NA'&&g.groups[0].rows.every(r=>r.cells.length===4&&r.cells.every(c=>c.trim()))));
 assert.deepEqual(sigs('matriks-potensi-kecurangan'),['Tanda tangan Pengawas','Tanda tangan Asesor','Tanda tangan MAN PSA']);
 // Kode Etik: email, persetujuan wajib, bagian D/Lampiran 6.3 hanya untuk penguji/pengawas/penyusun/validator.
 assert.equal(get('kode-etik-deklarasi','email').format,'email');
 assert.equal(get('kode-etik-deklarasi','role').options.length,11);assert.equal(get('kode-etik-deklarasi','role').other,true);
 assert.ok(['setuju_kode','setuju_c','setuju_d'].every(id=>get('kode-etik-deklarasi',id).required));
 assert.equal(get('kode-etik-deklarasi','setuju_d').showIf.anyOf.length,4);
 assert.equal(grids('kode-etik-deklarasi')[0].groups[0].rows.length,10);
 assert.equal(get('kode-etik-deklarasi','daftar_kandidat').columns.length,8);
 assert.deepEqual(get('kode-etik-deklarasi','rincian').showIf,{field:'konflik',anyOf:['Ya']});
 assert.deepEqual(sigs('kode-etik-deklarasi'),['Tanda tangan yang menyatakan']);
});
import {textToRows,textToCols} from '../src/lib/form-ids.mjs';
test('ID baris/kolom tetap stabil saat baris dihapus/disisipkan (jawaban lama tidak bergeser)',()=>{
 const old=[{id:'a',cells:['A']},{id:'b',cells:['B']},{id:'c',cells:['C']}];
 assert.deepEqual(textToRows('A\nC',old).map(r=>r.id),['a','c']);
 const ins=textToRows('A\nX\nB',old);assert.equal(ins[0].id,'a');assert.equal(ins[2].id,'b');assert.ok(!['a','b','c'].includes(ins[1].id));
 const dup=textToRows('A\nA',old);assert.equal(dup[0].id,'a');assert.notEqual(dup[1].id,'a');
 assert.equal(textToRows('Jumlah: ......',[])[0].blank,true);
 const cols=textToCols('Jam | jam\nNama',[{id:'n',label:'Nama'},{id:'j',label:'Jam',type:'time'}]);
 assert.deepEqual(cols.map(c=>c.id),['j','n']);assert.equal(cols[0].type,'time');
});
test('flatten tidak crash bila jenis field berubah antar versi',()=>{
 const v1={schema:1,fields:[{id:'x',type:'checkbox',label:'X',options:['A']},{id:'g',type:'text',label:'G'}]};
 const v2={schema:1,fields:[{id:'x',type:'text',label:'X'},{id:'g',type:'grid',label:'G',fixedColumns:['I'],choice:{label:'J',options:['Ya']},groups:[{rows:[{id:'r1',cells:['I1']}]}]}]};
 const t=flatten(new Map([[1,v1],[2,v2]]),[{id:'s',formVersion:1,submitterLabel:'D',flagged:0,createdAt:'2026-11-02 08:00:00',answers:{x:{values:['A']},g:'teks lama'}}]);
 const t2=flatten(new Map([[1,v2],[2,v1]]),[{id:'s',formVersion:1,submitterLabel:'D',flagged:0,createdAt:'2026-11-02 08:00:00',answers:{x:'teks',g:{r1:{choice:'Ya'}}}}]);
 assert.equal(t2.length,2);
 const t3=flatten(new Map([[1,{schema:1,fields:[{id:'y',type:'text',label:'Y'}]}],[2,{schema:1,fields:[{id:'y',type:'table',label:'Y',columns:[{id:'a',label:'A'}]},{id:'z',type:'radio',label:'Z',options:['A']}]}]]),[{id:'s',formVersion:1,submitterLabel:'D',flagged:0,createdAt:'x',answers:{y:'lama',z:'lama'}}]);
 assert.equal(t3.length,2);
 assert.equal(t.length,2);
});
test('impor menolak zip bomb walau header ukuran dipalsukan',async()=>{
 const z=new JSZip();z.file('word/document.xml','<w:body>'+'a'.repeat(12*1024*1024)+'</w:body>');
 const buf=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 // palsukan ukuran tak terkompresi (local header offset 22, central directory offset 24) menjadi 100 byte
 for(let i=0;i<buf.length-4;i++){const sig=buf.readUInt32LE(i);if(sig===0x04034b50)buf.writeUInt32LE(100,i+22);else if(sig===0x02014b50)buf.writeUInt32LE(100,i+24);}
 await assert.rejects(importDocx(buf),e=>e.status===413);
});
test('validateDefinition menolak batas baris tabel tidak masuk akal dan opsi __other',()=>{
 const tbl=x=>({fields:[{id:'t',type:'table',label:'T',columns:[{id:'a',label:'A'}],...x}]});
 for(const bad of [tbl({maxRows:0}),tbl({maxRows:201}),tbl({minRows:-1}),tbl({minRows:5,maxRows:3}),tbl({maxRows:'x'}),{fields:[{id:'r',type:'radio',label:'R',options:['__other']}]}])assert.throws(()=>validateDefinition(bad));
 validateDefinition(tbl({minRows:0,maxRows:200}));validateDefinition(tbl({}));
});
test('tanda tangan PNG berdimensi raksasa ditolak (melindungi browser admin)',()=>{
 const png=(w,h)=>{const b=Buffer.concat([PNG_HEAD,Buffer.alloc(30)]);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return 'data:image/png;base64,'+b.toString('base64');};
 const one=img=>validateAnswers({fields:[{id:'s',type:'signature',label:'S',required:true}]},{s:{name:'DUMMY',image:img}});
 assert.throws(()=>one(png(50000,50000)),e=>!!e.fields?.s);
 assert.throws(()=>one(png(600,20000)),e=>!!e.fields?.s);
 assert.equal(one(png(600,200)).s.name,'DUMMY');
});
test('XLSX: potongan 32767 karakter tidak memecah pasangan surrogate dan karakter U+FFFE/U+FFFF dibuang',async()=>{
 const zip=await JSZip.loadAsync(await toXlsx([['A','B'],['a'.repeat(32766)+'😀z','x\uFFFEy\uFFFF']]));
 const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(sheet),'tidak boleh ada surrogate tunggal');
 assert.ok(!/[\uFFFE\uFFFF]/.test(sheet));
 assert.ok(sheet.includes('>xy<'));
});

test('format email/angka, kolom tabel wajib, dan syarat tampil (pola form Zoho)',()=>{
 const d=validateDefinition({schema:1,fields:[
  {id:'email',type:'text',label:'Email',format:'email',required:true},
  {id:'jumlah',type:'text',label:'Jumlah',format:'number'},
  {id:'peran',type:'radio',label:'Peran',required:true,options:['Peserta','Asesor']},
  {id:'sanksi',type:'radio',label:'Sanksi',required:true,options:['Teguran','Penundaan'],showIf:{field:'peran',anyOf:['Asesor']}},
  {id:'lama',type:'text',label:'Lama',format:'number',required:true,showIf:{field:'sanksi',anyOf:['Penundaan']}},
  {id:'cek',type:'grid',label:'E',fixedColumns:['Item'],choice:{label:'J',options:['Ya','Tidak']},groups:[{rows:[{id:'k1',cells:['DUMMY']}]}]},
  {id:'rinci',type:'table',label:'F',required:true,showIf:{field:'cek',anyOf:['Ya']},columns:[{id:'pihak',label:'Pihak',required:true},{id:'ket',label:'Ket'}]}]});
 // Field tersembunyi tidak wajib dan jawabannya dibuang.
 assert.deepEqual(validateAnswers(d,{email:'dummy@test.local',jumlah:'3',peran:{value:'Peserta'},sanksi:{value:'Teguran'},cek:{k1:{choice:'Tidak'}}}),{email:'dummy@test.local',jumlah:'3',peran:{value:'Peserta'},cek:{k1:{choice:'Tidak'}}});
 const e=fieldsOf(()=>validateAnswers(d,{email:'bukan-email',jumlah:'tiga',peran:{value:'Asesor'},sanksi:{value:'Penundaan'},cek:{k1:{choice:'Ya'}},rinci:[{ket:'tanpa pihak'}]}));
 assert.deepEqual(Object.keys(e).sort(),['email','jumlah','lama','rinci']);
 assert.throws(()=>validateDefinition({fields:[{id:'a',type:'text',label:'A',showIf:{field:'b',anyOf:['x']}},{id:'b',type:'radio',label:'B',options:['x']}]}),/syarat tampil/);
 assert.throws(()=>validateDefinition({fields:[{id:'a',type:'date',label:'A',format:'email'}]}),/format/);
});
