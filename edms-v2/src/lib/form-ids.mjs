// ID baris grid/kolom tabel harus stabil antar-edit: dicocokkan dengan teksnya, bukan posisinya,
// agar jawaban versi lama tidak bergeser ke baris lain saat baris disisipkan/dihapus.
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const lines=t=>t.split('\n').map(x=>x.trim()).filter(Boolean);
function keepIds(items,old,key,prefix){
 const pool=new Map();for(const o of old){const k=key(o);if(!pool.has(k))pool.set(k,[]);pool.get(k).push(o.id);}
 const used=new Set();
 return items.map(it=>{const id=(pool.get(key(it))||[]).find(x=>!used.has(x))||newId(prefix);used.add(id);return {id,...it};});
}
export function textToRows(t,old){return keepIds(lines(t).map(l=>({cells:l.split('|').map(x=>x.trim()),...(/\.{4,}|…/.test(l)&&{blank:true})})),old,r=>r.cells.join('|'),'r');}
export function textToCols(t,old){return keepIds(lines(t).map(l=>{const [label,kind='']=l.split('|').map(x=>x.trim()),k=kind.toLowerCase();return k==='tanggal'?{label,type:'date'}:k==='jam'?{label,type:'time'}:k.startsWith('pilihan')?{label,type:'radio',options:kind.slice(kind.indexOf(':')+1).split(',').map(x=>x.trim()).filter(Boolean)}:{label};}),old,c=>c.label,'c');}
