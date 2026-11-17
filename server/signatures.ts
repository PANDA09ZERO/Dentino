import {Router,type Request} from 'express';
import bcrypt from 'bcryptjs';
import {createHash} from 'node:crypto';
import {rateLimit} from 'express-rate-limit';
import {rows,exec,transaction,quote,pool,type DB} from './db.js';
import {fail,audit,positiveId} from './resources.js';
import {assertAccess} from './access.js';
import {modules} from '../shared/modules.js';
import {snapshotVersion} from './odontogram.js';
// Firma clínica con PIN personal. Solo el doctor responsable firma; el registro firmado ya no puede editarse ni eliminarse.
// Se guarda una copia del contenido y su hash SHA-256 (con firmante e instante) para detectar alteraciones posteriores.
// Es una firma interna de la aplicación: no sustituye a una firma digital certificada.
export const signableModules=['diagnosticos','evoluciones'];
const stable=(value:any):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function isSigned(key:string,id:number,db:DB=pool){return (await rows('SELECT 1 FROM firmas_clinicas WHERE modulo=? AND id_registro=? LIMIT 1',[key,id],db)).length>0;}
export async function assertUnsigned(key:string,id:number,db:DB){if(signableModules.includes(key)&&await isSigned(key,id,db))fail(409,'El registro está firmado y no puede modificarse ni eliminarse');}
/** Exámenes de un diagnóstico firmado y arcos de una evolución firmada: se pueden agregar nuevos, pero los existentes no se editan ni se borran. */
const signedParents:Record<string,[string,string]>={examenes:['diagnosticos','id_diagnostico'],arcos:['evoluciones','id_evolucion']};
export async function assertParentUnsigned(key:string,row:Record<string,any>,db:DB){const parent=signedParents[key];if(parent&&row[parent[1]]!=null&&await isSigned(parent[0],Number(row[parent[1]]),db))fail(409,'Pertenece a un registro firmado y no puede modificarse ni eliminarse');}
/** Agrega a cada fila del listado si está firmada, quién firmó y si el usuario actual puede firmarla. */
export async function attachSignatures(req:Request,key:string,pk:string,data:any[]){
 if(!data.length)return;
 const found=await rows('SELECT f.id_registro,f.fecha_firma,CONCAT(u.nombre," ",u.apellido) firmante FROM firmas_clinicas f JOIN usuarios u ON u.id_usuario=f.id_usuario WHERE f.modulo=? AND f.id_registro IN (?)',[key,data.map(r=>r[pk])]);
 const signed=new Map<any,any>(found.map((f:any)=>[f.id_registro,f] as [any,any]));const user=req.session.user!;
 for(const row of data){const s=signed.get(row[pk]);row.firmado=s?1:0;row.firmante=s?.firmante||null;row.fecha_firma=s?.fecha_firma||null;row.puede_firmar=!s&&user.rol==='Doctor'&&row.id_doctor===user.id_usuario?1:0;}
}
async function contentOf(key:string,id:number,db:DB,version?:number|null){
 const mod=modules.find(m=>m.key===key)!;
 const record=(await rows(`SELECT * FROM ${quote(mod.table)} WHERE ${quote(mod.pk)}=?`,[id],db))[0]||fail(404,'Registro no encontrado');
 const content:any={modulo:key,registro:record};
 if(key==='diagnosticos'){
  // La firma queda ligada a la versión del odontograma vigente al firmar; las versiones posteriores no la alteran.
  const target=version===null?null:version??(await rows('SELECT id_version FROM odontograma_versiones WHERE id_diagnostico=? ORDER BY numero DESC LIMIT 1',[id],db))[0]?.id_version;
  if(target){content.id_version=target;content.odontograma=await rows('SELECT * FROM odontograma_versiones_piezas WHERE id_version=? ORDER BY numero_pieza',[target],db);}
  else content.odontograma=await rows('SELECT * FROM odontograma_piezas WHERE id_diagnostico=? ORDER BY numero_pieza',[id],db);
 }
 return content;
}
const digest=(snapshot:string,signer:number,instant:string)=>createHash('sha256').update(snapshot+'|'+signer+'|'+instant).digest('hex');
export const signatureRouter=Router();
const pinLimit=rateLimit({windowMs:15*60*1000,limit:8,skipSuccessfulRequests:true,keyGenerator:req=>'usuario:'+(req.session.user?.id_usuario||0),message:{error:'Demasiados intentos. Espera unos minutos.'}});
// Cada usuario define su propio PIN confirmando con la contraseña de su cuenta (ni siquiera el administrador puede fijar el de otros).
signatureRouter.post('/pin',pinLimit,async(req,res)=>{
 const {contrasena,pin}=req.body||{};const id=req.session.user!.id_usuario;
 if(typeof contrasena!=='string'||typeof pin!=='string'||!/^\d{4,8}$/.test(pin))fail(400,'El PIN debe tener entre 4 y 8 dígitos');
 const user=(await rows('SELECT contrasena FROM usuarios WHERE id_usuario=?',[id]))[0];
 if(!user||!await bcrypt.compare(contrasena,user.contrasena.replace(/^\$2y\$/,'$2b$')))fail(403,'La contraseña de tu cuenta no es correcta');
 await exec('UPDATE usuarios SET pin_autorizacion=? WHERE id_usuario=?',[await bcrypt.hash(pin,10),id]);
 await audit(req,'usuarios',id,'cambiar_pin',pool);
 res.json({ok:true});
});
signatureRouter.post('/:module/:id',pinLimit,async(req,res)=>{
 const key=String(req.params.module);if(!signableModules.includes(key))fail(404,'Este módulo no admite firma');
 const mod=modules.find(m=>m.key===key)!;const id=positiveId(req.params.id);const pin=req.body?.pin;
 if(typeof pin!=='string'||!/^\d{4,8}$/.test(pin))fail(400,'Ingresa tu PIN de 4 a 8 dígitos');
 const user=req.session.user!;
 const result=await transaction(async db=>{
  const record=(await rows(`SELECT * FROM ${quote(mod.table)} WHERE ${quote(mod.pk)}=? FOR UPDATE`,[id],db))[0]||fail(404,'Registro no encontrado');
  await assertAccess(req,key,record,db);
  if(user.rol!=='Doctor'||record.id_doctor!==user.id_usuario)fail(403,'Solo el doctor responsable puede firmar este registro');
  if(await isSigned(key,id,db))fail(409,'El registro ya está firmado');
  const stored=(await rows('SELECT pin_autorizacion FROM usuarios WHERE id_usuario=?',[user.id_usuario],db))[0]?.pin_autorizacion;
  if(!stored)fail(409,'Configura primero tu PIN de firma en «Mi PIN de firma»');
  if(!await bcrypt.compare(pin,stored))fail(403,'PIN incorrecto');
  // La firma se liga a una versión del odontograma; si aún no hay ninguna (p. ej. diagnóstico sin piezas), se crea la versión base aunque esté vacía.
  if(key==='diagnosticos'&&!(await rows('SELECT 1 FROM odontograma_versiones WHERE id_diagnostico=? LIMIT 1',[id],db)).length)await snapshotVersion(id,user.id_usuario,null,db);
  const snapshot=stable(await contentOf(key,id,db));const instant=new Date().toISOString();const hash=digest(snapshot,user.id_usuario,instant);
  await exec('INSERT INTO firmas_clinicas(modulo,id_registro,id_usuario,contenido,hash_contenido,instante) VALUES (?,?,?,?,?,?)',[key,id,user.id_usuario,snapshot,hash,instant],db);
  await audit(req,key,id,'firmar',db);
  return {ok:true,hash};
 });
 res.json(result);
});
// Estado y verificación de integridad de una firma.
signatureRouter.get('/:module/:id',async(req,res)=>{
 const key=String(req.params.module);if(!signableModules.includes(key))fail(404,'Este módulo no admite firma');
 const mod=modules.find(m=>m.key===key)!;const id=positiveId(req.params.id);
 const record=(await rows(`SELECT * FROM ${quote(mod.table)} WHERE ${quote(mod.pk)}=?`,[id]))[0]||fail(404,'Registro no encontrado');
 await assertAccess(req,key,record);
 const f=(await rows('SELECT f.*,CONCAT(u.nombre," ",u.apellido) firmante FROM firmas_clinicas f JOIN usuarios u ON u.id_usuario=f.id_usuario WHERE f.modulo=? AND f.id_registro=?',[key,id]))[0];
 if(!f){res.json({firmado:false});return;}
 const snapshot=JSON.parse(f.contenido);const current=await contentOf(key,id,pool,snapshot.id_version??null);
 const sameFields=(a:any,b:any)=>Object.keys(a||{}).every(k=>stable(a[k])===stable(b?.[k]));
 const unchanged=sameFields(snapshot.registro,current.registro)&&(key!=='diagnosticos'||(snapshot.odontograma.length===current.odontograma.length&&snapshot.odontograma.every((p:any,i:number)=>sameFields(p,current.odontograma[i]))));
 res.json({firmado:true,firmante:f.firmante,fecha_firma:f.fecha_firma,hash:f.hash_contenido,integro:digest(f.contenido,f.id_usuario,f.instante)===f.hash_contenido&&unchanged});
});
