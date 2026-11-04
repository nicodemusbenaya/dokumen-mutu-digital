import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const before = JSON.parse(await fs.readFile('/evidence/before.json', 'utf8'));
const next = structuredClone(before);
const app = next.services['edms-app'];

assert.equal(app.container_name, 'edms-ups-app');
assert(['edms-ups:2.1.4', 'edms-ups:2.1.5', 'edms-ups:2.1.6', 'edms-ups:2.1.7', 'edms-ups:2.1.8'].includes(app.image), 'Unexpected current image');
assert(!app.build, 'NAS must not build');
assert.equal(app.working_dir, '/opt/edms');
assert.deepEqual(app.command, ['node', 'scripts/start.mjs']);
assert(app.volumes.some((volume) => volume.target === '/app/storage' && volume.type === 'bind'));

app.image = 'edms-ups:2.1.9';
const compare = structuredClone(next);
compare.services['edms-app'].image = before.services['edms-app'].image;
assert.deepEqual(compare, before, 'Only the application image may change');

await fs.writeFile('/evidence/next.json', JSON.stringify(next, null, 2), {flag: 'wx', mode: 0o600});
console.log('APP_IMAGE_ONLY_CONFIG_PASS');
