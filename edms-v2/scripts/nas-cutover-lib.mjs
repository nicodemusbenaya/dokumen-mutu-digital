import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {hash,targetTables,preservedTables} from './empty-register-core.mjs';

export function clientConfig(env){
 const q=s=>'"'+String(s).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
 return '[client]\nprotocol=tcp\nhost=127.0.0.1\nport=3307\nuser='+q(env.DB_USER)+'\npassword='+q(env.DB_PASSWORD)+'\ndefault-character-set=utf8mb4\n';
}
// Compose interpolates dollar signs even in JSON input. Keep every existing literal.
export function composeText(value){return JSON.stringify(value,(_,v)=>typeof v==='string'?v.replaceAll('$',()=>'$$'):v,2)+'\n';}
export function runtimeViews(merged,credentials){
 const release=structuredClone(merged),s=release.services['edms-app'];
 assert.equal(s.container_name,'edms-ups-app');assert.equal(s.image,'edms-ups:2.1.0');
 assert.equal(s.working_dir,'/opt/edms');assert.deepEqual(s.command,['node','scripts/start.mjs']);
 s.environment={...s.environment,...credentials,NODE_ENV:'production',PORT:'3000',HOSTNAME:'0.0.0.0',STORAGE_ROOT:'/app/storage',WORKER_ENABLED:'true',PYTHON_BIN:'python3'};
 const staging=structuredClone(release);
 staging.services['edms-app'].ports=[{mode:'ingress',target:3000,published:'3000',host_ip:'127.0.0.1',protocol:'tcp'}];
 return {release,staging};
}
export function publicOrigin({explicit,current,tunnelLog='',aliases=[]}){
 // The existing NAS service is LAN-only HTTP, explicitly confirmed by its owner.
 // Permit that exact origin; arbitrary HTTP origins still fail closed.
 const internalOrigin='http://10.10.200.166:3000';
 const valid=value=>{const u=new URL(value);assert((u.protocol==='https:'||u.origin===internalOrigin)&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password,'Origin must be HTTPS or the confirmed internal NAS origin');return u.origin;};
 if(explicit)return valid(explicit);
 if(current?.startsWith('https://')||current===internalOrigin)return valid(current);
 let latest;
 for(const line of tunnelLog.split(/\r?\n/)){
  try{
   let config;
   if(line.startsWith('{')){const record=JSON.parse(line);config=record.config;}
   else{const quoted=line.match(/\bconfig=("(?:\\.|[^"\\])*")/);if(quoted)config=JSON.parse(quoted[1]);}
   if(typeof config==='string')config=JSON.parse(config);
   if(Array.isArray(config?.ingress))latest=config;
  }catch{}
 }
 const hosts=new Set();
 for(const rule of latest?.ingress||[]){
  try{const service=new URL(rule.service);if(aliases.includes(service.hostname)&&Number(service.port||80)===3000&&/^[a-z0-9][a-z0-9.-]*$/i.test(rule.hostname||''))hosts.add(rule.hostname.toLowerCase());}catch{}
 }
 assert.equal(hosts.size,1,'Cannot determine one public EDMS domain; set EDMS_PUBLIC_ORIGIN=https://your-actual-domain before cutover');
 return valid('https://'+[...hosts][0]);
}
export function assertAfterSmoke(before,after){
 for(const t of [...targetTables,'v2_exports'])assert.equal(after[t].length,0,'Dummy cleanup incomplete: '+t);
 for(const t of preservedTables.filter(t=>!['v2_audit','v2_rate_limits'].includes(t)))
  assert.equal(hash(after[t]),hash(before[t]),'Protected table changed: '+t);
 const audit=new Set(after.v2_audit.map(hash));
 assert(before.v2_audit.every(r=>audit.has(hash(r))),'Existing audit changed');
 const buckets=new Set(after.v2_rate_limits.map(r=>r.bucket));
 assert(before.v2_rate_limits.every(r=>buckets.has(r.bucket)),'Existing rate-limit bucket disappeared');
 assert(after.v2_audit.some(r=>r.action==='first_release_empty_register'),'Transition audit absent');
}
export async function restoreRecovery(files,sourceRoot,storageRoot){
 const digest=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
 for(const f of files){
  assert(/^(originals|derived)\/[a-f0-9-]{36}\.(pdf|docx|xlsx)$/.test(f.diskPath),'Unsafe recovery path');
  const source=path.join(sourceRoot,f.diskPath),dest=path.join(storageRoot,f.diskPath);
  assert(!(await fs.lstat(source)).isSymbolicLink(),'Recovery symlink rejected');
  assert.equal(await digest(source),f.sha256,'Recovery source hash differs');
  await fs.mkdir(path.dirname(dest),{recursive:true});
  assert(!(await fs.lstat(path.dirname(dest))).isSymbolicLink(),'Storage symlink rejected');
  let exists=true;
  try{const s=await fs.lstat(dest);assert(s.isFile()&&!s.isSymbolicLink(),'Recovery destination is not a regular file');}
  catch(e){if(e.code==='ENOENT')exists=false;else throw e;}
  if(!exists){await fs.copyFile(source,dest,fs.constants.COPYFILE_EXCL);if(process.platform!=='win32')await fs.chown(dest,1000,1000);await fs.chmod(dest,0o400);}
  assert.equal(await digest(dest),f.sha256,'Existing file differs; will not overwrite');
 }
 return files.length;
}
