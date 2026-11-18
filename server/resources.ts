import {randomBytes} from 'node:crypto';
import {Router,type Request} from 'express';
import bcrypt from 'bcryptjs';
import {modules,label,enumValues,cashierCan,type Field,type Module} from '../shared/modules.js';
import {rows,exec,quote,transaction,type DB} from './db.js';
import {saveOdontogram,validateAppointment,recalculatePlan,validateServicePayments} from './clinical.js';
import {assertAccess,assertAuthor,assertCanSchedule,scopeFor,clinicalModules} from './access.js';
import {signableModules,attachSignatures,assertUnsigned,assertParentUnsigned} from './signatures.js';
import {syncLatestVersion} from './odontogram.js';
import {passwordStamp} from './session.js';
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
export const positiveId=(v:unknown)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)fail(400,'Identificador inválido');return n;};
export const schemas=new Map<string,Field[]>();
export async function loadSchemas(){
 const cols=await rows('SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE()');
 const fks=await rows('SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.key_column_usage WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
 for(const mod of modules){schemas.set(mod.key,cols.filter(c=>c.TABLE_NAME===mod.table).map(c=>{
  const fk=fks.find(f=>f.TABLE_NAME===mod.table&&f.COLUMN_NAME===c.COLUMN_NAME);const ref=modules.find(m=>m.table===fk?.REFERENCED_TABLE_NAME);
  let options=enumValues[c.COLUMN_NAME];if(c.COLUMN_NAME==='estado')options=mod.key==='citas'?['Pendiente','Confirmada','Atendida','Cancelada','Reprogramada','No asistió']:['Activo','Inactivo'];
  if(c.COLUMN_TYPE.startsWith('enum('))options=[...c.COLUMN_TYPE.matchAll(/'([^']*)'/g)].map((x:RegExpMatchArray)=>x[1]);
  const read=c.COLUMN_NAME===mod.pk||c.COLUMN_NAME==='pin_autorizacion'||c.COLUMN_NAME==='cambio_clave_pendiente'||c.COLUMN_NAME==='archivado'||/^(fecha_registro|fecha_creacion|fecha_subida|fecha_evolucion|fecha_diagnostico|fecha_emision|ultima_actualizacion|updated_at)$/.test(c.COLUMN_NAME)||/auto_increment|DEFAULT_GENERATED/.test(c.EXTRA)||['correlativo','id_promocion_aplicada'].includes(c.COLUMN_NAME)||mod.key==='planes'&&['costo_total','monto_pagado','estado_pago'].includes(c.COLUMN_NAME)||mod.key==='inventario'&&c.COLUMN_NAME==='stock_actual';
  return {name:c.COLUMN_NAME,label:label(c.COLUMN_NAME),type:c.COLUMN_NAME==='contrasena'||c.COLUMN_NAME==='pin_autorizacion'?'password':c.COLUMN_NAME==='ruta_archivo'?'file':c.DATA_TYPE==='date'||c.COLUMN_NAME==='fecha_nacimiento'||c.COLUMN_NAME==='fecha'?'date':c.DATA_TYPE.includes('time')?'datetime-local':c.COLUMN_TYPE==='tinyint(1)'?'checkbox':/int|decimal|float|double/.test(c.DATA_TYPE)?'number':c.DATA_TYPE.includes('text')?'textarea':c.COLUMN_NAME==='correo'?'email':c.COLUMN_NAME==='hora'?'time':'text',required:c.IS_NULLABLE==='NO'&&c.COLUMN_DEFAULT===null&&!read,default:c.COLUMN_DEFAULT,options,ref:ref?{module:ref.key,pk:ref.pk}:undefined,readonly:read,max:c.CHARACTER_MAXIMUM_LENGTH};
 }));}
}
export function checkModule(req:Request,key:string){const mod=modules.find(m=>m.key===key)||fail(404,'Módulo no encontrado');if(mod.admin&&req.session.user?.rol!=='Administrador'&&!cashierCan(mod,req.session.user?.rol,req.method))fail(403,'Necesitas el rol Administrador');if(req.session.user?.rol==='Recepcionista'&&clinicalModules.includes(key))fail(403,'Tu rol no tiene acceso a información clínica');if(req.session.user?.rol==='Doctor externo'&&!['GET','HEAD'].includes(req.method))fail(403,'Tu rol es de solo lectura');return mod;}
export function safeFields(mod:Module){return schemas.get(mod.key)!.filter(f=>!['contrasena','pin_autorizacion'].includes(f.name));}
export async function clean(mod:Module,body:Record<string,any>,creating:boolean){
 const fields=schemas.get(mod.key)!;const result:Record<string,any>={};
 for(const field of fields.filter(f=>!f.readonly)){
  let value=body[field.name];if(mod.key.startsWith('categorias-')&&field.name==='color'){if(!creating)continue;const palette=['#39765a','#2563eb','#9333ea','#db2777','#c2410c','#0f766e','#4f46e5','#a16207'];let hash=0;for(const char of String(body.nombre_categoria||''))hash=(hash*31+char.charCodeAt(0))>>>0;value=palette[hash%palette.length];}if(value===undefined){if(creating&&field.required)fail(400,`${field.label} es obligatorio`);continue;}
  if(value===''||value===null){if(field.required&&!(mod.key==='usuarios'&&!creating&&field.name==='contrasena'))fail(400,`${field.label} es obligatorio`);if(field.type==='password'&&!creating)continue;value=null;}
  if(value!==null){
   if(field.type==='number'||field.type==='checkbox'){value=Number(value);if(!Number.isFinite(value)||field.type==='checkbox'&&![0,1].includes(value)||field.name.startsWith('id_')&&(!Number.isSafeInteger(value)||value<1))fail(400,`${field.label} no es válido`);}
   else{if(typeof value!=='string')fail(400,`${field.label} no es válido`);value=value.trim();if(field.max&&value.length>field.max)fail(400,`${field.label} excede ${field.max} caracteres`);}
   if(field.options&&!field.options.includes(value))fail(400,`${field.label} no es válido`);
   if(field.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))fail(400,'Correo electrónico inválido');
   if(field.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail(400,`${field.label}: fecha inválida`);
   if(field.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))fail(400,'Hora inválida');
   if(/^(telefono|ruc|numero_colegiatura)$/.test(field.name)&&!/^\d+$/.test(value))fail(400,`${field.label} solo admite números`);
   if(field.name==='dni'&&!/^\d{8,15}$/.test(value))fail(400,'El DNI debe tener entre 8 y 15 dígitos');
   if(/^(precio_base|monto_pagado|descuento_aplicado|costo_unitario|stock_minimo|duracion_estimada|duracion_minutos|descuento_porcentaje)$/.test(field.name)&&value<0)fail(400,`${field.label} no puede ser negativo`);
   if(field.name==='ruta_archivo'&&!/^uploads\/examenes\/[A-Za-z0-9_.-]+\.(pdf|png|jpg|jpeg|webp)$/i.test(value))fail(400,'Selecciona un archivo clínico válido');
   if(field.name==='contrasena'){if(value.length<8)fail(400,'La contraseña debe tener al menos 8 caracteres');value=await bcrypt.hash(value,12);}
   if(field.name==='pin_autorizacion'){if(!/^\d{4,8}$/.test(value))fail(400,'El PIN debe tener entre 4 y 8 dígitos');value=await bcrypt.hash(value,10);}
  }result[field.name]=value;
 }
 if(mod.key==='categorias-pacientes'&&result.descuento_default!==undefined){const amount=Number(result.descuento_default);if(amount<0||amount>999.99)fail(400,'El descuento debe estar entre 0 y 999.99');if(result.descuento_tipo==='Porcentaje'&&amount>100)fail(400,'El porcentaje no puede superar 100');}
 return result;
}
export async function insert(mod:Module,data:Record<string,any>,db:DB){const fields=Object.keys(data);if(!fields.length)fail(400,'No hay datos para guardar');return (await exec(`INSERT INTO ${quote(mod.table)} (${fields.map(quote).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,Object.values(data),db)).insertId;}
export async function update(mod:Module,id:number,data:Record<string,any>,db:DB){const fields=Object.keys(data);if(fields.length)await exec(`UPDATE ${quote(mod.table)} SET ${fields.map(f=>quote(f)+'=?').join(',')} WHERE ${quote(mod.pk)}=?`,[...Object.values(data),id],db);}
export async function audit(req:Request,mod:string,id:number,action:string,db:DB){await exec('INSERT INTO dentino_audit(usuario,modulo,registro,accion,ip) VALUES (?,?,?,?,?)',[req.session.user!.id_usuario,mod,id,action,String(req.ip||'').slice(0,64)||null],db);}
export const resourceRouter=Router();
resourceRouter.get('/:module/meta',async(req,res)=>{const mod=checkModule(req,String(req.params.module));res.json({module:mod,fields:schemas.get(mod.key)});});
resourceRouter.get('/:module',async(req,res)=>{
 const mod=checkModule(req,String(req.params.module));const fields=safeFields(mod);const page=Math.max(1,Number(req.query.page)||1),size=Math.min(200,Math.max(1,Number(req.query.size)||20));const params:any[]=[];const where:string[]=[];
 if(mod.key==='pacientes'&&req.query.archivados!=='1')where.push('archivado=0');
 if(req.query.q){const searchable=fields.filter(f=>!f.name.startsWith('id_')&&['text','email','textarea','date','time'].includes(f.type));if(searchable.length){where.push('('+searchable.map(f=>`${quote(f.name)} LIKE ?`).join(' OR ')+')');params.push(...searchable.map(()=>'%'+String(req.query.q).slice(0,150)+'%'));}}
 for(const field of fields){if(req.query[field.name]!==undefined){if(typeof req.query[field.name]!=='string')fail(400,'Filtro inválido');where.push(`${quote(field.name)}=?`);params.push(req.query[field.name]);}}
 const scope=scopeFor(req,mod.key);if(scope){where.push(scope.sql);params.push(...scope.params);}
 const filter=where.length?' WHERE '+where.join(' AND '):'';
 const count=await rows(`SELECT COUNT(*) total FROM ${quote(mod.table)}${filter}`,params);
 const data=await rows(`SELECT ${fields.map(f=>quote(f.name)).join(',')} FROM ${quote(mod.table)}${filter} ORDER BY ${quote(mod.pk)} DESC LIMIT ? OFFSET ?`,[...params,size,(page-1)*size]);if(signableModules.includes(mod.key))await attachSignatures(req,mod.key,mod.pk,data);res.json({data,total:count[0].total,page,size});
});
resourceRouter.get('/:module/:id',async(req,res)=>{const mod=checkModule(req,String(req.params.module));const id=positiveId(req.params.id);const data=await rows(`SELECT ${safeFields(mod).map(f=>quote(f.name)).join(',')} FROM ${quote(mod.table)} WHERE ${quote(mod.pk)}=?`,[id]);const record=data[0]||fail(404,'Registro no encontrado');await assertAccess(req,mod.key,record);res.json(record);});
resourceRouter.post('/:module',async(req,res)=>{const mod=checkModule(req,String(req.params.module));if(mod.readonly)fail(405,'Usa el flujo de movimientos de inventario');if(mod.key==='planes'&&(Number(req.body.monto_pagado||0)!==0||req.body.estado_pago&&req.body.estado_pago!=='Pendiente'))fail(400,'Registra los pagos desde Caja');let credentials:{correo:string;contrasena:string}|undefined;
 if(mod.key==='usuarios'){
  const nombre=String(req.body.nombre||'').toLowerCase().replace(/[^a-záéíóúñ]/g,'');
  const apellido=String(req.body.apellido||'').toLowerCase().replace(/[^a-záéíóúñ]/g,'');
  let base=(nombre+'.'+apellido).slice(0,20);
  let correo=base+'@dentino.pe',suffix=1;
  while((await rows('SELECT 1 FROM usuarios WHERE correo=?',[correo])).length)correo=base+(suffix++)+'@dentino.pe';
  credentials={correo,contrasena:randomBytes(12).toString('base64url')};req.body={...req.body,...credentials};
 }
 const data=await clean(mod,req.body,true);if(credentials)data.cambio_clave_pendiente=1;assertAuthor(req,mod.key,data,null);await assertAccess(req,mod.key,data);const id=await transaction(async db=>{
 if(mod.key==='citas'){await assertCanSchedule(req,data,null,db);await validateAppointment(data,0,db);}
 if(mod.key==='antecedentes'){await rows('SELECT id_paciente FROM pacientes WHERE id_paciente=? FOR UPDATE',[data.id_paciente],db);if((await rows('SELECT 1 FROM antecedentes_medicos WHERE id_paciente=?',[data.id_paciente],db)).length)fail(409,'Este paciente ya tiene antecedentes. Edita el registro existente.');data.ultima_actualizacion=(await rows('SELECT NOW() n',[],db))[0].n;}
 if(mod.key==='comprobantes'){await rows("SELECT id_usuario FROM usuarios WHERE rol='Administrador' ORDER BY id_usuario LIMIT 1 FOR UPDATE",[],db);const movement=(await rows('SELECT tipo_movimiento,anulado FROM caja_movimientos WHERE id_movimiento=? FOR UPDATE',[data.id_movimiento],db))[0];if(!movement||movement.tipo_movimiento!=='Ingreso'||movement.anulado)fail(400,'Selecciona un ingreso de caja vigente');if((await rows('SELECT 1 FROM comprobantes WHERE id_movimiento=? FOR UPDATE',[data.id_movimiento],db)).length)fail(409,'El movimiento ya tiene comprobante');
  // El contador nunca retrocede: borrar el último comprobante no hace que su número se vuelva a emitir.
  await exec('INSERT IGNORE INTO comprobantes_correlativos(tipo_comprobante,serie,ultimo) VALUES (?,?,0)',[data.tipo_comprobante,data.serie],db);
  const counter=(await rows('SELECT ultimo FROM comprobantes_correlativos WHERE tipo_comprobante=? AND serie=? FOR UPDATE',[data.tipo_comprobante,data.serie],db))[0];
  const highest=(await rows('SELECT COALESCE(MAX(correlativo),0) n FROM comprobantes WHERE tipo_comprobante=? AND serie=?',[data.tipo_comprobante,data.serie],db))[0].n;
  data.correlativo=Math.max(Number(counter.ultimo),Number(highest))+1;
  await exec('UPDATE comprobantes_correlativos SET ultimo=? WHERE tipo_comprobante=? AND serie=?',[data.correlativo,data.tipo_comprobante,data.serie],db);}
 if(mod.key==='detalles')await rows('SELECT id_plan FROM planes_tratamiento WHERE id_plan=? FOR UPDATE',[data.id_plan],db);
 const newId=await insert(mod,data,db);if(mod.key==='diagnosticos'&&req.body.odontograma){await saveOdontogram(newId,req.body.odontograma,db);await syncLatestVersion(newId,req.session.user!.id_usuario,db);}if(mod.key==='detalles')await recalculatePlan(data.id_plan,db);await audit(req,mod.key,newId,'crear',db);return newId;
 });res.setHeader('Cache-Control','no-store');res.status(201).json({id,...(credentials?{credentials}:{})});});
resourceRouter.put('/:module/:id',async(req,res)=>{const mod=checkModule(req,String(req.params.module));if(mod.readonly)fail(405,'Registro de auditoría no editable');if(mod.noEdit)fail(405,'Un comprobante emitido no se edita. Elimínalo y emite uno nuevo si es necesario.');const id=positiveId(req.params.id);const data=await clean(mod,req.body,false);await transaction(async db=>{
 const old=(await rows(`SELECT * FROM ${quote(mod.table)} WHERE ${quote(mod.pk)}=? FOR UPDATE`,[id],db))[0]||fail(404,'Registro no encontrado');await assertAccess(req,mod.key,old,db);await assertAccess(req,mod.key,{...old,...data},db);assertAuthor(req,mod.key,data,old);await assertUnsigned(mod.key,id,db);await assertParentUnsigned(mod.key,old,db);
 if(mod.key==='planes'){if(req.body.monto_pagado!==undefined&&Number(req.body.monto_pagado)!==Number(old.monto_pagado)||req.body.estado_pago!==undefined&&req.body.estado_pago!==old.estado_pago)fail(409,'El importe pagado se actualiza únicamente al registrar pagos en Caja');if(Number(old.costo_total)-Number(data.descuento_aplicado??old.descuento_aplicado)<Number(old.monto_pagado))fail(409,'El total del plan no puede quedar por debajo de lo ya pagado');}
 if(mod.key==='citas'){await assertCanSchedule(req,{...old,...data},old,db);await validateAppointment({...old,...data},id,db);}
 if(mod.key==='usuarios'&&id===req.session.user!.id_usuario&&(data.estado==='Inactivo'||data.rol&&data.rol!=='Administrador'))fail(400,'No puedes desactivar ni retirar tu propio rol administrador');
 if(mod.key==='detalles'&&data.id_plan&&data.id_plan!==old.id_plan)fail(400,'No puedes trasladar un detalle a otro plan');
 // Los pagos guardan el paciente del plan: ni el plan ni un diagnóstico con planes pueden pasar a otro paciente.
 if(mod.key==='planes'&&data.id_diagnostico!==undefined&&Number(data.id_diagnostico)!==Number(old.id_diagnostico)){const owners=await rows('SELECT id_diagnostico,id_paciente FROM diagnosticos WHERE id_diagnostico IN (?,?)',[old.id_diagnostico,data.id_diagnostico],db);const patientOfDiagnosis=(d:number)=>owners.find(o=>Number(o.id_diagnostico)===Number(d))?.id_paciente;if(patientOfDiagnosis(data.id_diagnostico)==null||patientOfDiagnosis(data.id_diagnostico)!==patientOfDiagnosis(old.id_diagnostico))fail(409,'Un plan no puede pasar a un diagnóstico de otro paciente');}
 if(mod.key==='diagnosticos'&&data.id_paciente!==undefined&&Number(data.id_paciente)!==Number(old.id_paciente)&&(await rows('SELECT 1 FROM planes_tratamiento WHERE id_diagnostico=? LIMIT 1',[id],db)).length)fail(409,'El diagnóstico tiene planes de tratamiento y no puede pasar a otro paciente');
 if(mod.key==='antecedentes')data.ultima_actualizacion=(await rows('SELECT NOW() n',[],db))[0].n;
 await update(mod,id,data,db);if(mod.key==='usuarios'&&id===req.session.user!.id_usuario&&data.contrasena)req.session.pwd=passwordStamp(data.contrasena);if(mod.key==='planes')await exec("UPDATE planes_tratamiento SET estado_pago=CASE WHEN monto_pagado>=GREATEST(0,costo_total-descuento_aplicado) THEN 'Cancelado' WHEN monto_pagado>0 THEN 'Parcial' ELSE 'Pendiente' END WHERE id_plan=?",[id],db);if(mod.key==='planes')await validateServicePayments(id,db);if(mod.key==='diagnosticos'&&req.body.odontograma){await saveOdontogram(id,req.body.odontograma,db);await syncLatestVersion(id,req.session.user!.id_usuario,db);}if(mod.key==='detalles')await recalculatePlan(old.id_plan,db);await audit(req,mod.key,id,'editar',db);
 });res.json({ok:true});});
resourceRouter.delete('/:module/:id',async(req,res)=>{const mod=checkModule(req,String(req.params.module));if(!mod.remove)fail(405,'Este módulo conserva sus registros');const id=positiveId(req.params.id);if(mod.key==='usuarios'&&id===req.session.user!.id_usuario)fail(400,'No puedes desactivar tu propia cuenta');await transaction(async db=>{const old=(await rows(`SELECT * FROM ${quote(mod.table)} WHERE ${quote(mod.pk)}=? FOR UPDATE`,[id],db))[0]||fail(404,'Registro no encontrado');await assertAccess(req,mod.key,old,db);await assertUnsigned(mod.key,id,db);await assertParentUnsigned(mod.key,old,db);
 if(mod.remove==='delete')await exec(`DELETE FROM ${quote(mod.table)} WHERE ${quote(mod.pk)}=?`,[id],db);else await update(mod,id,mod.remove==='archive'?{archivado:1}:{estado:mod.remove==='cancel'?'Cancelada':'Inactivo'},db);
 if(mod.key==='detalles')await recalculatePlan(old.id_plan,db);await audit(req,mod.key,id,'retirar',db);});res.json({ok:true});});
