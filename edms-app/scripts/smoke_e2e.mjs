// Smoke test runtime: login → detail dokumen impor → unduh berkas sumber →
// validasi upload ditolak → generate PDF → halaman editor.
const BASE = 'http://localhost:3000';
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

async function call(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (jar.size) headers.cookie = cookieHeader();
  const res = await fetch(BASE + path, { ...opts, headers, redirect: 'manual' });
  absorb(res);
  return res;
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  // 1. Login
  const login = await call('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'edms2026' }),
  });
  const loginJson = await login.json().catch(() => ({}));
  check('login admin', login.status === 200 && !!jar.size, `status=${login.status} ${loginJson.message || loginJson.error || ''}`);
  if (login.status !== 200) return finish();

  // 2. Daftar dokumen (endpoint hidup)
  const list = await call('/api/documents?limit=100');
  const listJson = await list.json().catch(() => ({}));
  const docs = Array.isArray(listJson?.data) ? listJson.data : (listJson?.data?.documents || []);
  check('daftar dokumen', list.status === 200 && docs.length > 0, `status=${list.status} jumlah=${docs.length}`);

  const id = 2;

  // 3. Detail dokumen + sections
  const detail = await call(`/api/documents/${id}`);
  const detailJson = await detail.json().catch(() => ({}));
  const doc = detailJson?.data || {};
  const sections = doc.sections || {};
  const secCount = Object.keys(sections).filter(k => k !== '_section_order').length;
  check(`detail dokumen #${id}`, detail.status === 200 && secCount > 0, `status=${detail.status} sections=${secCount} judul=${doc.judul || ''}`);
  check('kop_path tersimpan', !!doc.kop_path, String(doc.kop_path || 'kosong'));
  check('source_ext tersimpan', !!doc.source_ext, String(doc.source_ext || 'kosong'));

  // 4. Unduh berkas sumber
  const src = await call(`/api/documents/${id}/source`);
  const buf = Buffer.from(await src.arrayBuffer());
  const cd = src.headers.get('content-disposition') || '';
  check('GET source (unduh)', src.status === 200 && buf.length > 1000, `status=${src.status} bytes=${buf.length} cd=${cd.slice(0, 60)}`);
  check('source = file .docx asli', buf.slice(0, 2).toString() === 'PK', `magic=${buf.slice(0, 4).toString('hex')}`);

  // 5. Validasi upload ditolak untuk ekstensi tak diizinkan (tanpa mutasi)
  const bad = await call(`/api/documents/${id}/source`, {
    method: 'PUT',
    body: (() => { const fd = new FormData(); fd.append('file', new Blob(['x'], { type: 'text/plain' }), 'malware.txt'); return fd; })(),
  });
  check('PUT source tolak .txt', bad.status === 400, `status=${bad.status}`);

  // 6. Validasi RBAC ditolak untuk user tanpa hak (viewer tidak ada → pakai token logout dulu? lewati)

  // 7. Generate PDF
  const pdf = await call(`/api/documents/${id}/pdf`, { method: 'POST' });
  const pdfJson = await pdf.json().catch(() => ({}));
  const url = pdfJson?.data?.url;
  check('POST pdf', pdf.status === 200 && !!url, `status=${pdf.status} url=${url || pdfJson.error || ''}`);

  if (url) {
    const file = await call(url);
    const pb = Buffer.from(await file.arrayBuffer());
    check('file PDF valid', file.status === 200 && pb.slice(0, 5).toString() === '%PDF-', `status=${file.status} bytes=${pb.length}`);
  }

  // 8. Halaman editor
  const page = await call(`/editor/${id}`);
  const html = await page.text();
  check('halaman /editor/[id]', page.status === 200 && html.length > 1000, `status=${page.status} bytes=${html.length}`);

  // 9. Sajian media (kop + gambar)
  if (doc.kop_path) {
    const kop = await call(doc.kop_path);
    const kopText = await kop.text();
    check('kop.html tersaji', kop.status === 200 && kopText.includes('<'), `status=${kop.status} bytes=${kopText.length}`);
  }

  finish();
}

function finish() {
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => { console.error('ERROR', err); process.exit(2); });
