import mysql from 'mysql2/promise';
let instance;
export function pool(){return instance ??= mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3307),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectionLimit:4,waitForConnections:true,queueLimit:30,connectTimeout:5000,timezone:'+07:00',charset:'utf8mb4',dateStrings:true});}
export async function query(sql,args=[]){const [rows]=await pool().execute(sql,args);return rows;}
export async function withTransaction(fn){const c=await pool().getConnection();try{await c.beginTransaction();const value=await fn(c);await c.commit();return value;}catch(e){await c.rollback();throw e;}finally{c.release();}}
export const rows=async(c,sql,args=[]) => (await c.execute(sql,args))[0];
