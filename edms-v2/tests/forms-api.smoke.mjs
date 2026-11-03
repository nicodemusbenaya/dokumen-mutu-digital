// Smoke API form. Butuh `npm run dev:home` hidup. Jalankan: node tests/forms-api.smoke.mjs
// Opsional: BASE, EDMS_USER, EDMS_PASS. Membuat satu form DUMMY yang berakhir berstatus "closed".
import assert from 'node:assert/strict';
const BASE=process.env.BASE||'http://localhost:3100';
let cookie='';
async function api(path,{method='GET',body,auth=true,raw=false}={}){
 const r=await fetch(BASE+'/api/v2/'+path,{method,headers:{Origin:BASE,...(body!==undefined&&{'Content-Type':'application/json'}),...(auth&&cookie&&{Cookie:cookie})},body:body===undefined?undefined:JSON.stringify(body)});
 const set=r.headers.get('set-cookie');if(set&&auth)cookie=set.split(';')[0];
 return raw?r:{status:r.status,data:await r.json().catch(()=>null)};
}
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
assert.equal((await api('login',{method:'POST',body:{username:process.env.EDMS_USER||'user123',password:process.env.EDMS_PASS||'user123'}})).status,200,'login gagal');
const definition={schema:1,header:{code:'DUMMY-FORM-01'},fields:[{id:'nama',type:'text',label:'Nama DUMMY',required:true},{id:'ttd',type:'signature',label:'Pengawas DUMMY',required:true}]};
const created=await api('forms',{method:'POST',body:{title:'DUMMY Form Smoke '+Date.now(),definition}});assert.equal(created.status,201);
const fid=created.data.id;
let detail=await api('forms/'+fid);assert.equal(detail.data.status,'draft');
const token=detail.data.publicToken;
assert.equal((await api('public-forms/'+token,{auth:false})).status,404,'draf tidak boleh terbuka');
assert.equal((await api('forms/'+fid,{method:'PUT',body:{title:detail.data.title,access:'public',definition,expectedVersion:detail.data.lockVersion}})).status,200);
assert.equal((await api('forms/'+fid,{method:'PUT',body:{title:detail.data.title,access:'public',definition,expectedVersion:detail.data.lockVersion}})).status,409,'konflik versi harus 409');
assert.equal((await api('forms/'+fid+'/publish',{method:'POST',body:{}})).status,200);
const pub=await api('public-forms/'+token,{auth:false});
assert.equal((await api('forms/'+fid,{method:'PUT',body:null})).status,400,'body null harus 400');assert.equal(pub.status,200);assert.equal(pub.data.definition.fields.length,2);
const bad=await api('public-forms/'+token,{method:'POST',auth:false,body:{answers:{nama:''}}});assert.equal(bad.status,400);assert.ok(bad.data.fields.nama&&bad.data.fields.ttd);
for(let i=0;i<31;i++)assert.equal((await api('public-forms/'+token,{method:'POST',auth:false,body:{answers:{}}})).status,400,'kiriman tidak valid tidak boleh menghabiskan kuota');
const stale=await api('public-forms/'+token,{method:'POST',auth:false,body:{version:pub.data.version+99,answers:{nama:'DUMMY Pengisi',ttd:{name:'DUMMY',image:PNG}}}});assert.equal(stale.status,409,'versi lama harus 409');assert.equal(stale.data.versionChanged,true);
const sent=await api('public-forms/'+token,{method:'POST',auth:false,body:{version:pub.data.version,answers:{nama:'DUMMY Pengisi',ttd:{name:'DUMMY',image:PNG}}}});assert.equal(sent.status,201);
const list=await api('forms/'+fid+'/submissions');assert.equal(list.data.total,1);assert.equal(list.data.submissions[0].submitterLabel,'Anonim (link publik)');
assert.equal((await api('form-submissions/'+sent.data.id)).data.answers.ttd.name,'DUMMY');
const pr=await api('forms/'+fid+'/print');assert.ok(pr.data.submissions.length>=1);assert.ok(pr.data.submissions.every(x=>x.definition&&x.answers));
const xlsx=await api('forms/'+fid+'/export?format=xlsx',{raw:true});assert.equal(xlsx.status,200);assert.equal(Buffer.from(await xlsx.arrayBuffer()).subarray(0,2).toString(),'PK');
detail=await api('forms/'+fid);
assert.equal((await api('forms/'+fid,{method:'PUT',body:{title:detail.data.title,access:'login',definition,expectedVersion:detail.data.lockVersion}})).status,200);
const locked=await api('public-forms/'+token,{auth:false});assert.equal(locked.status,401);assert.equal(locked.data.loginRequired,true);
assert.equal((await api('public-forms/'+token,{method:'POST',auth:false,body:{answers:{nama:'X',ttd:{name:'X',image:PNG}}}})).status,401,'kiriman anonim ke form wajib login harus ditolak');
assert.equal((await api('public-forms/'+token)).status,200,'pengguna login boleh membuka');
assert.equal((await api('forms/'+fid,{method:'DELETE'})).status,409,'form berjawaban tidak boleh dihapus');
assert.equal((await api('form-submissions/'+sent.data.id,{method:'DELETE'})).status,200);
assert.equal((await api('forms/'+fid+'/submissions')).data.total,0);
assert.equal((await api('forms/'+fid+'/purge',{method:'POST',body:{dryRun:true}})).status,409,'purge ditolak selama form dipublish');
assert.equal((await api('forms/'+fid+'/close',{method:'POST',body:{}})).status,200);
assert.equal((await api('public-forms/'+token)).status,404,'form tertutup tidak tersedia');
// Hapus permanen: jawaban yang sudah disembunyikan ikut terhitung; tanpa konfirmasi ditolak; periode lain tidak tersentuh.
assert.equal((await api('forms/'+fid+'/purge',{method:'POST',body:{dryRun:true}})).data.count,1);
assert.equal((await api('forms/'+fid+'/purge',{method:'POST',body:{dryRun:true,from:'2000-01-01',to:'2000-01-31'}})).data.count,0);
assert.equal((await api('forms/'+fid+'/purge',{method:'POST',body:{from:'2026-13-01'}})).status,400,'tanggal tidak valid');
assert.equal((await api('forms/'+fid+'/purge',{method:'POST',body:{}})).status,400,'wajib ketik HAPUS');
const today=new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
assert.equal((await api('forms/'+fid+'/purge',{method:'POST',body:{from:today,to:today,confirm:'HAPUS'}})).data.deleted,1);
assert.equal((await api('forms/'+fid+'/purge',{method:'POST',body:{dryRun:true}})).data.count,0);
assert.equal((await api('forms/'+fid,{method:'DELETE'})).status,200,'form tanpa jawaban sisa boleh dihapus');
assert.equal((await api('forms',{auth:false})).status,401,'API kelola butuh login');
console.log('SMOKE OK — form DUMMY',fid,'(jawaban dihapus permanen, form dihapus)');
