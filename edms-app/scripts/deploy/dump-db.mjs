// Dump seluruh database MariaDB/MySQL menjadi file SQL (pengganti mysqldump).
// Pemakaian: node scripts/deploy/dump-db.mjs [path/output.sql]
// Koneksi dibaca dari .env.local (edms-app). output default: edms-app/backups/edms_ups_<timestamp>.sql
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..', '..');

function loadEnv() {
  const env = {};
  const p = path.join(APP_ROOT, '.env.local');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...env, ...process.env };
}

function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function quote(s) {
  const map = { '\0': '\\0', '\b': '\\b', '\t': '\\t', '\n': '\\n', '\r': '\\r', '\x1a': '\\Z', "'": "\\'", '\\': '\\\\' };
  return `'${s.replace(/[\0\b\t\n\r\x1a'\\]/g, (c) => map[c])}'`;
}

function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (Buffer.isBuffer(v)) return `0x${v.toString('hex')}`;
  if (v instanceof Date) return quote(fmtDate(v));
  if (typeof v === 'object') return quote(JSON.stringify(v));
  return quote(String(v));
}

async function main() {
  const env = loadEnv();
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const outPath = path.resolve(process.argv[2] || path.join(APP_ROOT, 'backups', `edms_ups_${stamp}.sql`));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const conn = await mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1',
    port: +(env.DB_PORT || 3307),
    database: env.DB_NAME || 'edms_ups',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
    dateStrings: false,
  });

  const parts = [];
  parts.push(`-- Backup database ${env.DB_NAME || 'edms_ups'}`);
  parts.push(`-- Digenerate: ${new Date().toISOString()} oleh scripts/deploy/dump-db.mjs`);
  parts.push(`-- Host: ${env.DB_HOST}:${env.DB_PORT}`);
  parts.push('SET NAMES utf8mb4;');
  parts.push('SET FOREIGN_KEY_CHECKS=0;');
  parts.push('');

  const [tables] = await conn.query('SHOW FULL TABLES');
  let rowsTotal = 0;

  for (const row of tables) {
    const keys = Object.keys(row);
    const name = row[keys[0]];
    const kind = row[keys[1]];
    const tick = `\`${name}\``;

    if (String(kind).toUpperCase() === 'VIEW') {
      const [cv] = await conn.query(`SHOW CREATE VIEW ${tick}`);
      const createKey = Object.keys(cv[0]).find((k) => k.toLowerCase().includes('create'));
      parts.push(`-- VIEW ${name}`);
      parts.push(`${cv[0][createKey]};`);
      parts.push('');
      continue;
    }

    const [ct] = await conn.query(`SHOW CREATE TABLE ${tick}`);
    const createKey = Object.keys(ct[0]).find((k) => k.toLowerCase().includes('create'));
    parts.push(`-- TABEL ${name}`);
    parts.push(`${ct[0][createKey]};`);
    parts.push('');

    const [data] = await conn.query(`SELECT * FROM ${tick}`);
    if (data.length) {
      const cols = Object.keys(data[0]).map((c) => `\`${c}\``).join(', ');
      const BATCH = 200;
      for (let i = 0; i < data.length; i += BATCH) {
        const batch = data.slice(i, i + BATCH);
        const tuples = batch.map((r) => `(${Object.keys(r).map((c) => sqlValue(r[c])).join(', ')})`);
        parts.push(`INSERT INTO ${tick} (${cols}) VALUES\n${tuples.join(',\n')};`);
      }
      rowsTotal += data.length;
      parts.push('');
    }
  }

  parts.push('SET FOREIGN_KEY_CHECKS=1;');
  parts.push('');

  await conn.end();
  fs.writeFileSync(outPath, parts.join('\n'), 'utf8');
  const size = fs.statSync(outPath).size;
  console.log(`DUMP_OK ${outPath} (${tables.length} objek, ${rowsTotal} baris, ${(size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error('DUMP_FAIL', err.message);
  process.exit(1);
});
