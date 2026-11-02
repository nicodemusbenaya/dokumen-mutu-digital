import {SignJWT,jwtVerify} from 'jose';
import {query,withTransaction,rows} from './db.mjs';
import {hash,fail,editable} from './core.mjs';
export const cookie=()=>process.env.SESSION_COOKIE||'edms_session';
function key(){if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET minimal 32 karakter belum dikonfigurasi');return new TextEncoder().encode(process.env.JWT_SECRET);}
export async function token(payload,purpose='session',duration='8h'){return new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setAudience('edms-v2:'+purpose).setIssuedAt().setExpirationTime(duration).sign(key());}
export async function verify(value,purpose='session'){return (await jwtVerify(value,key(),{algorithms:['HS256'],audience:'edms-v2:'+purpose})).payload;}
export async function actor(req){try{const t=req.cookies.get(cookie())?.value;if(!t)fail('Silakan login terlebih dahulu',401);const p=await verify(t);const result=await query('SELECT u.id,u.username,u.full_name fullName,u.bidang,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND u.is_active=1',[p.uid]);if(!result.length)fail('Akun tidak aktif',401);return result[0];}catch{fail('Silakan login terlebih dahulu',401);}}
export function origin(req){
 const actual=req.headers.get('origin');
 const expected=new Set([new URL(req.url).origin,process.env.APP_ORIGIN,process.env.NEXT_PUBLIC_APP_URL].filter(Boolean));
 if(process.env.EDMS_HOME==='true'&&process.env.DEV_HOST==='127.0.0.1'){
  expected.add('http://localhost:3100');
  expected.add('http://127.0.0.1:3100');
 }
 if(!actual||!expected.has(actual))fail('Origin permintaan tidak diizinkan',403);
}
export async function rate(req,scope,limit){const bucket=hash(scope+':'+(req.headers.get('x-forwarded-for')?.split(',')[0]||'local'));await withTransaction(async c=>{await rows(c,'INSERT INTO v2_rate_limits(bucket,hits,expires_at) VALUES(?,1,DATE_ADD(NOW(),INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE hits=IF(expires_at<NOW(),1,hits+1),expires_at=IF(expires_at<NOW(),DATE_ADD(NOW(),INTERVAL 10 MINUTE),expires_at)',[bucket]);const [r]=await rows(c,'SELECT hits FROM v2_rate_limits WHERE bucket=?',[bucket]);if(r.hits>limit)fail('Terlalu banyak permintaan. Coba lagi setelah 10 menit.',429);});}
export async function audit(c,user,req,action,documentId=null,context={}){const ip=req?.headers?.get('x-forwarded-for')?.split(',')[0]?.slice(0,80)||null;const device=req?.headers?.get('user-agent')?.slice(0,500)||null;const sql='INSERT INTO v2_audit(actor_id,actor_name,action,document_id,context_json,ip,device) VALUES(?,?,?,?,?,?,?)';const args=[user.id,user.fullName,action,documentId,JSON.stringify(context),ip,device];if(c)await rows(c,sql,args);else await query(sql,args);}
export function requireEditor(user,doc){if(!editable(user,doc))fail('Anda tidak memiliki hak mengubah dokumen ini',403);}
