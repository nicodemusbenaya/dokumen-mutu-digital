// Jalankan berkas .sql terhadap database aktif (.env.local).
// Pemakaian: node scripts/run-sql.mjs sql/003_migration_import_columns.sql
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

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

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Pemakaian: node scripts/run-sql.mjs <file.sql>');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(appRoot, sqlFile), 'utf8');

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 3306),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  multipleStatements: true,
  supportBigNumbers: true,
});

console.log(`→ ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}  ←  ${sqlFile}`);
try {
  const [res] = await conn.query(sql);
  const results = Array.isArray(res) ? res : [res];
  for (const r of results) {
    if (r && Array.isArray(r)) {
      console.log(`  affectedRows=${r.affectedRows ?? '-'}`);
    } else if (r && typeof r === 'object' && 'sql' in r === false) {
      const cols = Object.keys(r);
      if (cols.length) console.log('  ' + JSON.stringify(r));
    }
  }
  console.log('OK.');
} finally {
  await conn.end();
}
