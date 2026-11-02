import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dest=path.join(root,'release','nas-cutover-'+randomBytes(4).toString('hex'));
await fs.mkdir(dest,{mode:0o700});await fs.mkdir(path.join(dest,'scripts'));await fs.mkdir(path.join(dest,'tests','output'),{recursive:true});
await fs.writeFile(path.join(dest,'INCOMPLETE'),'Preparation in progress\n',{flag:'wx'});
const files=[];
for(const name of ['nas-cutover.sh','scripts/nas-cutover.mjs','scripts/nas-cutover-lib.mjs','scripts/empty-register-core.mjs','tests/integration.mjs','tests/management-integration.mjs','tests/integration-roles.mjs',...['DUMMY-prosedur.pdf','DUMMY-prosedur.docx','DUMMY-formulir.xlsx','DUMMY-campuran.zip'].map(n=>'tests/output/'+n)]){
 const source=path.join(root,name==='nas-cutover.sh'?'scripts/'+name:name);
 let data=await fs.readFile(source);
 if(/\.(sh|mjs)$/.test(name))data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'));
 await fs.writeFile(path.join(dest,name),data,{flag:'wx',mode:0o600});
 files.push(createHash('sha256').update(data).digest('hex')+'  '+name);
}
await fs.writeFile(path.join(dest,'SHA256SUMS'),files.join('\n')+'\n',{flag:'wx',mode:0o600});
await fs.unlink(path.join(dest,'INCOMPLETE'));
console.log('NAS_CUTOVER_PACKAGE_PREPARED: '+dest);
console.log('Run verify-nas-cutover.ps1 before copying this package to the NAS.');
