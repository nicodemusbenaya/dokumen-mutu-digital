#!/usr/bin/env node
/**
 * Import seluruh berkas dari folder "Formulir Eksisting" ke database EDMS.
 *
 * Aturan:
 *   - 1 file = 1 dokumen (termasuk .xlsx/.pdf/.doc — disimpan sebagai berkas sumber
 *     tanpa seksi teks bila tidak bisa diekstrak).
 *   - Lampiran / berkas tanpa kode mendapat kode generik.
 *   - Tabrakan kode → suffix ".{EXT}" (versi .docx diprioritaskan).
 *   - Idempoten: kode yang sudah ada di database di-UPDATE, bukan di-INSERT ganda.
 *   - Setiap dokumen ditransaksikan; kegagalan satu file tidak menghentikan sisanya.
 *
 * Pemakaian:
 *   node scripts/import_formulir_eksisting.mjs              # dry-run (default)
 *   node scripts/import_formulir_eksisting.mjs --parse      # dry-run + ringkasan parse
 *   node scripts/import_formulir_eksisting.mjs --write      # eksekusi ke DB
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const DO_PARSE = WRITE || argv.includes('--parse');
const NO_BUILD = argv.includes('--no-build');

const SOURCE_ROOT = process.env.SOURCE_ROOT
  || path.join(path.dirname(appRoot), 'Dokumen Final', 'Dokumen Mutu Final (Pengesahan)_');
const MEDIA_ROOT = path.join(appRoot, 'storage', 'media');
const REPORT_DIR = path.join(appRoot, '.import-report');
const BUILD_DIR = path.join(__dirname, '.parser-build');

const PENYUSUN_ID = 5;            // admin / Administrator
const UPSERT_KODE = 'MAN.MUTU.UPS.2025.00';

const ALLOW_EXT = new Set(['.docx', '.pdf', '.xlsx', '.xls', '.doc', '.csv', '.rtf', '.odt']);
// Salinan PDF dari folder formulir diabaikan — sumber teksnya adalah berkas Word.
const SKIP_DIR = /Formulir Versi PDF/i;
const JENIS_ENUM = new Set([
  'SOP/Prosedur', 'Manual Mutu', 'Instruksi Kerja', 'Formulir Kerja',
  'Formulir Tambahan', 'BA Pemusnahan Rekaman', 'Pernyataan Kerahasiaan', 'Daftar Rekaman Mutu',
]);

// ─── util ─────────────────────────────────────────────────────────

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function buildParser() {
  if (NO_BUILD && fs.existsSync(path.join(BUILD_DIR, 'docParser.js'))) return;
  console.log('▸ Build parser (tsc)…');
  execFileSync(
    'npx tsc src/lib/docParser.ts src/lib/documentTypes.ts'
    + ' --outDir scripts/.parser-build --module commonjs --target es2021'
    + ' --esModuleInterop --skipLibCheck --declaration false',
    { cwd: appRoot, shell: true, stdio: 'inherit' }
  );
}

// Folder bidang dikenali pada SEMUA level (sumber impor bisa bersarang,
// mis. "Dokumen Mutu Final (Pengesahan)_\1. BMK - …\…"), bukan hanya level pertama.
function bidangFolderOf(relParts) {
  for (const p of relParts) {
    if (/^0\.\s*MM/.test(p)) return 'MM';
    if (/^1\.\s*BMK/.test(p)) return 'BMK';
    if (/^2\.\s*BMA/.test(p)) return 'BMA';
    if (/^3\.\s*BST/.test(p)) return 'BST';
  }
  return '';
}

function bidangOf(relParts) {
  switch (bidangFolderOf(relParts)) {
    case 'BMA': return 'Pengembangan Materi';
    case 'BST': return 'Pelayanan Sertifikasi';
    default: return 'Manajemen Mutu';   // MM & BMK
  }
}

function extOf(f) { return path.extname(f).toLowerCase(); }
function extKey(f) { return extOf(f).replace('.', ''); }

// Versi dari penanda revisi di nama berkas: "…REV.02 …" / "…REV1 …" → 2.0 / 1.0
function versionOf(fileName) {
  const stem = fileName.replace(/\.[a-z0-9]+(?:\.[a-z0-9]+)?$/i, '');
  const m = stem.match(/REV[\s._-]*(\d{1,2})/i);
  const n = Math.min(99, Math.max(1, m ? parseInt(m[1], 10) : 1));
  return { number: n, text: `${n}.0` };
}

// ─── 1. susun rencana import ──────────────────────────────────────

function buildPlan() {
  const files = walk(SOURCE_ROOT)
    .filter(f => ALLOW_EXT.has(extOf(f)))
    .filter(f => !SKIP_DIR.test(path.relative(SOURCE_ROOT, f)))
    .sort((a, b) => path.relative(SOURCE_ROOT, a).localeCompare(path.relative(SOURCE_ROOT, b)));

  const items = files.map(f => {
    const rel = path.relative(SOURCE_ROOT, f);
    const parts = rel.split(path.sep);
    const meta = P.parseFileName(path.basename(f));
    return {
      file: f,
      rel,
      top: parts[0] || '',
      ext: extKey(f),
      baseKode: meta.kode,
      judul: meta.judul || path.basename(f, extOf(f)),
      rawBase: meta.base,
      bidangFolder: bidangFolderOf(parts),
      prFolder: parts.find(p => /^\d+\.\s*PR\./i.test(p) || /^PR\./i.test(p)) || '',
      parentDir: path.dirname(rel),
      kode: '',
      bidang: bidangOf(parts),
      jenis: '',
      version: versionOf(path.basename(f)),
      skip: '',
      mode: 'create',
      status: 'planned',
      warnings: [],
      sectionCount: 0,
      notes: '',
    };
  });

  // ── 1a. kode generik untuk berkas tanpa kode ──
  const lampiran = items.filter(i => !i.baseKode && i.bidangFolder === 'MM' && /lampiran/i.test(i.parentDir));
  lampiran.sort((a, b) => {
    const na = parseInt((a.rawBase.match(/lampiran\s+(\d+)/i) || [])[1] || '999', 10);
    const nb = parseInt((b.rawBase.match(/lampiran\s+(\d+)/i) || [])[1] || '999', 10);
    return na - nb || a.rawBase.localeCompare(b.rawBase);
  });
  lampiran.forEach((i, n) => { i.kode = `MAN.MUTU.UPS.LAMP.${String(n + 1).padStart(2, '0')}-00`; });

  const bst09 = items.filter(i => !i.baseKode && /BST\.09/i.test(i.prFolder));
  bst09.sort((a, b) => a.rawBase.localeCompare(b.rawBase));
  bst09.forEach((i, n) => { i.kode = `FR.UPS.SER3.BST.09.X${n + 1}-00`; });

  for (const i of items) {
    if (i.baseKode) i.kode = i.baseKode;
    else if (/^(?:manual\s+mutu|dokumen\s+mutu\s+smt)/i.test(i.rawBase)) i.kode = UPSERT_KODE;
    else if (!i.kode) i.kode = `DOC.UPS.${String(items.indexOf(i) + 1).padStart(3, '0')}-00`;
    i.kode = i.kode.slice(0, 80);
  }

  // ── 1b. tabrakan kode dalam set impor → pakai satu, sisanya dilewati ──
  const rank = e => (e === 'docx' ? 0 : e === 'pdf' ? 1 : 2);
  const byKode = new Map();
  for (const i of items) {
    if (!byKode.has(i.kode)) byKode.set(i.kode, []);
    byKode.get(i.kode).push(i);
  }
  for (const [kode, group] of byKode) {
    if (group.length < 2) continue;
    group.sort((a, b) => rank(a.ext) - rank(b.ext));
    for (const dup of group.slice(1)) {
      dup.skip = `Kode "${kode}" juga dipakai oleh ${group[0].rel} — dilewati agar tidak ganda.`;
      dup.warnings.push(dup.skip);
    }
  }

  // ── 1c. deteksi jenis + induk ──
  for (const i of items) {
    if (i.skip) continue;
    i.jenis = P.detectType({ fileName: path.basename(i.file), relPath: i.rel, kode: i.kode, judul: i.judul });
    if (!JENIS_ENUM.has(i.jenis)) i.jenis = 'Formulir Kerja';
    i.sourceType = ['docx', 'pdf'].includes(i.ext) ? i.ext
      : ['xlsx', 'xls', 'csv'].includes(i.ext) ? 'xlsx' : 'unsupported';
  }

  // Induk: folder PR.* yang memuat berkas prosedur (PR.*) sebagai anak langsung.
  const prChildren = new Map(); // folderRel -> kode prosedur
  for (const i of items) {
    if (i.skip || !/^PR\./i.test(i.baseKode)) continue;
    const folder = i.parentDir;
    if (!prChildren.has(folder) || i.ext === 'docx') prChildren.set(folder, i.kode);
  }
  for (const i of items) {
    if (i.skip) { i.parentKode = ''; continue; }
    const parts = i.rel.split(path.sep);
    const idx = parts.findIndex(p => /^\d+\.\s*PR\./i.test(p) || /^PR\./i.test(p));
    if (idx < 0) { i.parentKode = ''; continue; }
    const folderRel = parts.slice(0, idx + 1).join(path.sep);
    if (folderRel === i.parentDir) { i.parentKode = ''; continue; } // prosedur itu sendiri
    const parent = prChildren.get(folderRel) || '';
    i.parentKode = parent === i.kode ? '' : parent;
  }

  return items;
}

// ─── main ─────────────────────────────────────────────────────────

let P;

async function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error(`Folder sumber tidak ditemukan: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  buildParser();
  const require_ = createRequire(import.meta.url);
  P = require_(path.join(BUILD_DIR, 'docParser.js'));

  const env = { ...loadEnv(path.join(appRoot, '.env.local')), ...process.env };
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    supportBigNumbers: true,
  });

  const items = buildPlan();

  // Kode yang sudah ada di DB
  const [existingRows] = await conn.query('SELECT id, kode FROM documents');
  const existingByKode = new Map(existingRows.map(r => [r.kode, r.id]));
  for (const i of items) {
    if (existingByKode.has(i.kode)) i.mode = 'update';
  }

  console.log(`\nSumber : ${SOURCE_ROOT}`);
  console.log(`Berkas : ${items.length}  (dry-run=${!WRITE}, parse=${DO_PARSE})\n`);

  const report = { generatedAt: new Date().toISOString(), sourceRoot: SOURCE_ROOT, write: WRITE, items: [] };
  const stats = { created: 0, updated: 0, skipped: 0, failed: 0, sections: 0, assets: 0, kop: 0, noSections: 0 };

  for (const i of items) {
    const row = {
      rel: i.rel, kode: i.kode, judul: i.judul, jenis: i.jenis, bidang: i.bidang,
      ext: i.ext, sourceType: i.sourceType, parentKode: i.parentKode || null,
      mode: i.mode, status: 'planned', sectionCount: 0, assetCount: 0,
      kop: false, warnings: i.warnings.slice(),
    };

    try {
      let parsed = null;

      if (i.skip) {
        row.status = 'skipped';
      } else if (DO_PARSE) {
        const buf = fs.readFileSync(i.file);
        const ctx = { fileName: path.basename(i.file), relPath: i.rel };
        if (i.ext === 'docx') parsed = await P.parseDocxBuffer(buf, ctx);
        else if (i.ext === 'pdf') parsed = await P.parsePdfBuffer(buf, ctx);
        else {
          row.warnings.push(
            i.ext === 'doc'
              ? 'FAILED: format biner OLE (.doc) tidak didukung mammoth — dokumen dibuat tanpa seksi teks.'
              : `Format .${i.ext} tidak dikonversi ke teks (sourceType=${i.sourceType}) — dokumen dibuat tanpa seksi teks.`
          );
        }

        if (parsed) {
          row.judul = parsed.judul || row.judul;
          if (parsed.detectedType && JENIS_ENUM.has(parsed.detectedType)) row.jenis = parsed.detectedType;
          row.sectionCount = Object.keys(parsed.sections).length - (parsed.sections._section_order ? 1 : 0);
          row.assetCount = parsed.assets.length;
          row.kop = !!parsed.kopHtml;
          row.warnings.push(...(parsed.warnings || []));
        }
      }

      if (row.status !== 'skipped') {
        if (WRITE) {
          const res = await persist(conn, i, parsed, row);
          row.status = res.status;
          row.documentId = res.documentId;
        } else {
          row.status = i.mode === 'update' ? 'would-update' : 'would-create';
        }
      }
    } catch (err) {
      row.status = 'failed';
      row.error = err.message;
      console.error(`  ✗ ${i.rel}\n     ${err.message}`);
    }

    if (row.status === 'created' || row.status === 'would-create') stats.created++;
    else if (row.status === 'updated' || row.status === 'would-update') stats.updated++;
    else if (row.status === 'failed') stats.failed++;
    else if (row.status === 'skipped') stats.skipped++;
    if (row.sectionCount === 0) stats.noSections++;
    stats.sections += row.sectionCount;
    stats.assets += row.assetCount;
    if (row.kop) stats.kop++;

    report.items.push(row);
    const mark = row.status === 'failed' ? '✗'
      : row.status === 'skipped' ? '·'
        : row.status === 'updated' || row.status === 'would-update' ? '↻' : '+';
    console.log(`  ${mark} ${row.kode.padEnd(30)} ${String(row.sectionCount).padStart(3)} seksi  ${path.basename(i.rel)}`);
  }

  // ── Pasang induk (parent_prosedur_id) setelah semua dokumen ada ──
  if (WRITE) {
    const [allRows] = await conn.query('SELECT id, kode FROM documents');
    const idByKode = new Map(allRows.map(r => [r.kode, r.id]));
    let parents = 0;
    for (const it of report.items) {
      if (!it.parentKode || !it.documentId) continue;
      const parentId = idByKode.get(it.parentKode);
      if (!parentId) {
        it.warnings.push(`Induk "${it.parentKode}" tidak ditemukan di database — parent_prosedur_id dikosongkan.`);
        continue;
      }
      await conn.query('UPDATE documents SET parent_prosedur_id = ? WHERE id = ?', [parentId, it.documentId]);
      parents++;
    }
    stats.parents = parents;
  }

  await conn.end();

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), renderMarkdown(report, stats));

  console.log('\nRingkasan:');
  console.log(JSON.stringify(stats));
  console.log(`Laporan: ${path.join(REPORT_DIR, 'report.json')} dan report.md`);
  if (!WRITE) console.log('\n[DRY-RUN] Tidak ada yang ditulis. Jalankan dengan --write untuk eksekusi.');
}

// ─── persist (hanya saat --write) ─────────────────────────────────

async function persist(conn, item, parsed, row) {
  const now = new Date();

  await conn.beginTransaction();
  try {
    // 1. Dokumen
    let documentId = null;
    let status = '';

    if (item.mode === 'update') {
      // Kode sudah ada (mis. Manual Mutu bawaan seed) → upsert isi saja,
      // metadata judul/bidang/jenis yang asli dipertahankan.
      const [[doc]] = await conn.query('SELECT id FROM documents WHERE kode = ?', [item.kode]);
      documentId = doc.id;
      await conn.query('UPDATE documents SET updated_at = ? WHERE id = ?', [now, documentId]);
      status = 'updated';
    } else {
      const ver = item.version || { number: 1, text: '1.0' };
      const [res] = await conn.query(
        `INSERT INTO documents
           (kode, judul, bidang, jenis, siklus_review, status,
            current_version, version_number, penyusun_id, audit_ref,
            parent_prosedur_id, ack_total, ack_done, created_at, updated_at)
         VALUES (?, ?, ?, ?, '2 tahun', 'Aktif', ?, ?, ?, NULL, NULL, 0, 0, ?, ?)`,
        [item.kode, (row.judul || item.kode).slice(0, 500), item.bidang, item.jenis,
          ver.text, ver.number, PENYUSUN_ID, now, now]
      );
      documentId = res.insertId;
      status = 'created';
      // Tidak ada baris approvals: dokumen hasil impor lahir Aktif tanpa riwayat
      // tanda tangan (keputusan: siklus approval lama tidak dipalsukan).
    }

    row.documentId = documentId;

    // 2. Aset (gambar + kop) → storage/media/{id}/
    const dir = path.join(MEDIA_ROOT, String(documentId));
    fs.mkdirSync(dir, { recursive: true });
    for (const e of fs.readdirSync(dir)) {
      if (/^\d{3}\.[a-z0-9]+$/i.test(e) || e === 'kop.html') fs.unlinkSync(path.join(dir, e));
    }

    let sections = null;
    let kopHtml = null;
    if (parsed) {
      const mat = await P.materializeParsedAssets(parsed, dir, `/uploads/media/${documentId}`);
      sections = mat.sections;
      kopHtml = mat.kopHtml;
    }

    // 3. Kop surat
    let kopPath = null;
    if (kopHtml) {
      fs.writeFileSync(path.join(dir, 'kop.html'), kopHtml, 'utf8');
      kopPath = `/uploads/media/${documentId}/kop.html`;
      row.kop = true;
    }

    // 4. Berkas sumber
    const srcName = path.basename(item.file);
    const srcPath = `/uploads/media/${documentId}/source.${item.ext}`;
    fs.copyFileSync(item.file, path.join(dir, `source.${item.ext}`));

    await conn.query(
      `UPDATE documents
       SET kop_path = ?, source_path = ?, source_name = ?, source_ext = ?, updated_at = NOW()
       WHERE id = ?`,
      [kopPath, srcPath, srcName, item.ext, documentId]
    );

    // 5. Sections (replace penuh agar idempoten)
    if (sections && Object.keys(sections).length > 0) {
      await conn.query('DELETE FROM document_sections WHERE document_id = ?', [documentId]);
      for (const [key, content] of Object.entries(sections)) {
        await conn.query(
          'INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)',
          [documentId, key, content]
        );
      }
    }

    // 6. Audit
    await conn.query(
      `INSERT INTO audit_logs (user_id, user_name, action_type, document_id, doc_kode, note, created_at)
       VALUES (?, 'Administrator', ?, ?, ?, ?, ?)`,
      [
        PENYUSUN_ID,
        status === 'created' ? 'CREATE' : 'UPDATE',
        documentId,
        item.kode,
        `${status === 'created' ? 'Import' : 'Re-import'} arsip eksisting: ${item.rel}`,
        now,
      ]
    );

    await conn.commit();
    return { status, documentId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  }
}

// ─── laporan ──────────────────────────────────────────────────────

function renderMarkdown(report, stats) {
  const lines = [
    '# Laporan Import Formulir Eksisting',
    '',
    `- Waktu: ${report.generatedAt}`,
    `- Mode: ${report.write ? 'WRITE' : 'DRY-RUN'}`,
    `- Sumber: ${report.sourceRoot}`,
    '',
    '## Ringkasan',
    '',
    '| Metrik | Jumlah |',
    '|---|---|',
    `| Total berkas | ${report.items.length} |`,
    `| Baru | ${stats.created} |`,
    `| Diperbarui | ${stats.updated} |`,
    `| Gagal | ${stats.failed} |`,
    `| Total seksi | ${stats.sections} |`,
    `| Dokumen tanpa seksi | ${stats.noSections} |`,
    `| Dengan kop surat | ${stats.kop} |`,
    `| Total aset gambar | ${stats.assets} |`,
    '',
    '## Detail',
    '',
    '| Status | Kode | Jenis | Seksi | Berkas |',
    '|---|---|---|---|---|',
  ];
  for (const it of report.items) {
    lines.push(`| ${it.status} | ${it.kode} | ${it.jenis} | ${it.sectionCount} | ${it.rel.replace(/\\/g, '/')} |`);
  }
  const withWarnings = report.items.filter(i => i.warnings.length || i.error);
  if (withWarnings.length) {
    lines.push('', '## Peringatan / Kegagalan', '');
    for (const it of withWarnings) {
      lines.push(`- **${it.kode}** — ${it.rel}`);
      if (it.error) lines.push(`  - ERROR: ${it.error}`);
      for (const w of it.warnings) lines.push(`  - ${w}`);
    }
  }
  return lines.join('\n');
}

await main();
