import 'dotenv/config';
import mysql,{type PoolConnection,type RowDataPacket,type ResultSetHeader} from 'mysql2/promise';
export const pool=mysql.createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3307),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,charset:'utf8mb4',dateStrings:true,decimalNumbers:true,connectionLimit:10,timezone:'+00:00'});
export type DB=typeof pool|PoolConnection;
export async function rows(sql:string,params:unknown[]=[],db:DB=pool):Promise<any[]>{const [result]=await db.query<RowDataPacket[]>(sql,params);return result;}
export async function exec(sql:string,params:any[]=[],db:DB=pool){const [result]=await db.execute<ResultSetHeader>(sql,params);return result;}
export async function transaction<T>(fn:(db:PoolConnection)=>Promise<T>):Promise<T>{const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);await db.commit();return result;}catch(e){await db.rollback();throw e;}finally{db.release();}}
export const quote=(s:string)=>'`'+s.replaceAll('`','``')+'`';
