import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const rootIndex = process.argv.indexOf('--root');
const appRoot = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd());
const require = createRequire(path.join(appRoot, 'package.json'));
const dependencies = ['next', 'mysql2/promise', 'bcryptjs', 'jszip', 'jose', 'pdf-parse', '@napi-rs/canvas'];
const checked = [];
for (const dependency of dependencies) {
  const resolved = require.resolve(dependency);
  const relative = path.relative(appRoot, resolved);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Dependency ${dependency} tidak ada di payload; resolver menemukan salinan di luar paket.`);
  }
  await import(pathToFileURL(resolved).href);
  checked.push(dependency);
}
for (const module of ['db', 'core', 'security', 'documents', 'conversion', 'management', 'export-worker']) {
  await import(pathToFileURL(path.join(appRoot, 'src', 'lib', module + '.mjs')).href);
}
const canvas = await import(pathToFileURL(require.resolve('@napi-rs/canvas')).href);
const image = canvas.createCanvas(1, 1).toBuffer('image/png');
if (image.length < 8) throw new Error('Dependency native canvas tidak berfungsi.');
console.log('RUNTIME_DEPENDENCIES_OK ' + JSON.stringify({platform:process.platform + '/' + process.arch, checked}));
