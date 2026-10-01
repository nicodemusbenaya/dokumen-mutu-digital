// Smoke test fitur Template Dokumen terhadap server yang berjalan.
// Pemakaian:
//   node scripts/smoke_template.mjs                          # localhost:3000, storage lokal
//   BASE_URL=http://10.10.200.166:3000 STORAGE_ROOT='\\10.10.200.166\Container\edms-data' \
//     node scripts/smoke_template.mjs                        # server NAS (storage = volume edms-data)
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage');
const USER = process.env.SMOKE_USER || 'admin';
const PASS = process.env.SMOKE_PASS || 'edms2026';
const jar = new Map();

function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}
function absorb(res) {
  let setCookies = [];
  try { setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : []; } catch {}
  if (!setCookies.length) {
    const single = res.headers.get('set-cookie');
    if (single) setCookies = [single];
  }
  for (const c of setCookies) {
    const kv = c.split(';')[0];
    const i = kv.indexOf('=');
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
  }
}
async function call(p, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (jar.size) headers.cookie = cookieHeader();
  const res = await fetch(BASE + p, { ...opts, headers, redirect: 'manual' });
  absorb(res);
  return res;
}
async function j(callRes) { return callRes.json().catch(() => ({})); }

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
}

// Visibility folder di share SMB bisa tertunda beberapa ratus ms setelah
// container menulisnya — poll dulu sebelum menyatakan gagal/hapus.
async function waitFor(p, ms = 6000) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (fs.existsSync(p)) return true; } catch {}
    if (Date.now() >= end) return false;
    await new Promise((r) => setTimeout(r, 400));
  }
}

const stamp = Date.now();
const KODE1 = `TEST.TPL.${stamp}-01`;
const KODE2 = `TEST.TPL.${stamp}-02`;
const KODE3 = `TEST.TPL.${stamp}-03`;
let createdIds = [];

async function cleanup() {
  if (!jar.size) {
    const re = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: USER, password: PASS }),
    });
    absorb(re);
  }
  for (const id of createdIds) {
    const res = await call(`/api/documents/${id}`, { method: 'DELETE' });
    console.log(`  cleanup doc ${id}: ${res.status}`);
    const dir = path.join(STORAGE_ROOT, 'media', String(id));
    try {
      if (fs.existsSync(dir) || await waitFor(dir, 3000)) fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) { console.log(`  cleanup media ${id}: ${e.message}`); }
  }
}

