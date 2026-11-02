import {randomBytes} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile, writeFile} from 'node:fs/promises';
import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import mysql from 'mysql2/promise';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const envPath = path.join(appRoot, '.env.home');
const compose = ['compose', '--project-name', 'edms-v2-home', '--env-file', '.env.home', '-f', 'compose.home.yml'];
const stop = process.argv.includes('--stop');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {cwd: appRoot, stdio: 'inherit', windowsHide: true, ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.slice(0, 2).join(' ')} gagal (${result.status}).`);
};
if (stop) {
  if (!existsSync(envPath)) throw new Error('.env.home belum ada; database rumah belum dibuat.');
  run('docker', [...compose, 'down']);
  console.log('MariaDB rumah berhenti; volume data tetap tersimpan.');
  process.exit(0);
}

if (!existsSync(envPath)) {
  const hex = bytes => randomBytes(bytes).toString('hex');
  await writeFile(envPath,
    `HOME_DB_PASSWORD=${hex(32)}\nHOME_ADMIN_PASSWORD=${hex(18)}\nHOME_JWT_SECRET=${hex(32)}\n`,
    {flag: 'wx', mode: 0o600});
}
const raw = await readFile(envPath, 'utf8');
const values = Object.fromEntries(raw.split(/\r?\n/).filter(Boolean).map(line => line.split('=', 2)));
for (const key of ['HOME_DB_PASSWORD', 'HOME_ADMIN_PASSWORD', 'HOME_JWT_SECRET']) {
  if (!/^[a-f0-9]{32,}$/.test(values[key] || '')) throw new Error(`.env.home: ${key} harus berupa nilai acak yang dibuat dev:home.`);
}
const local = {
  ...process.env,
  EDMS_HOME: 'true', DB_HOST: '127.0.0.1', DB_PORT: '33307', DB_NAME: 'edms_home',
  DB_USER: 'root', DB_PASSWORD: values.HOME_DB_PASSWORD,
  HOME_ADMIN_PASSWORD: values.HOME_ADMIN_PASSWORD, JWT_SECRET: values.HOME_JWT_SECRET,
  SESSION_COOKIE: 'edms_home_session', APP_ORIGIN: 'http://localhost:3100',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3100', COOKIE_SECURE: 'false',
  STORAGE_ROOT: path.join(appRoot, 'storage', 'home'), PORT: '3100', DEV_HOST: '127.0.0.1',
  WORKER_ENABLED: 'true', NODE_ENV: 'development'
};
run('docker', ['info', '--format', '{{.OSType}}']);
run('docker', [...compose, 'up', '-d', '--wait']);
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const db = await mysql.createConnection({host: '127.0.0.1', port: 33307,
      user: 'root', password: values.HOME_DB_PASSWORD, database: 'edms_home', connectTimeout: 2000});
    await db.end(); ready = true; break;
  } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
}
if (!ready) throw new Error('MariaDB rumah belum siap pada 127.0.0.1:33307.');
run(process.execPath, ['scripts/seed-home-db.mjs'], {env: local});
run(process.execPath, ['scripts/migrate.mjs'], {env: local});
console.log('EDMS rumah: http://localhost:3100');
console.log('Username: DUMMY-home-admin');
console.log(`Password: ${values.HOME_ADMIN_PASSWORD}`);
console.log('Semua data dan file development berada pada laptop. Tekan Ctrl+C untuk menghentikan aplikasi.');
const child = spawn(process.execPath, ['scripts/start.mjs', '--dev'],
  {cwd: appRoot, stdio: 'inherit', env: local, windowsHide: true});
const stopChild = () => child.kill('SIGTERM');
process.on('SIGINT', stopChild);
process.on('SIGTERM', stopChild);
child.on('exit', code => {process.exitCode = code || 0;});
