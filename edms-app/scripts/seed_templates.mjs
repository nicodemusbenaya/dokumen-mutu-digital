// ═══════════════════════════════════════════════════════════════
//  Seed Template Bawaan Sistem — RENCANA_FITUR_TEMPLATE_DOKUMEN.md §5
//  Membuat 5 baris `documents` berflag is_template=1 untuk jenis
//  yang belum punya padanan blanko hasil import:
//    TPL.IK.STD-01, TPL.MUTU.STD-01, TPL.PERNY.STD-01,
//    TPL.BA.STD-01, TPL.DRM.STD-01
//  Isi sections dirakit langsung dari src/lib/documentTypes.ts
//  (defaultHtml per seksi + metadata _section_order) — tanpa
//  duplikasi HTML di script ini.
//
//  Pemakaian : node scripts/seed_templates.mjs
//  Idempoten : kode yang sudah ada dilewati (tidak diduplikasi).
// ═══════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import {
  DOCUMENT_SECTIONS,
  cleanSectionTitle,
} from '../src/lib/documentTypes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

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

const env = { ...loadEnv(path.join(appRoot, '.env.local')), ...process.env };

const PENYUSUN_ID = 5; // admin / Administrator (selaras dengan import_formulir_eksisting.mjs)

const SEEDS = [
  { kode: 'TPL.IK.STD-01',    jenis: 'Instruksi Kerja',        judul: 'Template Instruksi Kerja — Klausul Baku UPS',      bidang: 'Pelayanan Sertifikasi' },
  { kode: 'TPL.MUTU.STD-01',  jenis: 'Manual Mutu',            judul: 'Template Manual Mutu — Struktur Baku UPS',          bidang: 'Manajemen Mutu' },
  { kode: 'TPL.PERNY.STD-01', jenis: 'Pernyataan Kerahasiaan', judul: 'Template Pernyataan Kerahasiaan — Frasa Baku UPS',  bidang: 'Pelayanan Sertifikasi' },
  { kode: 'TPL.BA.STD-01',    jenis: 'BA Pemusnahan Rekaman',  judul: 'Template Berita Acara Pemusnahan Rekaman Mutu',     bidang: 'Manajemen Mutu' },
  { kode: 'TPL.DRM.STD-01',   jenis: 'Daftar Rekaman Mutu',    judul: 'Template Daftar Rekaman Mutu Terkendali',           bidang: 'Manajemen Mutu' },
];

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 3306),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  multipleStatements: true,
});

console.log(`→ ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}  ←  seed_templates`);

let created = 0;
let skipped = 0;

try {
  for (const seed of SEEDS) {
    const defs = DOCUMENT_SECTIONS[seed.jenis];
    if (!defs || defs.length === 0) {
      console.error(`  ✗ ${seed.kode}: jenis "${seed.jenis}" tidak ada di DOCUMENT_SECTIONS — dilewati.`);
      continue;
    }

    const [existing] = await conn.query('SELECT id FROM documents WHERE kode = ?', [seed.kode]);
    if (existing.length > 0) {
      console.log(`  • ${seed.kode}: sudah ada (id=${existing[0].id}) — dilewati.`);
      skipped++;
      continue;
    }

    await conn.beginTransaction();
    try {
      const [res] = await conn.execute(
        `INSERT INTO documents
           (kode, judul, bidang, jenis, siklus_review, status,
            current_version, version_number, penyusun_id, is_template)
         VALUES (?, ?, ?, ?, '2 tahun', 'Aktif', '1.0', 1, ?, 1)`,
        [seed.kode, seed.judul, seed.bidang, seed.jenis, PENYUSUN_ID]
      );
      const docId = res.insertId;

      const order = [];
      for (const def of defs) {
        await conn.execute(
          'INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)',
          [docId, def.key, def.defaultHtml || '<p>— Belum diisi —</p>']
        );
        order.push({ key: def.key, title: cleanSectionTitle(def.label), isCustom: false });
      }
      await conn.execute(
        'INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)',
        [docId, '_section_order', JSON.stringify(order)]
      );

      await conn.commit();
      console.log(`  ✓ ${seed.kode} (id=${docId}) — ${defs.length} seksi + _section_order.`);
      created++;
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }

  const [verify] = await conn.query(
    `SELECT COUNT(*) AS seed_baru FROM documents
      WHERE kode IN (${SEEDS.map(() => '?').join(',')}) AND is_template = 1`,
    SEEDS.map(s => s.kode)
  );
  const [total] = await conn.query(
    'SELECT COUNT(*) AS total_template FROM documents WHERE is_template = 1'
  );
  console.log(`Selesai. Baru dibuat: ${created}, dilewati: ${skipped}.`);
  console.log(`Verifikasi: ${verify[0].seed_baru}/5 template bawaan berflag, total pustaka template = ${total[0].total_template}.`);
} finally {
  await conn.end();
}
