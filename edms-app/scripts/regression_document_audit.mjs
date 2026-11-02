// Offline regression checks. No server connections or production mutations.
// Run: node scripts/regression_document_audit.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}

// Execute the real TS handlers with explicit database/session test doubles.
// These tests cover guards and responses, not MariaDB or browser integration.
function load(relative, mocks = {}, cache = new Map()) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, mocks, cache);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), `${name}.ts`)), mocks, cache);
    return require(name);
  };
  const testExports = file === path.join(root, 'src/lib/pdf.ts') ? '\nmodule.exports.testBuildContentHtml = buildContentHtml;' : '';
  new Function('require', 'module', 'exports', output + testExports)(localRequire, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}

const parser = load('src/lib/docParser.ts');
await test('new-document import assets are copied and rewritten on first save', async () => {
  const { adoptDraftImportAssets } = load('src/lib/importAssets.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edms-import-'));
  const folder = 'import-12345678-1234-1234-1234-123456789abc';
  try {
    const source = path.join(dir, 'drafts', '5', folder);
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, '001.png'), 'test-image');
    const sections = { isi: `<img src="/uploads/media/drafts/5/${folder}/001.png" />` };
    const output = await adoptDraftImportAssets(sections, 5, 99, dir);
    assert.match(output.isi, /\/uploads\/media\/99\//);
    assert.equal(fs.readFileSync(path.join(dir, '99', folder, '001.png'), 'utf8'), 'test-image');
    assert.match(sections.isi, /drafts\/5/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
const auth = {
  getSessionFromRequest: async () => null,
  unauthorized: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
  forbidden: () => Response.json({ error: 'Forbidden' }, { status: 403 }),
};
const noDb = { query: async () => { throw new Error('Unexpected database access'); } };
const params = { params: Promise.resolve({ id: '1' }) };
const request = (body, method = 'POST') => new Request('http://example.test/api/documents/1', {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

for (const file of walk(path.join(root, 'src/app/api')).filter(f => f.endsWith('route.ts') && !f.includes(`${path.sep}auth${path.sep}`))) {
  const route = load(path.relative(root, file), { '@/lib/auth': auth, '@/lib/db': noDb });
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    if (!route[method]) continue;
    await test(`${method} ${path.relative(path.join(root, 'src/app/api'), file)} requires login`, async () => {
      const response = await route[method](request({}, method === 'GET' ? 'POST' : method), params);
      assert.equal(response.status, 401);
    });
  }
}

const admin = { id: 5, role: 'Admin Sistem', fullName: 'Test Admin' };
const adminAuth = { ...auth, getSessionFromRequest: async () => admin };
const noAudit = { addAuditLog: async () => {} };
await test('delete refuses an active document without issuing DELETE', async () => {
  const route = load('src/app/api/documents/[id]/route.ts', {
    '@/lib/auth': adminAuth, '@/lib/audit': noAudit,
    '@/lib/db': { query: async sql => { assert.match(sql, /^SELECT/); return [{ status: 'Aktif', kode: 'TEST' }]; } },
  });
  assert.equal((await route.DELETE(request({}), params)).status, 409);
});
await test('bulk delete skips an active document', async () => {
  const route = load('src/app/api/documents/bulk/route.ts', {
    '@/lib/auth': adminAuth, '@/lib/audit': noAudit,
    '@/lib/db': { query: async sql => { assert.match(sql, /^SELECT/); return [{ id: 1, status: 'Aktif', kode: 'TEST' }]; } },
  });
  const result = await (await route.POST(request({ action: 'delete', ids: [1] }))).json();
  assert.match(JSON.stringify(result), /Obsolete/);
});
await test('submit rejects metadata-only documents', async () => {
  const route = load('src/app/api/documents/[id]/submit/route.ts', {
    '@/lib/auth': adminAuth, '@/lib/audit': noAudit,
    '@/lib/db': { query: async sql => sql.includes('document_sections')
      ? [{ section_key: '_section_order', content: '[{"key":"isi"}]' }]
      : [{ status: 'Draft', jenis: 'Formulir Kerja', penyusun_id: 5 }] },
  });
  assert.equal((await route.POST(request({}), params)).status, 422);
});
await test('save catches a version change inside the transaction', async () => {
  const route = load('src/app/api/documents/[id]/route.ts', {
    '@/lib/auth': adminAuth, '@/lib/audit': noAudit,
    '@/lib/db': {
      query: async () => [{ status: 'Draft', version_number: 1, penyusun_id: 5 }],
      withTransaction: async fn => fn({ execute: async sql => {
        assert.match(sql, /FOR UPDATE/);
        return [[{ status: 'Draft', version_number: 2, penyusun_id: 5 }]];
      } }),
    },
  });
  assert.equal((await route.PUT(request({ versionNumber: 1 }), params)).status, 409);
});
await test('single-file import refuses reviewer role', async () => {
  const route = load('src/app/api/documents/import/route.ts', {
    '@/lib/auth': { ...auth, getSessionFromRequest: async () => ({ id: 2, role: 'Tim Mutu' }) }, '@/lib/db': noDb,
  });
  assert.equal((await route.POST(request({}))).status, 403);
});
await test('reference linking refuses a role without document edit permission', async () => {
  const route = load('src/app/api/references/[id]/route.ts', {
    '@/lib/auth': { ...auth, getSessionFromRequest: async () => ({ id: 2, role: 'Tim Mutu' }) }, '@/lib/db': noDb,
  });
  assert.equal((await route.POST(request({ documentId: 1 }), params)).status, 403);
});

await test('PDF keeps preamble and a visual approval sheet', async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('LEMBAR PENGESAHAN\nDisahkan Oleh: Test\nDokumen awal', { x: 40, y: 750, font, size: 12 });
  pdf.addPage().drawText('TUJUAN\nTujuan utama\nRUANG LINGKUP\nLingkup internal', { x: 40, y: 750, font, size: 12 });
  const parsed = await parser.parsePdfBuffer(Buffer.from(await pdf.save()), { fileName: 'PR.TEST-00 Test.pdf' });
  assert.match(parsed.sections.bagian_awal, /Dokumen awal/);
  assert.match(parsed.sections.tujuan, /Tujuan utama/);
  assert.match(parsed.sections.pengesahan_asli, /@@IMG:1@@/);
  assert.equal(parsed.assets.length, 1);
  assert.equal(parsed.sectionOrder[0].key, 'pengesahan_asli');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edms-parser-'));
  try {
    const materialized = await parser.materializeParsedAssets(parsed, dir, '/uploads/media/test');
    assert.match(materialized.sections.pengesahan_asli, /\/uploads\/media\/test\/001.png/);
    assert.equal(fs.readFileSync(path.join(dir, '001.png')).subarray(1, 4).toString(), 'PNG');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

await test('PDF output retains original approval instead of a blank synthesized sheet', async () => {
  const pdf = load('src/lib/pdf.ts');
  const html = pdf.testBuildContentHtml({
    kode: 'TEST', judul: 'Test', jenis: 'SOP/Prosedur', versi: '1.0', status: 'Aktif', bidang: 'Test',
    updatedAt: '2026-10-22', penyusun: 'Test', refs: [], versions: [],
    mgrSignature: null, pimpinanSignature: null,
    sections: {
      pengesahan_asli: '<img src="/uploads/media/test/001.png" />',
      _section_order: JSON.stringify([{ key: 'pengesahan_asli', title: 'Lembar Pengesahan Asli', isCustom: true }]),
    },
  });
  assert.match(html, /src="\/uploads\/media\/test\/001.png"/);
  assert.ok(!html.includes('<div class="pengesahan-page">'));
});

await test('real scanned approval page survives parsing without OCR', async () => {
  const sourceRoot = path.resolve(root, '../Dokumen Final');
  const source = walk(sourceRoot).find(file => path.basename(file).startsWith('PR.UPS.SER3.BMK.01-02') && file.endsWith('.pdf'));
  assert.ok(source, 'Scanned regression source must be available');
  const original = await PDFDocument.load(fs.readFileSync(source));
  const subset = await PDFDocument.create();
  const [page] = await subset.copyPages(original, [1]);
  subset.addPage(page);
  const parsed = await parser.parsePdfBuffer(Buffer.from(await subset.save()));
  assert.match(parsed.sections.halaman_scan_asli, /@@IMG:1@@/);
  assert.equal(parsed.assets.length, 1);
  assert.ok(parsed.warnings.some(w => w.includes('scan')));
  const dir = path.join(root, 'tmp/pdfs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'approval-regression.png'), parsed.assets[0].data);
});
console.log(`\n${passed} offline checks passed. Browser and NAS integration are not covered.`);
