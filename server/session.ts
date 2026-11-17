import session from 'express-session';
import {createHash} from 'node:crypto';
import {exec,rows} from './db.js';
export type User={id_usuario:number;nombre:string;apellido:string;rol:string;correo:string};
declare module 'express-session' {interface SessionData{user?:User;csrf?:string;pwd?:string}}
/** Huella corta del hash de la contraseña: si la contraseña cambia, las sesiones abiertas con la anterior dejan de valer. */
export const passwordStamp=(hash:unknown)=>createHash('sha256').update(String(hash||'')).digest('hex').slice(0,16);
export class MySQLSessionStore extends session.Store{
 get(sid:string,cb:(err:any,data?:session.SessionData|null)=>void){rows('SELECT data FROM dentino_sessions WHERE sid=? AND expires>?',[sid,Date.now()]).then(r=>cb(null,r[0]?JSON.parse(r[0].data):null)).catch(cb);}
 set(sid:string,data:session.SessionData,cb?:(err?:any)=>void){exec('INSERT INTO dentino_sessions(sid,expires,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE expires=VALUES(expires),data=VALUES(data)',[sid,data.cookie.expires?new Date(data.cookie.expires).getTime():Date.now()+8*3600000,JSON.stringify(data)]).then(()=>cb?.()).catch(e=>cb?.(e));}
 destroy(sid:string,cb?:(err?:any)=>void){exec('DELETE FROM dentino_sessions WHERE sid=?',[sid]).then(()=>cb?.()).catch(e=>cb?.(e));}
}