async function main() {
  const login = await call('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  check('login admin', login.status === 200, `base=${BASE} status=${login.status}`);
  if (login.status !== 200) return finish();

  // Register default mengecualikan template (178 total - 148 template = 30)
  const list = await j(await call('/api/documents?limit=1'));
  check('default exclude template (total=30)', list.total === 30, `total=${list.total}`);

  const tplList = await j(await call('/api/documents?isTemplate=1&limit=100'));
  const tpl0 = (tplList.data || [])[0] || {};
  check('isTemplate=1 total=148', tplList.total === 148, `total=${tplList.total}`);
  check('baris template ter-mapping', tpl0.isTemplate === true && typeof tpl0.sectionCount === 'number',
    `isTemplate=${tpl0.isTemplate} sectionCount=${tpl0.sectionCount}`);

  const all = await j(await call('/api/documents?limit=1&includeTemplates=1'));
  check('includeTemplates total=178', all.total === 178, `total=${all.total}`);

  const qExcl = await j(await call('/api/documents?status=Menunggu+Approval&limit=100'));
  const qIncl = await j(await call('/api/documents?status=Menunggu+Approval&limit=100&includeTemplates=1'));
  check('antrean include > exclude (template dalam siklus terlihat)',
    qIncl.total > qExcl.total, `excl=${qExcl.total} incl=${qIncl.total}`);

  const t183 = await j(await call('/api/documents/183'));
  check('detail 183 isTemplate=true', t183.data?.isTemplate === true, `status=${t183.data?.status}`);
  const tplSectionKeys = Object.keys(t183.data?.sections || {}).filter(k => k !== '_section_order');
  const tplRefs = (t183.data?.refs || []).length;
  const tplHasMedia = fs.existsSync(path.join(STORAGE_ROOT, 'media', '183'));
  const tplContentHasMedia = JSON.stringify(t183.data?.sections || {}).includes('/uploads/media/183/');

  const create1 = await call('/api/documents/from-template', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 183, kode: KODE1, judul: 'Uji Dokumen dari Template Smoke' }),
  });
  const create1Json = await j(create1);
  const id1 = create1Json.data?.id;
  if (id1) createdIds.push(id1);
  check('from-template 201', create1.status === 201, `status=${create1.status} id=${id1} ${create1Json.error || ''}`);
  if (!id1) return finish();

  const dup = await call('/api/documents/from-template', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 183, kode: KODE1, judul: 'Duplikat' }),
  });
  check('kode duplikat 409', dup.status === 409, `status=${dup.status}`);

  const d1 = await j(await call(`/api/documents/${id1}`));
  const doc = d1.data || {};
  const keys1 = Object.keys(doc.sections || {}).filter(k => k !== '_section_order');
  check('sections tersalin lengkap',
    keys1.length === tplSectionKeys.length && keys1.every(k => tplSectionKeys.includes(k)),
    `${keys1.length}/${tplSectionKeys.length}`);
  const contents = Object.values(doc.sections || {}).join('\n');
  check('URL media lama bersih', !contents.includes('/uploads/media/183/'), '');
  check('URL media baru mengarah ke id hasil',
    tplContentHasMedia ? contents.includes(`/uploads/media/${id1}/`) : true,
    `tplContentHasMedia=${tplContentHasMedia}`);
  check('status Draft + v1.0', doc.status === 'Draft' && doc.currentVersion === '1.0',
    `status=${doc.status} v=${doc.currentVersion}`);
  check('template_source_id tertanam', doc.isTemplate === false && Number(doc.templateSourceId) === 183,
    `isTemplate=${doc.isTemplate} src=${doc.templateSourceId}`);
  check('referensi tersalin', (doc.refs || []).length === tplRefs, `${(doc.refs || []).length}/${tplRefs}`);
  check('folder media ikut tersalin',
    tplHasMedia ? await waitFor(path.join(STORAGE_ROOT, 'media', String(id1))) : true,
    `tplHasMedia=${tplHasMedia}`);
  if (doc.kop_path) check('kop_path ter-rewrite', doc.kop_path.includes(`/uploads/media/${id1}/`), doc.kop_path);
  if (doc.source_path) check('source_path ter-rewrite', doc.source_path.includes(`/uploads/media/${id1}/`), doc.source_path);

  const afterCreate = await j(await call('/api/documents?limit=1'));
  check('dokumen hasil tidak menjadi template', afterCreate.total === 31, `total=${afterCreate.total}`);

  const flag = await call(`/api/documents/${id1}/template`, { method: 'POST' });
  check('POST flag template', flag.status === 200, `status=${flag.status}`);
  const exclAfterFlag = await j(await call('/api/documents?limit=1'));
  check('setelah diflag keluar dari register', exclAfterFlag.total === 30, `total=${exclAfterFlag.total}`);
  const dFlagged = await j(await call(`/api/documents/${id1}`));
  check('detail menandai isTemplate', dFlagged.data?.isTemplate === true, '');
  const unflag = await call(`/api/documents/${id1}/template`, { method: 'DELETE' });
  check('DELETE unflag template', unflag.status === 200, `status=${unflag.status}`);
  const exclAfterUnflag = await j(await call('/api/documents?limit=1'));
  check('setelah unflag kembali ke register', exclAfterUnflag.total === 31, `total=${exclAfterUnflag.total}`);

  const create2 = await call('/api/documents/from-template', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 193, kode: KODE2, judul: 'Uji dari Template Seed (tanpa media)' }),
  });
  const create2Json = await j(create2);
  const id2 = create2Json.data?.id;
  if (id2) createdIds.push(id2);
  check('from-template seed (tanpa media) 201', create2.status === 201, `status=${create2.status} id=${id2} ${create2Json.error || ''}`);
  if (id2) {
    const d2 = await j(await call(`/api/documents/${id2}`));
    const k2 = Object.keys(d2.data?.sections || {}).filter(k => k !== '_section_order');
    check('sections seed tersalin (8 seksi IK + order)', k2.length === 8, `sections=${k2.length}`);
  }

  // Template DENGAN referensi gambar inline (id=155)
  const t155 = await j(await call('/api/documents/155'));
  const tpl155HasRefs = JSON.stringify(t155.data?.sections || {}).includes('/uploads/media/155/');
  const create3 = await call('/api/documents/from-template', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 155, kode: KODE3, judul: 'Uji Rewrite Gambar Inline Smoke' }),
  });
  const create3Json = await j(create3);
  const id3 = create3Json.data?.id;
  if (id3) createdIds.push(id3);
  check('from-template 155 (dengan gambar) 201', create3.status === 201, `status=${create3.status} id=${id3} ${create3Json.error || ''}`);
  if (id3 && tpl155HasRefs) {
    const d3 = await j(await call(`/api/documents/${id3}`));
    const c3 = JSON.stringify(d3.data?.sections || {});
    check('rewrite gambar inline: referensi lama bersih', !c3.includes('/uploads/media/155/'), '');
    check('rewrite gambar inline: referensi baru tertanam', c3.includes(`/uploads/media/${id3}/`), '');
    check('folder media 155 ikut tersalin', await waitFor(path.join(STORAGE_ROOT, 'media', String(id3))), '');
  } else if (!tpl155HasRefs) {
    check('template 155 punya referensi media (prasyarat)', false, 'tidak ada refs');
  }

  // Halaman UI
  const page = await call('/templates');
  check('halaman /templates 200', page.status === 200, `status=${page.status}`);

  // Tanpa login -> 401 (tanpa memakai jar agar cleanup tetap login)
  const noauth = await fetch(BASE + '/api/documents?isTemplate=1', { redirect: 'manual' });
  check('isTemplate=1 tanpa login 401', noauth.status === 401, `status=${noauth.status}`);

  await finish();
}

async function finish() {
  await cleanup();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('ERROR', err);
  await cleanup().catch(() => {});
  process.exit(2);
});
