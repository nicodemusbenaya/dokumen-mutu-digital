import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync } from 'fflate';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const original = path.join(app, 'deploy', 'edms-source-update-20261022.zip');
const destination = path.join(app, 'deploy', 'edms-source-update-20261022-v2.zip');
const files = unzipSync(new Uint8Array(fs.readFileSync(original)));

for (const name of ['next.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json']) {
  files[name] = new Uint8Array(fs.readFileSync(path.join(app, name)));
}
const lock = JSON.parse(Buffer.from(files['package-lock.json']).toString());
if (lock.packages['node_modules/fflate']?.version !== '0.8.3') {
  throw new Error('package-lock.json missing fflate@0.8.3');
}
const zip = zipSync(files, { level: 6 });
fs.writeFileSync(destination, zip);
console.log(destination);
console.log(`${Object.keys(files).length} files, ${zip.length} bytes`);
console.log(`SHA256 ${crypto.createHash('sha256').update(zip).digest('hex')}`);
