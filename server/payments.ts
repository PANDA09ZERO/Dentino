import {Router} from 'express';
import {serviceBalances} from './service-balances.js';
import {automaticCash} from './automatic-cash.js';
import {rows,exec,transaction} from './db.js';
import {fail,positiveId,audit} from './resources.js';
export const paymentsRouter=Router();
const cents=(value:unknown)=>Math.round(Number(value)*100);
const soles=(value:number)=>value/100;
const methods=['Efectivo','Tarjeta','Transferencia','Yape','Plin'];
paymentsRouter.get('/:id/cuenta',async(req,res)=>{
 const id=positiveId(req.params.id);
 const data=await transaction(async db=>{
  const paciente=(await rows('SELECT id_paciente,nombre,apellido,dni,telefono,correo FROM pacientes WHERE id_paciente=?',[id],db))[0]||fail(404,'Paciente no encontrado');
  const plans=await rows('SELECT p.* FROM planes_tratamiento p JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE d.id_paciente=? ORDER BY p.id_plan DESC',[id],db);
  const payments=await rows('SELECT m.id_movimiento,m.id_detalle_plan,m.servicio_pago,m.id_plan,m.id_cierre,m.monto,m.metodo_pago,m.descripcion,m.fecha_movimiento,m.anulado,m.motivo_anulacion,CONCAT(u.nombre," ",u.apellido) recibido_por,c.estado estado_caja,cp.id_comprobante FROM caja_movimientos m JOIN caja_cierres c ON c.id_cierre=m.id_cierre LEFT JOIN usuarios u ON u.id_usuario=m.id_usuario_pago LEFT JOIN comprobantes cp ON cp.id_movimiento=m.id_movimiento WHERE m.id_paciente=? AND m.tipo_movimiento="Ingreso" ORDER BY m.fecha_movimiento DESC,m.id_movimiento DESC',[id],db);
  for(const plan of plans){const net=Math.max(0,cents(plan.costo_total)-cents(plan.descuento_aplicado));plan.total_efectivo=soles(net);plan.saldo_pendiente=soles(Math.max(0,net-cents(plan.monto_pagado)));plan.pagos=payments.filter(p=>p.id_plan===plan.id_plan&&!p.anulado);plan.pagado_anterior=soles(Math.max(0,cents(plan.monto_pagado)-plan.pagos.reduce((sum:number,p:any)=>sum+cents(p.monto),0)));plan.detalles=await rows('SELECT d.id_detalle_plan,d.diente,d.costo_unitario,t.nombre_tratamiento FROM planes_tratamiento_detalle d JOIN catalogo_tratamientos t ON t.id_tratamiento=d.id_tratamiento WHERE d.id_plan=?',[plan.id_plan],db);plan.pagado_sin_servicio=soles(cents(plan.pagado_anterior)+plan.pagos.filter((p:any)=>!p.id_detalle_plan).reduce((sum:number,p:any)=>sum+cents(p.monto),0));plan.detalles=serviceBalances(plan.detalles,plan.pagos,Number(plan.descuento_aplicado));}
  return {paciente,planes:plans,pagos:payments,caja:(await rows('SELECT id_cierre FROM caja_cierres WHERE estado="Abierta" ORDER BY id_cierre DESC LIMIT 1',[],db))[0]||null,saldo_total:soles(plans.reduce((sum,p)=>sum+cents(p.saldo_pendiente),0))};
 });res.json(data);
});
paymentsRouter.post('/:id/pagos',async(req,res)=>{
 const patient=positiveId(req.params.id),planId=positiveId(req.body.id_plan),serviceId=positiveId(req.body.id_detalle_plan);
 const raw=Number(req.body.monto);const amount=cents(raw);
 const {metodo_pago,clave_pago}=req.body;
 if(!Number.isFinite(raw)||raw<=0||raw>99999999.99||Math.abs(raw*100-amount)>0.000001)fail(400,'El pago debe ser positivo y tener hasta dos decimales');
 if(!methods.includes(metodo_pago)||typeof clave_pago!=='string'||! /^[0-9a-f-]{36}$/i.test(clave_pago))fail(400,'Método de pago o identificador de operación inválido');
 const note=req.body.nota||'';if(typeof note!=='string'||note.length>1000)fail(400,'La nota no puede superar 1000 caracteres');
 const result=await transaction(async db=>{
  const plan=(await rows('SELECT p.*,d.id_paciente FROM planes_tratamiento p JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE p.id_plan=? FOR UPDATE',[planId],db))[0]||fail(404,'Plan no encontrado');
  if(plan.id_paciente!==patient)fail(400,'El plan no pertenece al paciente seleccionado');
  const previous=(await rows('SELECT id_movimiento,id_plan,id_detalle_plan,id_paciente,monto,metodo_pago,anulado FROM caja_movimientos WHERE clave_pago=? FOR UPDATE',[clave_pago],db))[0];
  if(previous){if(previous.anulado)fail(409,'Esa operación corresponde a un pago anulado. Registra un pago nuevo.');if(previous.id_detalle_plan!==serviceId||previous.id_plan!==planId||previous.id_paciente!==patient||cents(previous.monto)!==amount||previous.metodo_pago!==metodo_pago)fail(409,'La operación ya se utilizó para un pago diferente');return {id_movimiento:previous.id_movimiento,repetido:true};}
  if(plan.estado_plan==='Abandonado')fail(409,'El plan está abandonado. Revisa su estado antes de registrar pagos');
  const net=Math.max(0,cents(plan.costo_total)-cents(plan.descuento_aplicado));const paid=cents(plan.monto_pagado);const remaining=net-paid;
  if(amount>remaining)fail(409,'El pago supera el saldo pendiente del plan');
  const details=await rows('SELECT d.*,t.nombre_tratamiento FROM planes_tratamiento_detalle d JOIN catalogo_tratamientos t ON t.id_tratamiento=d.id_tratamiento WHERE d.id_plan=? ORDER BY d.id_detalle_plan',[planId],db);const service=details.find(d=>d.id_detalle_plan===serviceId)||fail(400,'El servicio no pertenece al plan seleccionado');const linked=await rows('SELECT id_detalle_plan,monto FROM caja_movimientos WHERE id_plan=? AND tipo_movimiento="Ingreso" AND anulado=0',[planId],db);const serviceBalance=serviceBalances(details,linked,Number(plan.descuento_aplicado)).find(d=>d.id_detalle_plan===serviceId)!;if(amount>cents(serviceBalance.saldo_servicio))fail(409,'El pago supera el saldo pendiente del servicio');
  const caja=await automaticCash(req.session.user!.id_usuario,db);
  const next=paid+amount;const status=next>=net?'Cancelado':next>0?'Parcial':'Pendiente';
  const movement=await exec('INSERT INTO caja_movimientos(id_cierre,tipo_movimiento,monto,descuento,metodo_pago,descripcion,id_paciente,id_plan,id_usuario_pago,clave_pago,id_detalle_plan,servicio_pago) VALUES (?,"Ingreso",?,0,?,?,?,?,?,?,?,?)',[caja.id_cierre,soles(amount),metodo_pago,`Pago de ${service.nombre_tratamiento}, plan #${planId}${note.trim()?' · '+note.trim():''}`,patient,planId,req.session.user!.id_usuario,clave_pago,serviceId,`${service.nombre_tratamiento}${service.diente?' · Pieza '+service.diente:''}`],db);
  await exec('UPDATE planes_tratamiento SET monto_pagado=?,estado_pago=? WHERE id_plan=?',[soles(next),status,planId],db);
  await audit(req,'pagos',movement.insertId,'pago',db);
  return {id_movimiento:movement.insertId,id_cierre:caja.id_cierre,monto:soles(amount),saldo_pendiente:soles(net-next),estado_pago:status,repetido:false};
 });res.status(result.repetido?200:201).json(result);
});

