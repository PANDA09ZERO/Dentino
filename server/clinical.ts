import {Router} from 'express';
import {serviceBalances} from './service-balances.js';
export async function validateServicePayments(id:number,db:DB){const plan=(await rows('SELECT descuento_aplicado FROM planes_tratamiento WHERE id_plan=?',[id],db))[0];if(!plan)return;const details=await rows('SELECT id_detalle_plan,costo_unitario FROM planes_tratamiento_detalle WHERE id_plan=?',[id],db);const payments=await rows('SELECT id_detalle_plan,monto FROM caja_movimientos WHERE id_plan=? AND tipo_movimiento="Ingreso" AND anulado=0',[id],db);if(serviceBalances(details,payments,Number(plan.descuento_aplicado)).some(s=>s.pagado_servicio>s.total_servicio))fail(409,'El importe del servicio no puede quedar por debajo de lo ya pagado');}
import {rows,exec,transaction,type DB} from './db.js';
import {fail,positiveId,audit,clean,insert} from './resources.js';
import {modules as moduleList} from '../shared/modules.js';
import {patientAccess,assertAccess} from './access.js';
import {loadVersions,ensureBaseline,snapshotVersion,changedPieces} from './odontogram.js';
import {attachSignatures} from './signatures.js';
export const clinicalRouter=Router();
export const toothStates=['Sano','Caries','Endodoncia','Perdido','Protesis','Fracturado','Remanente radicular','Bracket metálico','Bracket estético','Tubo molar','Banda','Botón'];
export async function saveOdontogram(id:number,pieces:any[],db:DB){if(!Array.isArray(pieces)||pieces.length>52)fail(400,'Odontograma inválido');for(const p of pieces){const number=positiveId(p.numero_pieza);if(![1,2,3,4,5,6,7,8].includes(Math.floor(number/10))||number%10<1||number%10>(number<50?8:5))fail(400,'Pieza dental inválida');const data:any={};for(const f of ['cara_vestibular','cara_palatina','cara_lingual','cara_mesial','cara_distal','cara_oclusal','estado_general_pieza'])if(p[f]!==undefined){if(typeof p[f]!=='string'||p[f].length>50)fail(400,'Estado dental inválido');data[f]=p[f];}const old=(await rows('SELECT id_odontograma FROM odontograma_piezas WHERE id_diagnostico=? AND numero_pieza=? FOR UPDATE',[id,number],db))[0];const keys=Object.keys(data);if(!keys.length)continue;if(old)await exec(`UPDATE odontograma_piezas SET ${keys.map(k=>k+'=?').join(',')} WHERE id_odontograma=?`,[...Object.values(data),old.id_odontograma],db);else await exec(`INSERT INTO odontograma_piezas (id_diagnostico,numero_pieza,${keys.join(',')}) VALUES (?, ?,${keys.map(()=>'?').join(',')})`,[id,number,...Object.values(data)],db);}}
export const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
export async function slots(doctor:number,date:string,duration:number,exclude:number,db:DB){const user=(await rows("SELECT turno FROM usuarios WHERE id_usuario=? AND rol IN ('Doctor','Doctor externo') AND estado='Activo'",[doctor],db))[0]||fail(400,'Selecciona un doctor activo');const bounds:Record<string,number[]>={'Mañana':[480,780],'Tarde':[840,1140],'Noche':[1080,1320]};const [start,end]=bounds[user.turno]||fail(400,'Doctor sin turno válido');const appointments=await rows("SELECT c.hora,COALESCE(cat.duracion_minutos,30) duration FROM citas c LEFT JOIN categorias_citas cat ON cat.id_categoria=c.id_categoria_cita WHERE c.id_doctor=? AND DATE(c.fecha)=? AND c.id_cita<>? AND c.estado NOT IN ('Cancelada','No asistió')",[doctor,date,exclude],db);const result=[];for(let n=start;n+duration<=end;n+=15){const available=!appointments.some(c=>n<minutes(c.hora)+c.duration&&n+duration>minutes(c.hora));result.push({hora:String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'),disponible:available});}return result;}
export async function validateAppointment(data:any,id:number,db:DB){await rows('SELECT id_usuario FROM usuarios WHERE id_usuario=? FOR UPDATE',[data.id_doctor],db);const cat=data.id_categoria_cita?(await rows('SELECT duracion_minutos FROM categorias_citas WHERE id_categoria=?',[data.id_categoria_cita],db))[0]:null;const duration=Number(cat?.duracion_minutos||30);const available=await slots(positiveId(data.id_doctor),String(data.fecha).slice(0,10),duration,id,db);const hour=String(data.hora??'').slice(0,5);if(!['Cancelada','No asistió'].includes(data.estado)&&!available.some(s=>s.hora===hour&&s.disponible))fail(409,'El horario está ocupado o fuera del turno del doctor');}
export async function recalculatePlan(id:number,db:DB){await exec('UPDATE planes_tratamiento SET costo_total=(SELECT COALESCE(SUM(costo_unitario),0) FROM planes_tratamiento_detalle WHERE id_plan=?) WHERE id_plan=?',[id,id],db);const plan=(await rows('SELECT costo_total,monto_pagado,descuento_aplicado FROM planes_tratamiento WHERE id_plan=?',[id],db))[0];if(plan&&Number(plan.costo_total)-Number(plan.descuento_aplicado)<Number(plan.monto_pagado))fail(409,'El presupuesto no puede quedar por debajo del importe ya pagado');await exec("UPDATE planes_tratamiento SET estado_pago=CASE WHEN monto_pagado>=GREATEST(0,costo_total-descuento_aplicado) THEN 'Cancelado' WHEN monto_pagado>0 THEN 'Parcial' ELSE 'Pendiente' END WHERE id_plan=?",[id],db);await validateServicePayments(id,db);}
// Cambio rápido del estado de una cita. Solo cambia el estado: no mueve fecha, hora ni doctor. Como «No asistió» libera el horario,
// al salir de ese estado se revalida que el horario siga libre.
const quickStates=['Confirmada','Atendida','No asistió'];
clinicalRouter.post('/citas/:id/estado',async(req,res)=>{
 if(req.session.user!.rol==='Doctor externo')fail(403,'Tu rol es de solo lectura');
 const id=positiveId(req.params.id);const estado=String(req.body?.estado||'');
 if(!quickStates.includes(estado))fail(400,'Estado no permitido');
 await transaction(async db=>{
  const cita=(await rows('SELECT * FROM citas WHERE id_cita=? FOR UPDATE',[id],db))[0]||fail(404,'Cita no encontrada');
  if(['Cancelada','Atendida'].includes(cita.estado)&&cita.estado!==estado)fail(409,'La cita ya está '+cita.estado.toLowerCase()+'. Edítala desde Citas si necesitas cambiarla.');
  if(cita.estado==='No asistió'&&estado!=='No asistió')await validateAppointment({...cita,estado},id,db);
  if(cita.estado!==estado){await exec('UPDATE citas SET estado=? WHERE id_cita=?',[estado,id],db);await audit(req,'citas',id,'estado_'+(estado==='No asistió'?'no_asistio':estado.toLowerCase()),db);}
 });
 res.json({ok:true,estado});
});
// Agenda (calendario por día, semana o mes). Los doctores ven solo sus citas; los demás roles, todas o las del doctor elegido.
clinicalRouter.get('/agenda',async(req,res)=>{
 const start=String(req.query.inicio||''),end=String(req.query.fin||'');
 // Fecha real (no solo con forma de fecha): 2026-13-01 o 2026-02-30 darían NaN y saltarían el límite del rango.
 const realDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!realDate(start)||!realDate(end)||start>end)fail(400,'Rango de fechas inválido');
 if((Date.parse(end)-Date.parse(start))/86400000>62)fail(400,'El rango máximo es de dos meses');
 const user=req.session.user!;const params:any[]=[start,end];let where='DATE(c.fecha) BETWEEN ? AND ?';
 if(user.rol==='Doctor'||user.rol==='Doctor externo'){where+=' AND c.id_doctor=?';params.push(user.id_usuario);}
 else if(req.query.doctor){where+=' AND c.id_doctor=?';params.push(positiveId(req.query.doctor));}
 res.json(await rows('SELECT c.id_cita,c.id_paciente,c.id_doctor,DATE_FORMAT(c.fecha,"%Y-%m-%d") fecha,c.hora,c.estado,c.motivo,CONCAT(p.nombre," ",p.apellido) paciente,CONCAT(u.nombre," ",u.apellido) doctor,cat.color FROM citas c JOIN pacientes p ON p.id_paciente=c.id_paciente JOIN usuarios u ON u.id_usuario=c.id_doctor LEFT JOIN categorias_citas cat ON cat.id_categoria=c.id_categoria_cita WHERE '+where+' ORDER BY c.fecha,c.hora',params));
});
clinicalRouter.get('/citas/horarios',async(req,res)=>{const date=String(req.query.fecha||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'Fecha inválida');res.json(await slots(positiveId(req.query.doctor),date,Math.min(240,Math.max(15,Number(req.query.duracion)||30)),Number(req.query.excluir)||0,(await import('./db.js')).pool));});
clinicalRouter.get('/diagnosticos/:id/odontograma',async(req,res)=>{const id=positiveId(req.params.id);const diagnosis=(await rows('SELECT id_paciente FROM diagnosticos WHERE id_diagnostico=?',[id]))[0];if(!diagnosis){res.json([]);return;}await patientAccess(req,diagnosis.id_paciente);res.json(await rows('SELECT * FROM odontograma_piezas WHERE id_diagnostico=? ORDER BY numero_pieza',[id]));});
// Catálogo de tratamientos activos (nombre y precio base) para armar planes. Lo pueden consultar los roles clínicos.
clinicalRouter.get('/catalogo',async(req,res)=>{
 if(req.session.user!.rol==='Recepcionista')fail(403,'Tu rol no tiene acceso a información clínica');
 res.json(await rows("SELECT id_tratamiento id,nombre_tratamiento nombre,precio_base precio FROM catalogo_tratamientos WHERE estado='Activo' ORDER BY nombre_tratamiento"));
});
const validTooth=(value:unknown)=>{const n=Number(value);return Number.isInteger(n)&&[1,2,3,4,5,6,7,8].includes(Math.floor(n/10))&&n%10>=1&&n%10<=(n<50?8:5);};
// Crea un plan de tratamiento COMPLETO (plan + todos sus tratamientos) en un solo paso y en una sola transacción.
clinicalRouter.post('/planes/completo',async(req,res)=>{
 const user=req.session.user!;
 if(user.rol==='Recepcionista')fail(403,'Tu rol no tiene acceso a información clínica');
 if(user.rol==='Doctor externo')fail(403,'Tu rol es de solo lectura');
 const body=req.body||{};const lines=body.tratamientos;
 if(!Array.isArray(lines)||lines.length<1||lines.length>30)fail(400,'Añade entre 1 y 30 tratamientos al plan');
 const planModule=moduleList.find(m=>m.key==='planes')!,detailModule=moduleList.find(m=>m.key==='detalles')!;
 const result=await transaction(async db=>{
  const diagnosis=(await rows('SELECT * FROM diagnosticos WHERE id_diagnostico=? FOR UPDATE',[positiveId(body.id_diagnostico)],db))[0]||fail(404,'Diagnóstico no encontrado');
  await assertAccess(req,'diagnosticos',diagnosis,db);
  const checked=lines.map((line:any)=>{
   const tooth=line?.diente===undefined||line?.diente===null||line?.diente===''?null:line.diente;
   if(tooth!==null&&!validTooth(tooth))fail(400,'Pieza dental inválida');
   return {id_tratamiento:line?.id_tratamiento,diente:tooth,costo_unitario:line?.costo_unitario,estado_tratamiento:'Pendiente'};
  });
  const total=checked.reduce((sum:number,line:any)=>sum+Number(line.costo_unitario||0),0);
  const discount=Number(body.descuento_aplicado||0);
  if(!Number.isFinite(discount)||discount<0||discount>total)fail(400,'El descuento no puede ser mayor que el total del plan');
  const planId=await insert(planModule,await clean(planModule,{id_diagnostico:diagnosis.id_diagnostico,estado_plan:body.estado_plan||'Propuesto',descuento_aplicado:discount,monto_pagado:0,estado_pago:'Pendiente'},true),db);
  for(const line of checked)await insert(detailModule,await clean(detailModule,{...line,id_plan:planId},true),db);
  await recalculatePlan(planId,db);
  await audit(req,'planes',planId,'crear',db);
  return {id_plan:planId,tratamientos:checked.length,costo_total:total};
 });
 res.status(201).json(result);
});
// Actualizar el odontograma guardando una VERSIÓN NUEVA: las versiones anteriores se conservan y se pueden consultar en la historia clínica.
clinicalRouter.post('/diagnosticos/:id/odontograma/version',async(req,res)=>{
 const id=positiveId(req.params.id);const user=req.session.user!;
 if(user.rol==='Doctor externo')fail(403,'Tu rol es de solo lectura');
 const note=typeof req.body?.nota==='string'?req.body.nota.trim().slice(0,255):'';
 const result=await transaction(async db=>{
  const diagnosis=(await rows('SELECT * FROM diagnosticos WHERE id_diagnostico=? FOR UPDATE',[id],db))[0]||fail(404,'Diagnóstico no encontrado');
  await assertAccess(req,'diagnosticos',diagnosis,db);
  await ensureBaseline(id,user.id_usuario,db);
  await saveOdontogram(id,req.body?.piezas,db);
  const changes=await changedPieces(id,db);
  if(!changes.length)fail(400,'No hay cambios respecto a la versión actual del odontograma');
  const version=await snapshotVersion(id,user.id_usuario,note||null,db);
  await audit(req,'odontograma',id,'nueva_version',db);
  return {...version,cambios:changes};
 });
 res.status(201).json(result);
});
clinicalRouter.get('/pacientes/:id/historial',async(req,res)=>{const id=positiveId(req.params.id);await patientAccess(req,id);const paciente=(await rows('SELECT * FROM pacientes WHERE id_paciente=?',[id]))[0]||fail(404,'Paciente no encontrado');const diagnosticos=await rows('SELECT d.*,CONCAT(u.nombre," ",u.apellido) doctor FROM diagnosticos d JOIN usuarios u ON u.id_usuario=d.id_doctor WHERE d.id_paciente=? ORDER BY fecha_diagnostico DESC',[id]);for(const d of diagnosticos){d.odontograma=await rows('SELECT * FROM odontograma_piezas WHERE id_diagnostico=?',[d.id_diagnostico]);d.examenes=await rows('SELECT * FROM examenes_auxiliares WHERE id_diagnostico=?',[d.id_diagnostico]);d.versiones=await loadVersions(d.id_diagnostico);}await attachSignatures(req,'diagnosticos','id_diagnostico',diagnosticos);const planes=await rows('SELECT p.* FROM planes_tratamiento p JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE d.id_paciente=?',[id]);for(const p of planes)p.detalles=await rows('SELECT dt.*,t.nombre_tratamiento FROM planes_tratamiento_detalle dt JOIN catalogo_tratamientos t ON t.id_tratamiento=dt.id_tratamiento WHERE dt.id_plan=?',[p.id_plan]);res.json({paciente,diagnosticos,planes,antecedentes:await rows('SELECT * FROM antecedentes_medicos WHERE id_paciente=?',[id]),citas:await rows('SELECT * FROM citas WHERE id_paciente=? ORDER BY fecha DESC,hora DESC',[id]),evoluciones:await rows('SELECT ev.* FROM evoluciones ev JOIN planes_tratamiento_detalle dt ON dt.id_detalle_plan=ev.id_detalle_plan JOIN planes_tratamiento p ON p.id_plan=dt.id_plan JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE d.id_paciente=? ORDER BY ev.fecha_evolucion DESC',[id])});});
clinicalRouter.post('/inventario/:id/movimiento',async(req,res)=>{if(req.session.user!.rol!=='Administrador')fail(403,'Necesitas el rol Administrador');const id=positiveId(req.params.id);const {tipo_cambio,motivo}=req.body;const quantity=positiveId(req.body.cantidad);if(!['Entrada','Salida'].includes(tipo_cambio)||typeof motivo!=='string'||!motivo.trim()||motivo.length>255)fail(400,'Completa el tipo y motivo del movimiento');await transaction(async db=>{const stock=(await rows('SELECT stock_actual FROM inventario_insumos WHERE id_insumo=? FOR UPDATE',[id],db))[0]||fail(404,'Insumo no encontrado');const next=stock.stock_actual+(tipo_cambio==='Entrada'?quantity:-quantity);if(next<0)fail(409,'No hay stock suficiente');await exec('INSERT INTO inventario_movimientos(id_insumo,tipo_cambio,cantidad,motivo,id_usuario) VALUES (?,?,?,?,?)',[id,tipo_cambio,quantity,motivo.trim(),req.session.user!.id_usuario],db);await exec('UPDATE inventario_insumos SET stock_actual=? WHERE id_insumo=?',[next,id],db);await audit(req,'inventario',id,'movimiento',db);});res.status(201).json({ok:true});});
