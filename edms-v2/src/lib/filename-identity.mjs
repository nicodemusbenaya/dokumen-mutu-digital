import {classifyDocumentCode} from './document-classification.mjs';

// Shared by the browser preview and server. Never infer a long filename from
// a lossy DOS/Windows 8.3 alias, and never replace the stored original filename.
export function filenameIdentity(name){
 const basename=String(name).replaceAll('\\','/').split('/').pop()||'';
 const stem=basename.replace(/\.(pdf|docx|xlsx)$/i,'').replace(/\.(docx|xlsx)$/i,'');
 const shortName=/^[^~\s.]{1,6}~[0-9a-z]{1,6}(?:\s*\(\d+\))?$/i.test(stem);
 const classification=classifyDocumentCode(stem);
 const isAttachment=/(?:^|[^A-Z0-9])LAMPIRAN(?=$|[^A-Z]|[0-9])/i.test(stem);
 const revision=stem.match(/(?:^|[.\s_-])REV(?:ISI)?[.\s_-]*(\d+)(?=$|[.\s_-])/i);
 const codeSource=revision?stem.slice(0,revision.index):stem;
 const code=shortName?null:classification?.code||codeSource.match(/(?:^|[^A-Z0-9])((?:PR|FR|IK|MM)\.[A-Z0-9]+(?:\.[A-Z0-9]+)*(?:-\d+)?)/i)?.[1]||
  codeSource.match(/(?:^|[^A-Z0-9])(MAN\.MUTU\.UPS\.[A-Z0-9.]+)/i)?.[1]||null;
 return {code,title:stem,revision:classification?.revision||revision?.[1]||'0',shortName,
  kind:isAttachment?'Lampiran':classification?.kind||null,department:classification?.department||null,fieldCode:classification?.fieldCode||null,
  documentPrefix:classification?.prefix||null,recognized:!!classification};
}
export function resolveFilenameIdentity(name,metadata={}){
 const guessed=filenameIdentity(name);
 const code=typeof metadata.code==='string'?metadata.code.trim():'';
 const title=typeof metadata.title==='string'?metadata.title.trim():'';
 if(guessed.shortName&&(!code||!title)){
  const error=new Error('Nama file yang diterima adalah nama pendek Windows ('+name+'). Pilih ulang file dengan nama lengkap atau isi kode dan judul lengkap secara manual.');
  error.status=409;throw error;
 }
 return {...guessed,code:code||guessed.code,title:title||guessed.title};
}
