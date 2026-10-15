import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const WRITE = process.argv.slice(2).includes('--write');
const PURGE_PDF = !process.argv.slice(2).includes('--keep-pdf');

const MEDIA_ROOT = path.join(appRoot, 'storage', 'media');
const PDF_ROOT = path.join(appRoot, 'storage', 'pdf');
const SIG_DIRS = [
  path.join(appRoot, 'storage', 'signatures'),
  path.join(appRoot, 'public', 'uploads', 'signatures'),
];

const ADMIN_ID = 5; // admin / Administrator

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

const baseName = p => String(p || '').split('/').pop().split('\\').pop();

async function main() {
  const env = { ...loadEnv(path.join(appRoot, '.env.local')), ...process.env };
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    supportBigNumbers: true,
  });

  const q = async (sql, args = []) => (await conn.query(sql, args))[0];

  const [cnt] = await q('SELECT COUNT(*) n FROM documents');
  const ids = (await q('SELECT id FROM documents')).map(r => r.id);

  const counts = {};
  for (const t of ['document_sections', 'document_versions', 'approvals', 'document_references']) {
    const [row] = await q(
      `SELECT COUNT(*) n FROM ${t} WHERE document_id IN (SELECT id FROM documents)`);
    counts[t] = row.n;
  }
  const [auditRefs] = await q(
    'SELECT COUNT(*) n FROM audit_logs WHERE document_id IS NOT NULL');

  const sigPaths = (await q(
    'SELECT DISTINCT signature_path FROM approvals WHERE signature_path IS NOT NULL'))
    .map(r => baseName(r.signature_path));
  const savedSigs = new Set((await q('SELECT file_path FROM signatures'))
    .map(r => baseName(r.file_path)));

  const orphanSigs = [...new Set(sigPaths.filter(f => f && !savedSigs.has(f)))];
  const mediaDirs = fs.existsSync(MEDIA_ROOT)
    ? fs.readdirSync(MEDIA_ROOT, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    : [];
  const pdfFiles = (PURGE_PDF && fs.existsSync(PDF_ROOT)) ? fs.readdirSync(PDF_ROOT) : [];
  const staleSigFiles = [];
  for (const dir of SIG_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (orphanSigs.includes(f)) staleSigFiles.push(path.join(dir, f));
    }
  }

  console.log(`\n=== PURGE DOKUMEN (dry-run=${!WRITE}) ===`);
  console.log(`  documents            : ${cnt.n}`);
  console.log(`  document_sections    : ${counts.document_sections}`);
  console.log(`  document_versions    : ${counts.document_versions}`);
  console.log(`  approvals            : ${counts.approvals}`);
  console.log(`  document_references  : ${counts.document_references}`);
  console.log(`  audit_logs (FK putus): ${auditRefs.n}  → document_id jadi NULL (jejak audit tetap ada)`);
  console.log(`  media dirs           : ${mediaDirs.length}  → storage/media/{id} (semua jadi yatim)`);
  console.log(`  pdf hasil render     : ${pdfFiles.length}  → storage/pdf/* (bisa digenerate ulang)`);
  console.log(`  file tanda tangan    : ${staleSigFiles.length} dari ${SIG_DIRS.length} folder`);
  console.log(`    (file tanda tangan tersimpan di tabel signatures TIDAK dihapus)`);

  if (!WRITE) {
    console.log('\n[DRY-RUN] Tidak ada yang dihapus. Jalankan dengan --write untuk eksekusi.');
    await conn.end();
    return;
  }

  if (!ids.length) {
    console.log('\nTidak ada dokumen untuk dihapus.');
    await conn.end();
    return;
  }

  const confirmed = process.env.CONFIRM !== 'yes';
  if (confirmed) {
    console.error('\nDitolak: set environment CONFIRM=yes untuk melanjutkan.');
    console.error('  CONFIRM=yes node scripts/purge_documents.mjs --write');
    await conn.end();
    process.exit(1);
  }

  await conn.beginTransaction();
  try {
    await q(
      `INSERT INTO audit_logs (user_id, user_name, action_type, doc_kode, note, ip_address, created_at)
       VALUES (?, 'Administrator', 'DELETE', NULL, ?, 'localhost', NOW())`,
      [ADMIN_ID,
        `Purge massal: ${cnt.n} dokumen beserta sections/versions/approvals/references dihapus permanen (hard delete). Backup tersimpan di backups/.`],
    );
    await q('DELETE FROM documents');
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error(`\nGagal: ${err.message}`);
    await conn.end();
    process.exit(1);
  }

  let removed = 0;
  // Semua dokumen ikut terhapus → seluruh storage/media/{id} menjadi yatim.
  for (const d of mediaDirs) {
    fs.rmSync(path.join(MEDIA_ROOT, d), { recursive: true, force: true });
    removed++;
  }
  for (const f of pdfFiles) fs.rmSync(path.join(PDF_ROOT, f), { force: true });
  for (const f of staleSigFiles) fs.rmSync(f, { force: true });

  const [after] = await q('SELECT COUNT(*) n FROM documents');
  await conn.end();

  console.log(`\nSelesai:`);
  console.log(`  documents tersisa    : ${after.n}`);
  console.log(`  media dihapus       : ${removed}`);
  console.log(`  pdf dihapus         : ${pdfFiles.length}`);
  console.log(`  ttd dihapus         : ${staleSigFiles.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
