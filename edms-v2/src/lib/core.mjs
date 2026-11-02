import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import {filenameIdentity} from './filename-identity.mjs';
import {departmentsMatch} from './document-classification.mjs';
export const id=()=>randomUUID();
export const hash=b=>createHash('sha256').update(b).digest('hex');
// MariaDB SUM() is DECIMAL and mysql2 returns it as a string by default.
// In particular, "0" must not mark a successful import as partially failed.
export function importCompletion(totalValue, failedValue){
 const total=Number(totalValue??0),failed=Number(failedValue??0);
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(failed)||total<0||failed<0||failed>total)throw new Error('Ringkasan jumlah file impor tidak valid');
 return {state:failed>0?'partial':'done',total,failed};
}
export const root=()=>path.resolve(process.env.STORAGE_ROOT||'storage');
export function safePath(relative){const base=root(),dest=path.resolve(base,relative);if(!dest.startsWith(base+path.sep))throw new Error('Path penyimpanan tidak aman');return dest;}
export function extension(name){return path.extname(name).slice(1).toLowerCase();}
export function validName(name){if(typeof name!=='string'||!name.trim()||name.length>255||/[\x00-\x1f]/.test(name))throw new Error('Nama file tidak valid');return name.replaceAll('\\','/').split('/').pop();}
export function safeEntry(name){const normalized=name.replaceAll('\\','/');if(!normalized||normalized.length>1100||normalized.startsWith('/')||/^[A-Za-z]:/.test(normalized)||normalized.split('/').some(x=>x==='..')||/[\x00-\x1f]/.test(normalized))throw new Error('Path ZIP tidak aman');return normalized;}
export async function ensure(){for(const dir of ['staging','originals','derived','work'])await fs.mkdir(safePath(dir),{recursive:true});}
export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function text(value,max=500){if(typeof value!=='string'||!value.trim()||value.length>max)fail('Field wajib belum lengkap atau terlalu panjang');return value.trim();}
export function editable(user,doc){return user.role==='Super user'||(user.role==='Editor'&&!!user.bidang?.trim()&&(!doc||departmentsMatch(doc.department,user.bidang)));}
export function readable(user,doc){return doc.status==='Aktif'||editable(user,doc);}
export function mime(ext){return {pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[ext]||'application/octet-stream';}
export function identity(name){return filenameIdentity(validName(name));}
