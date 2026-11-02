import {filenameIdentity} from './filename-identity.mjs';

const recheckErrors=new Set([
 'Jenis dokumen dan bidang perlu dipilih karena kode nama file tidak dikenali.',
 'Bidang dokumen berbeda dari bidang folder ZIP',
]);

export function shouldRecheckClassification(item){
 if(item?.state!=='needs_review'||item.stage!=='classification'||!recheckErrors.has(item.error))return false;
 let metadata;
 try{metadata=JSON.parse(item.payload_json||'{}').metadata||{};if(metadata.documentId)return false;}catch{return false;}
 const identified=filenameIdentity(item.original_path);
 return identified.recognized||identified.kind==='Lampiran'&&!!metadata.department;
}
