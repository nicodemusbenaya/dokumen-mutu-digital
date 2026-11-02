import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const payload = path.join(app, '.next', 'standalone');
const buildId = (await fs.readFile(path.join(app, '.next', 'BUILD_ID'), 'utf8')).trim();
await fs.access(path.join(payload, 'server.js'));
const payloadBuildId = (await fs.readFile(path.join(payload, '.next', 'BUILD_ID'), 'utf8')).trim();
if (payloadBuildId !== buildId) throw new Error('BUILD_ID standalone tidak sama dengan hasil build.');

// Copy only public application assets. Never include storage, uploads or secrets.
await fs.cp(path.join(app, '.next', 'static'), path.join(payload, '.next', 'static'), {recursive:true});
await fs.cp(path.join(app, 'public'), path.join(payload, 'public'), {
  recursive:true,
  filter: source => !path.relative(path.join(app,'public'),source).split(path.sep).includes('uploads'),
});
await fs.mkdir(path.join(payload, 'scripts'), {recursive:true});
for (const name of ['start.mjs','worker.mjs','convert.mjs','extract.py','export-zip.py','migrate.mjs','preflight.mjs','check-runtime.mjs']) {
  await fs.copyFile(path.join(app,'scripts',name), path.join(payload,'scripts',name));
}
await fs.cp(path.join(app, 'src', 'lib'), path.join(payload, 'src', 'lib'), {recursive:true});
await fs.cp(path.join(app, 'sql'), path.join(payload, 'sql'), {recursive:true});

const require = createRequire(path.join(payload,'package.json'));
for (const dependency of ['next','mysql2/promise','bcryptjs','jszip','jose','pdf-parse']) {
  const resolved = require.resolve(dependency);
  const relative = path.relative(payload, resolved);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Dependency tidak ada di payload standalone: ' + dependency);
  }
}
for (const forbidden of ['.env','.env.local','storage','cookies.txt']) {
  try {
    await fs.access(path.join(payload,forbidden));
    throw new Error('Payload mengandung data yang tidak boleh dikirim: '+forbidden);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const manifest = {
  version:'2.1.6',buildId,preparedAt:new Date().toISOString(),
  buildPlatform:process.platform+'/'+process.arch,
  targetPlatform:'linux/amd64',
  linuxRuntimeVerified:false,
  productionReady:false,
  note:'Aset standalone lengkap. Verifikasi dependency native Linux, Python, LibreOffice, database dan dummy integration sebelum deploy NAS.',
};
await fs.writeFile(path.join(payload,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({standalonePrepared:true,buildId,buildPlatform:manifest.buildPlatform,linuxRuntimeVerified:false,productionReady:false},null,2));
