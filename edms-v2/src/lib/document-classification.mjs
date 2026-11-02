export const departmentLabels=Object.freeze({
 BMK:'Bidang Pengendalian Mutu, Kinerja, Keuangan dan Umum',
 BMA:'Bidang Pengembangan Materi',
 BST:'Bidang Sertifikasi Person dan Umum',
});

export const kindByPrefix=Object.freeze({
 'MAN.MUTU':'Manual Mutu',
 PR:'SOP/Prosedur',
 IK:'Instruksi Kerja',
 FR:'Formulir Mutu',
});

const aliases=Object.freeze({
 BMK:['BMK','Bidang Mutu dan Kinerja','Bidang Pengendalian Mutu, Kinerja, Keuangan dan Umum','Pengendalian Mutu, Kinerja, Keuangan dan Umum'],
 BMA:['BMA','Bidang Pengembangan Materi','Pengembangan Materi'],
 BST:['BST','Bidang Pelayanan Sertifikasi','Bidang Sertifikasi Person dan Umum','Sertifikasi Person dan Umum'],
});
const compact=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');

export function departmentCode(value){
 const raw=String(value||'').trim();
 const folder=raw.match(/^\s*\d+\s*\.\s*(BMK|BMA|BST)\s*-/i);
 if(folder)return folder[1].toUpperCase();
 const prefix=raw.match(/^\s*(BMK|BMA|BST)(?:\b|\s*[-_.])/i);
 if(prefix)return prefix[1].toUpperCase();
 const normalized=compact(raw);
 for(const [code,names] of Object.entries(aliases))if(names.some(name=>compact(name)===normalized))return code;
 return null;
}

export function departmentsMatch(left,right){
 if(!left||!right)return false;
 const a=departmentCode(left),b=departmentCode(right);
 if(a||b)return !!a&&a===b;
 return compact(left)===compact(right);
}

export function departmentAliases(value){
 const code=departmentCode(value);
 return code?[...new Set([code,departmentLabels[code],...aliases[code]])]:[String(value||'').trim()];
}

export function classifyDocumentCode(value){
 const source=String(value||'').replaceAll('\\','/').split('/').pop()||'';
 const patterns=[
  {prefix:'MAN.MUTU',pattern:/(?:^|[^A-Z0-9])(MAN\.MUTU\.UPS\.2025\.(\d{2}))(?:$|[^A-Z0-9])/i,revision:m=>m[2]},
  {prefix:'PR',pattern:/(?:^|[^A-Z0-9])(PR\.UPS\.[A-Z0-9]+\.(BMK|BMA|BST)\.?(\d{2})-(\d{2}))(?:$|[^A-Z0-9])/i,revision:m=>m[4],field:m=>m[2]},
  {prefix:'IK',pattern:/(?:^|[^A-Z0-9])(IK\.UPS\.[A-Z0-9]+\.(BMK|BMA|BST)\.(\d{2})-(\d{2}))(?:$|[^A-Z0-9])/i,revision:m=>m[4],field:m=>m[2]},
  {prefix:'FR',pattern:/(?:^|[^A-Z0-9])(FR\.UPS\.[A-Z0-9]+\.(BMK|BMA|BST)\.(\d{2})\.(\d{2}[A-Z]?)-(\d{2}))(?:$|[^A-Z0-9])/i,revision:m=>m[5],field:m=>m[2]},
 ];
 for(const candidate of patterns){
  const match=source.match(candidate.pattern);if(!match)continue;
  const fieldCode=candidate.field?.(match)?.toUpperCase()||null;
  return {code:match[1],prefix:candidate.prefix,kind:kindByPrefix[candidate.prefix],fieldCode,
   department:fieldCode?departmentLabels[fieldCode]:null,revision:candidate.revision(match),recognized:true};
 }
 return null;
}
