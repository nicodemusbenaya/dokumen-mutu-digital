import {zipLocation,ensureFolderLocation} from './folder-tree.mjs';

export const importFolders=zipLocation;

export function shouldRetryFolder(item){
 if(item?.state!=='needs_review'||!['folder','import'].includes(item.stage))return false;
 const error=String(item.error||'');
 if(!error.startsWith('Kategori dinonaktifkan: ')&&!/^Folder .+ ada di Folder Terhapus\. Pulihkan dahulu sebelum digunakan\.$/.test(error))return false;
 try{return !JSON.parse(item.payload_json||'{}').metadata?.documentId;}catch{return false;}
}

export async function ensureImportFolders(c,location,user,req){
 return ensureFolderLocation(c,location,user,req);
}
