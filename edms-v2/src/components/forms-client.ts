export async function call(path:string,options:RequestInit={}){
 const r=await fetch('/api/v2/'+path,{...options,headers:{...(typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(d.error||'Permintaan gagal'),{status:r.status,fields:d.fields});
 return d;
}
export const formLink=(token:string)=>location.origin+'/f/'+token;