paymentsRouter.post('/:id/pagos/:movement/anular',async(req,res)=>{
 const patient=positiveId(req.params.id),movementId=positiveId(req.params.movement);
 const reason=typeof req.body?.motivo==='string'?req.body.motivo.trim():'';
 if(reason.length<5||reason.length>500)fail(400,'Indica el motivo de la anulación (entre 5 y 500 caracteres)');
 const result=await transaction(async db=>{
  const found=(await rows('SELECT id_plan FROM caja_movimientos WHERE id_movimiento=?',[movementId],db))[0]||fail(404,'Pago no encontrado');
  if(!found.id_plan)fail(409,'Solo se pueden anular pagos vinculados a un plan');
  const plan=(await rows('SELECT * FROM planes_tratamiento WHERE id_plan=? FOR UPDATE',[found.id_plan],db))[0]||fail(404,'Plan no encontrado');
  const movement=(await rows('SELECT * FROM caja_movimientos WHERE id_movimiento=? FOR UPDATE',[movementId],db))[0]||fail(404,'Pago no encontrado');
  if(movement.id_paciente!==patient||movement.tipo_movimiento!=='Ingreso')fail(400,'El pago no corresponde al paciente seleccionado');
  if(movement.anulado)fail(409,'El pago ya fue anulado');
  // Lectura con bloqueo: ve un comprobante confirmado por otra transacción después de iniciada esta (una lectura simple usaría la instantánea anterior).
  if((await rows('SELECT 1 FROM comprobantes WHERE id_movimiento=? LIMIT 1 FOR SHARE',[movementId],db)).length)fail(409,'El pago tiene un comprobante emitido. Elimina el comprobante antes de anularlo');
  const amount=cents(movement.monto);const net=Math.max(0,cents(plan.costo_total)-cents(plan.descuento_aplicado));const next=Math.max(0,cents(plan.monto_pagado)-amount);
  const status=next>=net?'Cancelado':next>0?'Parcial':'Pendiente';
  await exec('UPDATE caja_movimientos SET anulado=1,motivo_anulacion=?,anulado_por=?,fecha_anulacion=CURRENT_TIMESTAMP WHERE id_movimiento=?',[reason,req.session.user!.id_usuario,movementId],db);
  await exec('UPDATE planes_tratamiento SET monto_pagado=?,estado_pago=? WHERE id_plan=?',[soles(next),status,plan.id_plan],db);
  const cash=(await rows('SELECT estado FROM caja_cierres WHERE id_cierre=? FOR UPDATE',[movement.id_cierre],db))[0];
  if(cash&&cash.estado==='Cerrada')await exec("UPDATE caja_cierres SET monto_cierre_calculado=ROUND(monto_apertura+(SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='Ingreso' THEN monto ELSE -monto END),0) FROM caja_movimientos WHERE id_cierre=? AND anulado=0),2) WHERE id_cierre=?",[movement.id_cierre,movement.id_cierre],db);
  await audit(req,'pagos',movementId,'anular',db);
  return {id_movimiento:movementId,monto:soles(amount),saldo_pendiente:soles(net-next),estado_pago:status};
 });res.json(result);
});
