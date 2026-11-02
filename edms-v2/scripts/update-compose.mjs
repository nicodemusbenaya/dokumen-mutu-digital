import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {composeText} from './nas-cutover-lib.mjs';

export function updateViews(merged){
 const release=structuredClone(merged),app=release.services['edms-app'];
 assert.equal(app.container_name,'edms-ups-app');assert.equal(app.image,'edms-ups:2.1.1');
 assert.equal(app.working_dir,'/opt/edms');assert.deepEqual(app.command,['node','scripts/start.mjs']);
 assert(!app.build,'NAS must not build');
 const storage=app.volumes.find(v=>v.target==='/app/storage');assert.equal(storage.type,'bind');assert.equal(storage.source,'/share/Container/edms-app/storage');
 app.image='edms-ups:2.1.3';
 const staging=structuredClone(release);staging.services['edms-app'].ports=[{mode:'ingress',target:3000,published:'3000',host_ip:'127.0.0.1',protocol:'tcp'}];
 return {release,staging};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.env.EDMS_UPDATE,'guarded');
 const merged=JSON.parse(await fs.readFile('/evidence/update-compose-before.json','utf8'));
 const {release,staging}=updateViews(merged);
 for(const [name,value] of [['update-runtime-compose.json',release],['update-staging-compose.json',staging]]){
  try{await fs.writeFile('/evidence/'+name,composeText(value),{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;assert.equal(await fs.readFile('/evidence/'+name,'utf8'),composeText(value),'Existing Compose differs; preserve checkpoint and inspect');}
 }
 console.log('UPDATE_COMPOSE_PREPARED');
}
