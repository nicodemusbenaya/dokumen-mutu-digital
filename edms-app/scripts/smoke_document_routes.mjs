// Memeriksa route aksi dokumen tanpa login dan tanpa mengubah data.
// Jalankan terhadap server lokal: node scripts/smoke_document_routes.mjs
// Route yang tersedia wajib mengembalikan 401 JSON, bukan halaman HTML 404.
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://localhost:3000';
for (const [action, method] of [
  ['template', 'POST'],
  ['template', 'DELETE'],
  ['revise', 'POST'],
]) {
  const route = `/api/documents/1/${action}`;
  const res = await fetch(new URL(route, base), { method, redirect: 'manual' });
  assert.equal(res.status, 401, `${method} ${route}: route tidak tersedia atau guard login berubah`);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
  console.log(`PASS ${method} ${route}: tersedia dan dilindungi login`);
}
