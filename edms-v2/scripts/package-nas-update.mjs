import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const release=path.join(root,'release');
const version='2.1.3',image=`edms-ups:${version}`,tarName=`edms-ups-${version}.tar`;
const readJson=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
const digest=async file=>{
 const hash=createHash('sha256');
 for await(const chunk of (await fs.open(file)).createReadStream())hash.update(chunk);
 return hash.digest('hex');
};
const docker=(format)=>execFileSync('docker',['image','inspect',image,'--format',format],{encoding:'utf8'}).trim();
if(docker('{{.Os}}/{{.Architecture}}')!=='linux/amd64')throw new Error('Image rilis harus linux/amd64');
const imageId=docker('{{.Id}}'),layers=JSON.parse(docker('{{json .RootFS.Layers}}'));
const reports=await fs.readdir(path.join(release,'verification'),{withFileTypes:true});
let verified=null;
for(const entry of reports){
 if(!entry.isDirectory()||!entry.name.startsWith('DUMMY-'))continue;
 const file=path.join(release,'verification',entry.name,'result.json');
 const result=await readJson(file).catch(()=>null);
 if(result?.passed&&result.image===image&&result.imageId===imageId&&result.linuxRuntime&&result.integration&&result.browserUi===true){
  verified={...result,file};break;
 }
}
if(!verified)throw new Error('Verifikasi rilis lengkap untuk image ini belum lulus');
const audit=await readJson(path.join(release,`runtime-audit-${version}.json`));
if(audit.metadata?.vulnerabilities?.total!==0)throw new Error('Audit dependency runtime belum bersih');
const tarPath=path.join(release,tarName),tarSha256=await digest(tarPath);
const packageName='nas-update-'+tarSha256.slice(0,8),dest=path.join(release,packageName);
await fs.mkdir(dest,{recursive:false});
const copies=[
 tarName,
 'scripts/empty-register-core.mjs','scripts/explorer-schema.mjs','scripts/folder-migration.mjs','scripts/runtime-folder-grants.mjs',
 'scripts/nas-cutover-lib.mjs','scripts/nas-update-apply.sh','scripts/nas-update-backup.sh','scripts/nas-check-existing-backup.sh',
 'scripts/restore-archive.py','scripts/restore-storage-stream.py','scripts/role-migration.mjs',
 'scripts/update-check.mjs','scripts/update-compose.mjs','scripts/update-db.mjs','scripts/update-retention.mjs',
 'sql/005_upload_folders.sql','sql/006_file_explorer.sql','sql/007_document_map.sql','sql/008_lampiran.sql',
 'src/lib/core.mjs','src/lib/db.mjs','src/lib/document-classification.mjs','src/lib/filename-identity.mjs',
 'tests/integration-roles.mjs','tests/integration.mjs','tests/management-integration.mjs',
 'tests/output/DUMMY-campuran.zip','tests/output/DUMMY-formulir.xlsx',
 'tests/output/DUMMY-prosedur.docx','tests/output/DUMMY-prosedur.pdf','tests/output/DUMMY-struktur.zip',
];
for(const relative of copies){
 const source=relative===tarName?tarPath:path.join(root,relative),target=path.join(dest,relative);
 await fs.mkdir(path.dirname(target),{recursive:true});
 if(relative.endsWith('.sh'))await fs.writeFile(target,(await fs.readFile(source,'utf8')).replace(/\r\n/g,'\n'));
 else await fs.copyFile(source,target);
}
await fs.copyFile(verified.file,path.join(dest,'release-test.json'));
await fs.copyFile(path.join(release,`runtime-audit-${version}.json`),path.join(dest,'runtime-audit.json'));
await fs.writeFile(path.join(dest,'package.json'),JSON.stringify({version,image,imageId,platform:'linux/amd64',layers,tarSha256,createdAt:new Date().toISOString(),releaseTestRun:verified.testRun},null,2)+'\n');
const start=`#!/bin/sh
set -eu
PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin:$PATH; export PATH
OPS=/share/Container/edms-release/${packageName}
cd "$OPS"
sha256sum -c SHA256SUMS
docker load --input "$OPS/${tarName}"
CHECK=$(mktemp -d /tmp/edms-update-check.XXXXXX)
chmod 700 "$CHECK"
cleanup(){ rm -f "$CHECK/update-image.json"; rmdir "$CHECK"; }
trap cleanup EXIT HUP INT TERM
docker image inspect ${image} > "$CHECK/update-image.json"
docker run --rm --network none --read-only --user 0 --mount "type=bind,source=$OPS,target=/ops,readonly" --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" --mount "type=bind,source=$CHECK,target=/evidence,readonly" --entrypoint node ${image} scripts/update-check.mjs package
docker run --rm --read-only --user 0 --network edms-mutu-system_default --add-host host.docker.internal:host-gateway --mount "type=bind,source=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519/old-container.inspect.json,target=/admin-source.json,readonly" --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" --env EDMS_UPDATE=guarded --entrypoint node ${image} scripts/update-db.mjs inventory
sh "$OPS/scripts/nas-update-backup.sh" --maintenance "$OPS"
`;
await fs.writeFile(path.join(dest,'nas-update-start-backup.sh'),start);
const manifest=[];
for(const relative of [...copies.map(x=>x.replaceAll('\\','/')),'release-test.json','runtime-audit.json','package.json','nas-update-start-backup.sh'].sort()){
 manifest.push(`${await digest(path.join(dest,relative))}  ${relative}`);
}
await fs.writeFile(path.join(dest,'SHA256SUMS'),manifest.join('\n')+'\n');
await fs.writeFile(path.join(release,'current-update-package.txt'),dest+'\n');
console.log(JSON.stringify({package:dest,image,imageId,tarSha256,files:manifest.length,releaseTestRun:verified.testRun}));
