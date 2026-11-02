import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const json=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const sha=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const meta=await json('/ops/package.json'),release=await json('/ops/release-test.json'),image=(await json('/evidence/update-image.json'))[0];
assert.equal(meta.image,'edms-ups:2.1.3');assert.equal(meta.platform,'linux/amd64');
assert(release.passed&&release.linuxRuntime&&release.integration&&release.browserUi===true,'Full release tests have not passed');
assert.equal(release.imageId,meta.imageId,'Release test image changed');
assert.equal(image.Os,'linux');assert.equal(image.Architecture,'amd64');
assert.deepEqual(image.RootFS.Layers,meta.layers,'Loaded image differs from the verified release');
const audit=await json('/ops/runtime-audit.json');assert.equal(audit.metadata.vulnerabilities.total,0,'Runtime dependency audit is not clean');
if(process.argv[2]==='rehearsal'){
 const receipt=await json('/ops/update-rehearsal-pass.json');
 assert(receipt.passed&&!receipt.productionTouched&&receipt.databaseRestoreVerified&&receipt.storageRestoreVerified&&receipt.rollbackVerified&&receipt.idempotencyVerified,'Update restore/rehearsal not passed');
 assert.equal(receipt.updatePackageSha256,await sha('/ops/SHA256SUMS'),'Update code differs from rehearsal');
 assert.equal(receipt.backupManifestSha256,await sha('/backup/SHA256SUMS'),'Backup differs from rehearsal');
 assert.equal(receipt.baselineSha256,await sha('/backup/update-baseline.json'),'Baseline differs from rehearsal');
}
console.log('UPDATE_PACKAGE_'+(process.argv[2]==='rehearsal'?'REHEARSAL_':'')+'PASS');
