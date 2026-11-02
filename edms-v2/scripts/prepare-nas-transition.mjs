// Package operational tooling and a supplementary recovery copy. No DB connection.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {hash} from './empty-register-core.mjs';
const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const json=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
export async function copyRecoveryFile(sourceRoot,destinationRoot,file){
 assert(/^(originals|derived)\/[a-f0-9-]{36}\.(pdf|docx|xlsx)$/.test(file.diskPath),'Unsafe recovery path');
 assert(/^[a-f0-9]{64}$/i.test(file.sha256),'Invalid original hash');
 const parts=file.diskPath.split('/');
 for(let n=1;n<=parts.length;n++){
  const s=await fs.lstat(path.join(sourceRoot,...parts.slice(0,n)));
  assert(!s.isSymbolicLink(),'Recovery source symlink rejected');
 }
 const source=path.join(sourceRoot,...parts),dest=path.join(destinationRoot,...parts);
 const stat=await fs.stat(source);assert(stat.isFile()&&String(stat.size)===file.size,'Original size differs');
 assert.equal(await digest(source),file.sha256.toLowerCase(),'Original hash differs');
 await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});
 await fs.copyFile(source,dest,fs.constants.COPYFILE_EXCL);
 assert.equal(await digest(dest),file.sha256.toLowerCase(),'Recovery copy hash differs');
 return {path:'recovery/'+file.diskPath,sha256:file.sha256.toLowerCase()};
}
export async function prepare(rehearsal){
 const evidence=path.resolve(rehearsal),report=await json(path.join(evidence,'result.json'));
 const receipt=await json(path.join(evidence,'empty-register-result.json'));
 const plan=await json(path.join(evidence,'empty-register-plan.json'));
 assert(report.passed&&report.restoreVerified&&report.emptyRegisterRehearsalVerified&&!report.productionTouched,'Rehearsal is not verified');
 assert(receipt.passed&&receipt.staleManifestRejected&&!receipt.productionTouched,'Missing transition rehearsal');
 assert.equal(hash(plan),receipt.manifestSha256,'Rehearsal plan differs');
 assert.equal(report.emptyRegisterManifestSha256,receipt.manifestSha256);
 assert.equal(report.backupManifestSha256.toLowerCase(),plan.backupManifestSha256);
 assert.equal(receipt.backupManifestSha256,plan.backupManifestSha256);
 assert.equal(plan.counts.v2_files,plan.files.length);
 const output=path.join(appRoot,'release','nas-transition-'+randomUUID().slice(0,8));
 await fs.mkdir(output,{mode:0o700});
 await fs.writeFile(path.join(output,'INCOMPLETE'),'Preparation is not complete\n',{flag:'wx'});
 const files=[];
 for(const name of ['empty-register-plan.json','empty-register-result.json','result.json']){
  await fs.copyFile(path.join(evidence,name),path.join(output,name),fs.constants.COPYFILE_EXCL);
  files.push({path:name,sha256:await digest(path.join(output,name))});
 }
 for(const name of ['empty-register-core.mjs','nas-transition-check.mjs','nas-transition-check.sh']){
  const source=await fs.readFile(path.join(appRoot,'scripts',name),'utf8');
  await fs.writeFile(path.join(output,name),source.replace(/\r\n/g,'\n'),{flag:'wx',mode:0o600});
  files.push({path:name,sha256:await digest(path.join(output,name))});
 }
 for(const file of plan.files)files.push(await copyRecoveryFile(path.join(appRoot,'storage'),path.join(output,'recovery'),file));
 await fs.copyFile(path.join(appRoot,'compose.override.yml'),path.join(output,'compose.override.yml'),fs.constants.COPYFILE_EXCL);
 files.push({path:'compose.override.yml',sha256:await digest(path.join(output,'compose.override.yml'))});
 await fs.writeFile(path.join(output,'package.json'),JSON.stringify({version:1,backupManifestSha256:plan.backupManifestSha256,manifestSha256:receipt.manifestSha256,recoveryFiles:plan.files.length,files},null,2),{flag:'wx',mode:0o600});
 await fs.unlink(path.join(output,'INCOMPLETE'));
 console.log('NAS_TRANSITION_PACKAGE_READY: '+output);
 console.log('RECOVERY_ORIGINALS_VERIFIED: '+plan.files.length+'; laptop sources unchanged; NAS untouched');
 return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 assert.equal(process.argv.length,3,'Usage: node scripts/prepare-nas-transition.mjs <passed-rehearsal-directory>');
 await prepare(process.argv[2]);
}
