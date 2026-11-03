// Logika tampil bersyarat, dipakai server (validasi) dan klien (render).
// showIf:{field,anyOf}: tampil bila jawaban field acuan (radio/checkbox/grid) memuat salah satu nilai anyOf
// dan field acuan itu sendiri tampil.
const picked=a=>!a||typeof a!=='object'?[]:typeof a.value==='string'?[a.value]:Array.isArray(a.values)?a.values:Object.values(a).map(x=>x?.choice).filter(Boolean);
export function isVisible(f,def,answers,seen=new Set()){
 if(!f?.showIf)return true;
 if(seen.has(f.id))return false;seen.add(f.id);
 const ref=def.fields.find(x=>x.id===f.showIf.field);
 return !!ref&&isVisible(ref,def,answers,seen)&&picked(answers?.[ref.id]).some(v=>f.showIf.anyOf.includes(v));
}
