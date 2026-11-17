import type {Request} from 'express';
import {createHash} from 'node:crypto';
import {exec} from './db.js';
/** Huella corta de un correo: permite correlacionar intentos contra una cuenta sin guardar el texto (que podría ser una contraseña mal escrita). */
export const fingerprint=(value:unknown)=>'correo#'+createHash('sha256').update(String(value||'').trim().toLowerCase()).digest('hex').slice(0,16);
/** Registra un evento de seguridad (sesión, bloqueos, accesos denegados). Nunca interrumpe la respuesta si falla. */
export async function auditEvent(req:Request,event:{usuario:number|null;modulo:string;registro:number;accion:string;detalle?:string}){
 try{await exec('INSERT INTO dentino_audit(usuario,modulo,registro,accion,ip,detalle) VALUES (?,?,?,?,?,?)',[event.usuario,event.modulo,event.registro,event.accion,String(req.ip||'').slice(0,64)||null,event.detalle?event.detalle.slice(0,255):null]);}
 catch{/* la auditoría no debe impedir responder */}
}
