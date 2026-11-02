import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const release = path.join(root, 'release');
const version = '2.1.7';
const image = `edms-ups:${version}`;
const tarName = `${image.replace(':', '-')}.tar`;
const tarPath = path.join(release, tarName);
const readJson = async (file) => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const sha256 = async (file) => {
  const hash = createHash('sha256');
  const stream = (await fs.open(file)).createReadStream();
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
};
const inspect = (format) => execFileSync('docker', ['image', 'inspect', image, '--format', format], {encoding: 'utf8'}).trim();

if (inspect('{{.Os}}/{{.Architecture}}') !== 'linux/amd64') throw new Error('Release image must be linux/amd64');
const imageId = inspect('{{.Id}}');
const layers = JSON.parse(inspect('{{json .RootFS.Layers}}'));
const reports = await fs.readdir(path.join(release, 'verification'), {withFileTypes: true});
let verified;
for (const entry of reports) {
  if (!entry.isDirectory() || !entry.name.startsWith('DUMMY-')) continue;
  const reportPath = path.join(release, 'verification', entry.name, 'result.json');
  const result = await readJson(reportPath).catch(() => null);
  if (result?.passed && result.image === image && result.imageId === imageId && result.linuxRuntime && result.integration && result.browserUi === true && result.productionTouched === false) {
    verified = {result, reportPath};
    break;
  }
}
if (!verified) throw new Error('Full DUMMY release verification for this image has not passed');
await fs.access(tarPath);

const packageName = `app-update-${version}`;
const destination = path.join(release, packageName);
let packageExists = false;
try {
  await fs.access(destination);
  packageExists = true;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (packageExists) {
  try {
    await fs.access(path.join(destination, 'update-restore-gate.json'));
    throw new Error('Refusing to rewrite a package that already has a restore gate');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const old = await readJson(path.join(destination, 'package.json')).catch(() => null);
  if (old?.image !== image) throw new Error(`Refusing to overwrite an unrelated package directory: ${destination}`);
} else {
  await fs.mkdir(destination, {recursive: false});
}
await fs.copyFile(tarPath, path.join(destination, tarName));
for (const [source, name] of [
  ['scripts/nas-app-update-2.1.7.sh', 'nas-app-update.sh'],
  ['scripts/nas-app-backup-2.1.7.sh', 'nas-app-backup.sh'],
]) {
  const text = (await fs.readFile(path.join(root, source), 'utf8')).replace(/\r\n/g, '\n');
  await fs.writeFile(path.join(destination, name), text, {mode: 0o755});
}
await fs.copyFile(path.join(root, 'scripts/app-update-compose-2.1.7.mjs'), path.join(destination, 'app-update-compose.mjs'));
await fs.copyFile(verified.reportPath, path.join(destination, 'release-test.json'));
await fs.writeFile(path.join(destination, 'image-id.txt'), `${imageId}\n`);
await fs.writeFile(path.join(destination, 'image-layers.txt'), `${JSON.stringify(layers)}\n`);
await fs.writeFile(path.join(destination, 'package.json'), JSON.stringify({version, image, imageId, platform: 'linux/amd64', layers, tarSha256: await sha256(tarPath), releaseTestRun: verified.result.testRun}, null, 2) + '\n');

const files = ['app-update-compose.mjs', 'edms-ups-2.1.7.tar', 'image-id.txt', 'image-layers.txt', 'nas-app-backup.sh', 'nas-app-update.sh', 'package.json', 'release-test.json'];
const manifest = [];
for (const file of files.sort()) manifest.push(`${await sha256(path.join(destination, file))}  ${file}`);
await fs.writeFile(path.join(destination, 'SHA256SUMS'), manifest.join('\n') + '\n');
await fs.writeFile(path.join(release, 'current-app-update-package.txt'), `${destination}\n`);
console.log(JSON.stringify({package: destination, image, imageId, tarSha256: await sha256(tarPath), files: manifest.length, releaseTestRun: verified.result.testRun}, null, 2));
