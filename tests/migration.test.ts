import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import {serviceBalances} from '../server/service-balances.js';
test('Reparto de descuentos estable y exacto hasta el centavo',()=>{const balances=serviceBalances([{id_detalle_plan:3,costo_unitario:0.01},{id_detalle_plan:1,costo_unitario:0.01},{id_detalle_plan:2,costo_unitario:0.01}],[],0.01);assert.deepEqual(balances.map(d=>[d.id_detalle_plan,d.total_servicio]),[[1,0.01],[2,0.01],[3,0]]);});
test('Flujos de Dentino sobre una base aislada: auth, permisos, clínica, caja, inventario y reportes',async()=>{
 const name='dentino_validation_'+Date.now();const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,multipleStatements:false});let server:ReturnType<typeof spawn>|undefined;
 try{
  await db.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4');const [tables]:any=await db.query('SHOW TABLES FROM `'+process.env.DB_NAME+'`');await db.query('USE `'+name+'`');await db.query('SET FOREIGN_KEY_CHECKS=0');
  for(const table of tables){const tableName=Object.values(table)[0] as string;const [create]:any=await db.query('SHOW CREATE TABLE `'+process.env.DB_NAME+'`.`'+tableName+'`');await db.query(create[0]['Create Table']);}await db.query('SET FOREIGN_KEY_CHECKS=1');
  const password='DentinoValidation_10!';const hash=await bcrypt.hash(password,10);const phpHash=hash.replace('$2b$','$2y$');
  for(const [id,rol,email] of [[1,'Administrador','admin@validation.local'],[2,'Doctor','doctor@validation.local'],[3,'Recepcionista','recepcion@validation.local'],[4,'Doctor externo','externo@validation.local'],[5,'Doctor','doctor2@validation.local']])await db.execute('INSERT INTO usuarios(id_usuario,nombre,apellido,dni,direccion,telefono,correo,contrasena,rol,turno,estado) VALUES (?,"Prueba","Aislada",?,"Validación","999999999",?,?,?,"Mañana","Activo")',[id,String(90000000+Number(id)),email,phpHash,rol]);
  await db.execute('INSERT INTO categorias_citas(id_categoria,nombre_categoria,duracion_minutos,color,estado) VALUES (1,"Control",30,"#007bff","Activo")');
  await db.execute('INSERT INTO catalogo_tratamientos(id_tratamiento,nombre_tratamiento,precio_base,duracion_estimada,estado) VALUES (1,"Control de prueba",80,30,"Activo")');
  server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,DB_NAME:name,PORT:'3101',NODE_ENV:'test',API_RATE_LIMIT:'5000',APP_ORIGIN:'http://127.0.0.1:3101',SMTP_HOST:'127.0.0.1',SMTP_PORT:'1',SMTP_FROM:'dentino@example.com',NOTIFY_EMAIL:'admin@example.com'},stdio:['ignore','pipe','pipe']});let output='';server.stdout?.on('data',b=>output+=b.toString());server.stderr?.on('data',b=>output+=b.toString());
  server.on('error',e=>output+=e.message);server.on('exit',(code)=>output+=' Exit: '+code);let up=false;for(let i=0;i<500;i++){try{const r=await fetch('http://127.0.0.1:3101/api/health');if(r.ok){up=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(up,'API de validación no inició: '+output);
  const client=()=>{let cookie='',csrf='';return async(url:string,method='GET',body?:any)=>{const form=body instanceof FormData;const r=await fetch('http://127.0.0.1:3101'+url,{method,headers:{Cookie:cookie,...(form?{}:{'Content-Type':'application/json'}),'X-CSRF-Token':csrf},body:body===undefined?undefined:form?body:JSON.stringify(body)});const cookies=r.headers.getSetCookie();if(cookies.length)cookie=cookies.map(c=>c.split(';')[0]).join('; ');const contentType=r.headers.get('content-type')||'';const data=contentType.includes('application/json')?await r.json():await r.arrayBuffer();if(data.csrf)csrf=data.csrf;return{status:r.status,data,r};};};
  const admin=client();assert.equal((await admin('/api/recursos/pacientes')).status,401);await admin('/api/auth/me');assert.equal((await admin('/api/auth/login','POST',{correo:'admin@validation.local',contrasena:password})).status,200);
  for(const [id,role] of [[1,'Administrador'],[2,'Doctor'],[3,'Recepcionista'],[4,'Doctor externo']]){const detail=await admin('/api/recursos/usuarios/'+id);assert.equal(detail.status,200);assert.equal(detail.data.rol,role);assert.ok(!('contrasena' in detail.data));assert.ok(!('pin_autorizacion' in detail.data));}
  await db.execute("UPDATE usuarios SET estado='Inactivo' WHERE id_usuario=4");assert.equal((await admin('/api/recursos/usuarios/4')).data.estado,'Inactivo');assert.equal((await admin('/api/recursos/usuarios/999999')).status,404);
  const patient=await admin('/api/recursos/pacientes','POST',{nombre:'Paciente',apellido:'Validación',dni:'80000001',fecha_nacimiento:'2000-01-01',sexo:'Otro',telefono:'999999999',direccion:'Prueba',correo:null,id_categoria:null});assert.equal(patient.status,201,JSON.stringify(patient.data));const patientId=patient.data.id;
  const appointment={id_paciente:patientId,id_doctor:2,fecha:'2026-11-02',hora:'08:00',id_categoria_cita:1,motivo:'Control',estado:'Pendiente'};const cita=await admin('/api/recursos/citas','POST',appointment);assert.equal(cita.status,201,JSON.stringify(cita.data));assert.equal((await admin('/api/recursos/citas','POST',{...appointment,hora:'08:15'})).status,409);assert.equal((await admin('/api/recursos/citas','POST',{...appointment,hora:'23:00'})).status,409);
  const diagnosis=await admin('/api/recursos/diagnosticos','POST',{id_paciente:patientId,id_doctor:2,observaciones_generales:'Diagnóstico de prueba',odontograma:[{numero_pieza:11,estado_general_pieza:'Caries',cara_mesial:'Caries'}]});assert.equal(diagnosis.status,201);assert.equal((await admin('/api/clinica/diagnosticos/'+diagnosis.data.id+'/odontograma')).data[0].cara_mesial,'Caries');
  const plan=await admin('/api/recursos/planes','POST',{id_diagnostico:diagnosis.data.id,monto_pagado:0,estado_pago:'Pendiente',descuento_aplicado:0,estado_plan:'Propuesto'});assert.equal(plan.status,201,JSON.stringify(plan.data));const detail=await admin('/api/recursos/detalles','POST',{id_plan:plan.data.id,id_tratamiento:1,diente:11,costo_unitario:80,estado_tratamiento:'Pendiente'});assert.equal(detail.status,201);assert.equal(Number((await admin('/api/recursos/planes/'+plan.data.id)).data.costo_total),80);
  assert.equal((await admin('/api/recursos/pacientes/'+patientId,'PUT',{telefono:'999999998'})).status,200);assert.equal((await admin('/api/recursos/pacientes/'+patientId)).data.telefono,'999999998');
  const history=await admin('/api/recursos/antecedentes','POST',{id_paciente:patientId,diabetes:1,hipertension:0,alergias:'Validación'});assert.equal(history.status,201,JSON.stringify(history.data));assert.equal((await admin('/api/recursos/antecedentes/'+history.data.id,'PUT',{observaciones:'Control'})).status,200);
  const uploadForm=new FormData();uploadForm.append('archivo',new Blob(['%PDF-1.4\n% validation'],{type:'application/pdf'}),'validation.pdf');const upload=await admin('/api/archivos','POST',uploadForm);assert.equal(upload.status,201);const exam=await admin('/api/recursos/examenes','POST',{id_diagnostico:diagnosis.data.id,tipo_examen:'Tomografía',ruta_archivo:upload.data.path,notas:'Validación'});assert.equal(exam.status,201);assert.equal((await admin('/'+upload.data.path)).status,200);assert.equal((await client()('/'+upload.data.path)).status,401);assert.equal((await admin('/api/recursos/examenes/'+exam.data.id,'DELETE')).status,200);await (await import('node:fs/promises')).unlink(upload.data.path);
  assert.equal((await admin('/api/recursos/evoluciones','POST',{id_detalle_plan:detail.data.id,id_doctor:2,descripcion_procedimiento:'Control realizado',proxima_cita_sugerida:'2026-11-10'})).status,201);
  const stock=await admin('/api/recursos/inventario','POST',{nombre_insumo:'Insumo prueba',stock_minimo:5,unidad_medida:'Unidades',ubicacion:'Validación',id_categoria:null,fecha_vencimiento_proxima:null});assert.equal(stock.status,201);assert.equal((await admin('/api/clinica/inventario/'+stock.data.id+'/movimiento','POST',{tipo_cambio:'Entrada',cantidad:10,motivo:'Prueba'})).status,201);assert.equal((await admin('/api/clinica/inventario/'+stock.data.id+'/movimiento','POST',{tipo_cambio:'Salida',cantidad:11,motivo:'Prueba'})).status,409);assert.equal((await admin('/api/recursos/inventario/'+stock.data.id)).data.stock_actual,10);
  assert.equal((await admin('/api/caja/abrir','POST',{monto_apertura:100})).status,404);assert.equal((await admin('/api/caja/movimiento','POST',{subtotal:100,descuento_tipo:'porcentaje',descuento_valor:10,tipo_movimiento:'Ingreso',metodo_pago:'Efectivo',descripcion:'Validación',clave_pago:'00000000-0000-4000-8000-000000000070'})).status,201);const cash=await admin('/api/caja');assert.equal(cash.data.balance,90);const receipt=await admin('/api/recursos/comprobantes','POST',{id_movimiento:cash.data.movements[0].id_movimiento,tipo_comprobante:'Boleta',serie:'B001'});assert.equal(receipt.status,201,JSON.stringify(receipt.data));assert.equal((await admin('/api/recursos/comprobantes','POST',{id_movimiento:cash.data.movements[0].id_movimiento,tipo_comprobante:'Boleta',serie:'B001'})).status,409);await db.execute("UPDATE caja_cierres SET estado='Cerrada',monto_cierre_calculado=90,monto_cierre_real=90,diferencia=0,fecha_cierre=CURRENT_TIMESTAMP WHERE id_cierre=?",[cash.data.active.id_cierre]);
  const closed=await admin('/api/caja/'+cash.data.active.id_cierre+'/detalle');assert.equal(closed.status,200);assert.equal(closed.data.caja.estado,'Cerrada');assert.equal(closed.data.movements.length,1);assert.equal(closed.data.ingresos,90);assert.equal(closed.data.egresos,0);assert.equal(closed.data.saldo,90);assert.equal(Number(closed.data.caja.monto_cierre_real),90);assert.equal(Number(closed.data.caja.diferencia),0);assert.equal((await admin('/api/caja/999999/detalle')).status,404);
  const accountBefore=await admin('/api/caja/pacientes/'+patientId+'/cuenta');assert.equal(accountBefore.status,200);assert.equal(accountBefore.data.planes[0].saldo_pendiente,80);
  const payment={id_plan:plan.data.id,id_detalle_plan:detail.data.id,monto:'25.50',metodo_pago:'Efectivo',nota:'Abono de validación',clave_pago:'00000000-0000-4000-8000-000000000001'};
  const automatic=await admin('/api/caja');assert.equal(automatic.status,200);const paymentCash={data:{id:automatic.data.active.id_cierre}};assert.equal((await admin('/api/caja')).data.active.id_cierre,paymentCash.data.id);
  const duplicateRequests=await Promise.all([admin('/api/caja/pacientes/'+patientId+'/pagos','POST',payment),admin('/api/caja/pacientes/'+patientId+'/pagos','POST',payment)]);assert.deepEqual(duplicateRequests.map(r=>r.status).sort(),[200,201]);const partial=duplicateRequests.find(r=>r.status===201)!;assert.equal(partial.status,201,JSON.stringify(partial.data));assert.equal(partial.data.saldo_pendiente,54.5);assert.equal(partial.data.estado_pago,'Parcial');
  const repeat=await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',payment);assert.equal(repeat.status,200);assert.equal(repeat.data.id_movimiento,partial.data.id_movimiento);
  const paymentReceipt=await admin('/api/recursos/comprobantes','POST',{id_movimiento:partial.data.id_movimiento,tipo_comprobante:'Boleta',serie:'B001'});assert.equal(paymentReceipt.status,201);const receiptPatient=await admin('/api/comprobantes/'+paymentReceipt.data.id+'/detalle');assert.equal(receiptPatient.status,200);assert.equal(receiptPatient.data.paciente,'Paciente Validación');assert.equal(receiptPatient.data.dni,'80000001');assert.equal(receiptPatient.data.id_plan,plan.data.id);
  assert.equal(receiptPatient.data.tipo_comprobante,'Boleta');assert.equal(receiptPatient.data.serie,'B001');assert.equal(Number(receiptPatient.data.monto),25.5);assert.ok(receiptPatient.data.servicio_pago.includes('Control de prueba'));assert.ok(receiptPatient.data.fecha_emision);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payment,monto:'26.00'})).status,409);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payment,monto:'80.00',clave_pago:'00000000-0000-4000-8000-000000000002'})).status,409);
  assert.equal((await admin('/api/caja/pacientes/999999/pagos','POST',{...payment,clave_pago:'00000000-0000-4000-8000-000000000003'})).status,400);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payment,monto:'0.001',clave_pago:'00000000-0000-4000-8000-000000000004'})).status,400);
  const pending=await admin('/api/caja/pacientes/'+patientId+'/cuenta');assert.equal(pending.data.pagos.length,1);assert.equal(Number(pending.data.planes[0].monto_pagado),25.5);assert.equal(pending.data.pagos[0].id_plan,plan.data.id);
  const settled=await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payment,monto:'54.50',metodo_pago:'Yape',clave_pago:'00000000-0000-4000-8000-000000000005'});assert.equal(settled.status,201);assert.equal(settled.data.saldo_pendiente,0);assert.equal(settled.data.estado_pago,'Cancelado');
  const invoice=await admin('/api/recursos/comprobantes','POST',{id_movimiento:settled.data.id_movimiento,tipo_comprobante:'Factura',serie:'F001'});assert.equal(invoice.status,201);const invoiceDetail=await admin('/api/comprobantes/'+invoice.data.id+'/detalle');assert.equal(invoiceDetail.data.tipo_comprobante,'Factura');assert.equal(invoiceDetail.data.serie,'F001');assert.equal(Number(invoiceDetail.data.monto),54.5);assert.equal(invoiceDetail.data.metodo_pago,'Yape');assert.equal(invoiceDetail.data.paciente,'Paciente Validación');
  const extraDetail=await admin('/api/recursos/detalles','POST',{id_plan:plan.data.id,id_tratamiento:1,diente:21,costo_unitario:10,estado_tratamiento:'Pendiente'});assert.equal(extraDetail.status,201);assert.equal((await admin('/api/recursos/planes/'+plan.data.id)).data.estado_pago,'Parcial');assert.equal((await admin('/api/recursos/detalles/'+extraDetail.data.id,'DELETE')).status,200);assert.equal((await admin('/api/recursos/planes/'+plan.data.id)).data.estado_pago,'Cancelado');
  assert.equal((await admin('/api/recursos/planes/'+plan.data.id,'PUT',{monto_pagado:0})).status,409);
  const [historical]:any=await db.execute('INSERT INTO planes_tratamiento(id_diagnostico,costo_total,monto_pagado,estado_pago,estado_plan) VALUES (?,100,30,"Parcial","En progreso")',[diagnosis.data.id]);const historicalAccount=await admin('/api/caja/pacientes/'+patientId+'/cuenta');const historicalPlan=historicalAccount.data.planes.find((p:any)=>p.id_plan===historical.insertId);assert.equal(historicalPlan.pagado_anterior,30);assert.equal(historicalPlan.saldo_pendiente,70);assert.equal(historicalPlan.pagos.length,0);await db.execute('DELETE FROM planes_tratamiento WHERE id_plan=?',[historical.insertId]);
  const paymentDetail=await admin('/api/caja/'+paymentCash.data.id+'/detalle');assert.equal(paymentDetail.data.movements.length,2);assert.equal(paymentDetail.data.ingresos,80);assert.equal(paymentDetail.data.movements[0].id_paciente,patientId);assert.equal(paymentDetail.data.movements[0].id_plan,plan.data.id);
  const multi=await admin('/api/recursos/planes','POST',{id_diagnostico:diagnosis.data.id,estado_plan:'En progreso',descuento_aplicado:0});assert.equal(multi.status,201);
  const serviceA=await admin('/api/recursos/detalles','POST',{id_plan:multi.data.id,id_tratamiento:1,diente:11,costo_unitario:40,estado_tratamiento:'Pendiente'});assert.equal(serviceA.status,201);
  const serviceB=await admin('/api/recursos/detalles','POST',{id_plan:multi.data.id,id_tratamiento:1,diente:21,costo_unitario:60,estado_tratamiento:'Pendiente'});assert.equal(serviceB.status,201);
  assert.equal((await admin('/api/recursos/planes/'+multi.data.id,'PUT',{descuento_aplicado:10})).status,200);
  const servicesAccount=await admin('/api/caja/pacientes/'+patientId+'/cuenta');const multiAccount=servicesAccount.data.planes.find((p:any)=>p.id_plan===multi.data.id);assert.equal(multiAccount.detalles.find((d:any)=>d.id_detalle_plan===serviceA.data.id).total_servicio,36);assert.equal(multiAccount.detalles.find((d:any)=>d.id_detalle_plan===serviceB.data.id).total_servicio,54);
  const payA={id_plan:multi.data.id,id_detalle_plan:serviceA.data.id,monto:'37',metodo_pago:'Efectivo',clave_pago:'00000000-0000-4000-8000-000000000011'};
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',payA)).status,409);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payA,id_detalle_plan:detail.data.id,monto:'20'})).status,400);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payA,monto:'20'})).status,201);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payA,id_detalle_plan:serviceB.data.id,monto:'54',clave_pago:'00000000-0000-4000-8000-000000000012'})).status,201);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...payA,monto:'16',clave_pago:'00000000-0000-4000-8000-000000000013'})).status,201);
  const servicePaid=(await admin('/api/caja/pacientes/'+patientId+'/cuenta')).data.planes.find((p:any)=>p.id_plan===multi.data.id);assert.equal(servicePaid.saldo_pendiente,0);assert.equal(servicePaid.detalles.find((d:any)=>d.id_detalle_plan===serviceA.data.id).pagado_servicio,36);assert.equal(servicePaid.detalles.find((d:any)=>d.id_detalle_plan===serviceB.data.id).pagado_servicio,54);
  assert.equal((await admin('/api/recursos/detalles/'+serviceA.data.id,'PUT',{costo_unitario:30})).status,409);
  await db.execute('UPDATE caja_cierres SET fecha_apertura=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 25 HOUR) WHERE id_cierre=?',[paymentCash.data.id]);
  const rolled=await admin('/api/caja');assert.equal(rolled.status,200);assert.notEqual(rolled.data.active.id_cierre,paymentCash.data.id);
  const autoClosed=await admin('/api/caja/'+paymentCash.data.id+'/detalle');assert.equal(autoClosed.data.caja.estado,'Cerrada');assert.equal(autoClosed.data.caja.cierre_automatico,1);assert.equal(Number(autoClosed.data.caja.monto_cierre_calculado),170);assert.equal(autoClosed.data.caja.monto_cierre_real,null);assert.equal(autoClosed.data.caja.diferencia,null);
  const [duration]:any=await db.query('SELECT TIMESTAMPDIFF(HOUR,fecha_apertura,fecha_cierre) hours FROM caja_cierres WHERE id_cierre=?',[paymentCash.data.id]);assert.equal(duration[0].hours,24);
  assert.equal((await admin('/api/caja')).data.active.id_cierre,rolled.data.active.id_cierre);
  assert.equal((await admin('/api/caja/cerrar','POST',{monto_cierre_real:80})).status,404);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',payment)).status,200);
  assert.equal((await admin('/api/reportes/pacientes?format=xlsx')).status,200);assert.equal((await admin('/api/clinica/pacientes/'+patientId+'/historial')).data.planes.length,2);
  const receptionist=client();await receptionist('/api/auth/me');assert.equal((await receptionist('/api/auth/login','POST',{correo:'recepcion@validation.local',contrasena:password})).status,200);assert.equal((await receptionist('/api/caja')).status,200);assert.equal((await receptionist('/api/recursos/usuarios')).status,403);assert.equal((await receptionist('/api/opciones/usuarios')).status,200);
  assert.equal((await receptionist('/api/caja/'+cash.data.active.id_cierre+'/detalle')).status,403);assert.equal((await client()('/api/caja/'+cash.data.active.id_cierre+'/detalle')).status,401);
  // La Recepcionista cobra: ve el estado de cuenta y, al reenviar un pago ya registrado (misma clave), no se duplica.
  assert.equal((await receptionist('/api/caja/pacientes/'+patientId+'/cuenta')).status,200);const resent=await receptionist('/api/caja/pacientes/'+patientId+'/pagos','POST',payment);assert.equal(resent.status,200);assert.equal(resent.data.repetido,true);
  assert.equal((await receptionist('/api/recursos/usuarios/2')).status,403);assert.equal((await client()('/api/recursos/usuarios/2')).status,401);
  assert.equal((await receptionist('/api/recursos/diagnosticos')).status,403);assert.equal((await receptionist('/api/recursos/comprobantes')).status,200);assert.equal((await receptionist('/api/clinica/pacientes/'+patientId+'/historial')).status,403);assert.equal((await receptionist('/api/reportes/planes')).status,403);assert.equal((await receptionist('/api/recursos/pacientes')).status,200);
  const other=await admin('/api/recursos/pacientes','POST',{nombre:'Otro',apellido:'Paciente',dni:'80000002',fecha_nacimiento:'2000-01-01',sexo:'Otro',telefono:'999999997',direccion:'Prueba',correo:null,id_categoria:null});assert.equal(other.status,201);
  const doctor=client();await doctor('/api/auth/me');assert.equal((await doctor('/api/auth/login','POST',{correo:'doctor@validation.local',contrasena:password})).status,200);
  assert.equal((await doctor('/api/clinica/pacientes/'+patientId+'/historial')).status,200);assert.equal((await doctor('/api/recursos/pacientes/'+patientId)).status,200);assert.equal((await doctor('/api/clinica/pacientes/'+other.data.id+'/historial')).status,403);assert.equal((await doctor('/api/recursos/pacientes/'+other.data.id)).status,403);assert.equal((await doctor('/api/recursos/comprobantes')).status,403);assert.equal((await doctor('/api/comprobantes/1/detalle')).status,403);
  // H-01: un Doctor no puede darse acceso a la historia de un paciente ajeno agendándose una cita ni reasignando una cita de otro doctor.
  {
   const third=await admin('/api/recursos/pacientes','POST',{nombre:'Tercer',apellido:'Paciente',dni:'80000003',fecha_nacimiento:'2000-01-01',sexo:'Otro',telefono:'999999996',direccion:'Prueba',correo:null,id_categoria:null});assert.equal(third.status,201);
   assert.equal((await admin('/api/recursos/diagnosticos','POST',{id_paciente:third.data.id,id_doctor:5,observaciones_generales:'Historia de otro doctor'})).status,201);
   const selfBooked={id_paciente:third.data.id,id_doctor:2,fecha:'2020-01-01',hora:'08:00',id_categoria_cita:1,motivo:'Acceso indebido',estado:'Cancelada'};
   assert.equal((await doctor('/api/recursos/citas','POST',selfBooked)).status,403);
   assert.equal((await doctor('/api/clinica/pacientes/'+third.data.id+'/historial')).status,403);
   const othersVisit=await admin('/api/recursos/citas','POST',{id_paciente:third.data.id,id_doctor:5,fecha:'2026-11-03',hora:'08:00',id_categoria_cita:1,motivo:'Control',estado:'Pendiente'});assert.equal(othersVisit.status,201,JSON.stringify(othersVisit.data));
   assert.equal((await doctor('/api/recursos/citas/'+othersVisit.data.id,'PUT',{id_doctor:2})).status,403);
   assert.equal((await doctor('/api/clinica/pacientes/'+third.data.id+'/historial')).status,403);
   // Paciente nuevo (sin historia clínica): el Doctor sí puede agendarlo, pero solo a su nombre.
   assert.equal((await doctor('/api/recursos/citas','POST',{...selfBooked,id_paciente:other.data.id,id_doctor:5})).status,403);
   assert.equal((await doctor('/api/recursos/citas','POST',{...selfBooked,id_paciente:other.data.id,motivo:'Primera cita'})).status,201);
   assert.equal((await admin('/api/recursos/pacientes/'+third.data.id,'DELETE')).status,200);
  }
  // H-02: el Doctor no puede registrar a nombre de otro doctor ni apropiarse de un diagnóstico o evolución ajenos; la corrección compartida sigue permitida.
  {
   const foreignDiag=await admin('/api/recursos/diagnosticos','POST',{id_paciente:patientId,id_doctor:5,observaciones_generales:'Diagnóstico de otro doctor'});assert.equal(foreignDiag.status,201);
   assert.equal((await doctor('/api/recursos/diagnosticos/'+foreignDiag.data.id,'PUT',{id_doctor:2})).status,403);
   assert.equal((await doctor('/api/recursos/diagnosticos','POST',{id_paciente:patientId,id_doctor:5,observaciones_generales:'A nombre de otro'})).status,403);
   assert.equal((await doctor('/api/recursos/evoluciones','POST',{id_detalle_plan:detail.data.id,id_doctor:5,descripcion_procedimiento:'A nombre de otro'})).status,403);
   assert.equal((await doctor('/api/recursos/diagnosticos/'+foreignDiag.data.id,'PUT',{observaciones_generales:'Corrección compartida'})).status,200);
   const kept=(await admin('/api/recursos/diagnosticos/'+foreignDiag.data.id)).data;assert.equal(kept.id_doctor,5);assert.equal(kept.observaciones_generales,'Corrección compartida');
  }
  const voidPlan=await admin('/api/recursos/planes','POST',{id_diagnostico:diagnosis.data.id,estado_plan:'En progreso',descuento_aplicado:0});assert.equal(voidPlan.status,201);
  const voidService=await admin('/api/recursos/detalles','POST',{id_plan:voidPlan.data.id,id_tratamiento:1,diente:31,costo_unitario:50,estado_tratamiento:'Pendiente'});assert.equal(voidService.status,201);
  const voidKey='00000000-0000-4000-8000-000000000021';const voidBody={id_plan:voidPlan.data.id,id_detalle_plan:voidService.data.id,monto:'20',metodo_pago:'Efectivo',clave_pago:voidKey};
  const voidPay=await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',voidBody);assert.equal(voidPay.status,201);
  const voidUrl='/api/caja/pacientes/'+patientId+'/pagos/'+voidPay.data.id_movimiento+'/anular';
  assert.equal((await admin(voidUrl,'POST',{motivo:'x'})).status,400);assert.equal((await receptionist(voidUrl,'POST',{motivo:'Pago registrado por error'})).status,403);
  assert.equal((await admin(voidUrl,'POST',{motivo:'Pago registrado por error'})).status,200);assert.equal((await admin(voidUrl,'POST',{motivo:'Pago registrado por error'})).status,409);
  const voidAccount=(await admin('/api/caja/pacientes/'+patientId+'/cuenta')).data;const voidedPlan=voidAccount.planes.find((p:any)=>p.id_plan===voidPlan.data.id);assert.equal(Number(voidedPlan.monto_pagado),0);assert.equal(voidedPlan.estado_pago,'Pendiente');assert.equal(voidedPlan.saldo_pendiente,50);assert.equal(voidAccount.pagos.find((p:any)=>p.id_movimiento===voidPay.data.id_movimiento).anulado,1);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',voidBody)).status,409);
  assert.equal((await admin('/api/recursos/comprobantes','POST',{id_movimiento:voidPay.data.id_movimiento,tipo_comprobante:'Boleta',serie:'B001'})).status,400);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{...voidBody,monto:'50',clave_pago:'00000000-0000-4000-8000-000000000022'})).status,201);
  assert.equal((await admin('/api/caja/pacientes/'+patientId+'/pagos/'+partial.data.id_movimiento+'/anular','POST',{motivo:'Intento con comprobante'})).status,409);
  assert.equal((await receptionist('/api/configuracion')).status,403);assert.equal((await admin('/api/configuracion','PUT',{ruc:'123'})).status,400);assert.equal((await admin('/api/configuracion','PUT',{razon_social:'Clínica de Validación SAC',ruc:'20123456789',telefono:'999 888 777',mapa_url:'https://www.google.com/maps/embed?pb=!1m18'})).status,200);
  assert.equal((await admin('/api/configuracion')).data.ruc,'20123456789');assert.equal((await admin('/api/configuracion','PUT',{whatsapp:'abc'})).status,400);assert.equal((await admin('/api/configuracion','PUT',{whatsapp:'+51 987-654-321'})).data.whatsapp,'51987654321');assert.equal((await admin('/api/comprobantes/'+paymentReceipt.data.id+'/detalle')).data.empresa.razon_social,'Clínica de Validación SAC');
  const visitor=client();await visitor('/api/auth/me');assert.equal((await visitor('/api/publico')).data.map,'https://www.google.com/maps/embed?pb=!1m18');assert.equal((await visitor('/api/publico')).data.contact.whatsapp,'51987654321');assert.equal((await visitor('/api/publico')).data.contact.ruc,'20123456789');
  assert.equal((await visitor('/api/publico/solicitud','POST',{nombre:'Visitante',telefono:'999111222',mensaje:'Quisiera una cita'})).status,201);assert.equal((await visitor('/api/publico/solicitud','POST',{nombre:'Bot',correo:'bot@example.com',mensaje:'spam spam',sitio_web:'http://spam'})).status,201);assert.equal((await visitor('/api/publico/solicitud','POST',{nombre:'X',mensaje:'hola'})).status,400);
  assert.equal((await admin('/api/recursos/solicitudes')).data.total,1);assert.equal((await receptionist('/api/recursos/solicitudes')).status,403);
  const [queued]:any=await db.query("SELECT COUNT(*) n FROM cola_correos WHERE asunto LIKE 'Nueva solicitud%'");assert.equal(queued[0].n,1);
  assert.equal((await receptionist('/api/correo/estado')).status,403);assert.equal((await admin('/api/correo/estado')).data.configurado,true);
  assert.equal((await admin('/api/correo/comprobantes/'+paymentReceipt.data.id,'POST',{correo:'no es un correo'})).status,400);assert.equal((await receptionist('/api/correo/comprobantes/'+paymentReceipt.data.id,'POST',{correo:'paciente@example.com'})).status,403);assert.equal((await admin('/api/correo/comprobantes/'+paymentReceipt.data.id,'POST',{correo:'paciente@example.com'})).status,202);
  const [receiptMail]:any=await db.query("SELECT COUNT(*) n FROM cola_correos WHERE destinatario='paciente@example.com'");assert.equal(receiptMail[0].n,1);
  const verDiag=await admin('/api/recursos/diagnosticos','POST',{id_paciente:patientId,id_doctor:2,observaciones_generales:'Control de versiones',odontograma:[{numero_pieza:11,estado_general_pieza:'Sano'},{numero_pieza:21,estado_general_pieza:'Sano'}]});assert.equal(verDiag.status,201);const verUrl='/api/clinica/diagnosticos/'+verDiag.data.id+'/odontograma/version';
  const histOf=async()=>(await admin('/api/clinica/pacientes/'+patientId+'/historial')).data.diagnosticos.find((d:any)=>d.id_diagnostico===verDiag.data.id);
  assert.equal((await histOf()).versiones.length,1);assert.equal((await admin(verUrl,'POST',{piezas:[{numero_pieza:11,estado_general_pieza:'Sano'}]})).status,400);
  const v2=await admin(verUrl,'POST',{piezas:[{numero_pieza:11,estado_general_pieza:'Caries',cara_oclusal:'Caries'}],nota:'Caries nueva en 11'});assert.equal(v2.status,201);assert.equal(v2.data.numero,2);assert.deepEqual(v2.data.cambios,[11]);
  const afterV2=await histOf();assert.equal(afterV2.versiones.length,2);assert.equal(afterV2.versiones[0].nota,'Caries nueva en 11');assert.equal(afterV2.versiones[1].piezas.find((p:any)=>p.numero_pieza===11).estado_general_pieza,'Sano');assert.equal(afterV2.odontograma.find((p:any)=>p.numero_pieza===11).estado_general_pieza,'Caries');
  assert.equal((await receptionist(verUrl,'POST',{piezas:[{numero_pieza:11,estado_general_pieza:'Sano'}]})).status,403);
  assert.equal((await admin('/api/recursos/diagnosticos/'+verDiag.data.id,'PUT',{observaciones_generales:'Control de versiones',odontograma:[{numero_pieza:21,estado_general_pieza:'Caries'}]})).status,200);const afterEdit=await histOf();assert.equal(afterEdit.versiones.length,2);assert.equal(afterEdit.versiones[0].piezas.find((p:any)=>p.numero_pieza===21).estado_general_pieza,'Caries');assert.equal(afterEdit.versiones[1].piezas.find((p:any)=>p.numero_pieza===21).estado_general_pieza,'Sano');
  assert.ok(String((await admin('/api/opciones/diagnosticos')).data[0].label).includes(' · '));assert.ok(String((await admin('/api/opciones/planes')).data[0].label).startsWith('Plan #'));
  const otherDiag=await admin('/api/recursos/diagnosticos','POST',{id_paciente:other.data.id,id_doctor:2,observaciones_generales:'Diagnóstico para plan completo'});assert.equal(otherDiag.status,201);
  const planBody={id_diagnostico:otherDiag.data.id,estado_plan:'Propuesto',descuento_aplicado:10,tratamientos:[{id_tratamiento:1,diente:11,costo_unitario:50},{id_tratamiento:1,diente:21,costo_unitario:30}]};
  assert.ok((await admin('/api/clinica/catalogo')).data.length>=1);assert.equal((await receptionist('/api/clinica/catalogo')).status,403);
  assert.equal((await admin('/api/clinica/planes/completo','POST',{...planBody,tratamientos:[]})).status,400);assert.equal((await admin('/api/clinica/planes/completo','POST',{...planBody,descuento_aplicado:500})).status,400);assert.equal((await admin('/api/clinica/planes/completo','POST',{...planBody,tratamientos:[{id_tratamiento:1,diente:99,costo_unitario:50}]})).status,400);assert.equal((await receptionist('/api/clinica/planes/completo','POST',planBody)).status,403);
  const fullPlan=await admin('/api/clinica/planes/completo','POST',planBody);assert.equal(fullPlan.status,201,JSON.stringify(fullPlan.data));assert.equal(fullPlan.data.tratamientos,2);
  const planInHistory=(await admin('/api/clinica/pacientes/'+other.data.id+'/historial')).data.planes.find((p:any)=>p.id_plan===fullPlan.data.id_plan);assert.equal(planInHistory.detalles.length,2);assert.equal(Number(planInHistory.costo_total),80);assert.equal(Number(planInHistory.descuento_aplicado),10);
  const [orphans]:any=await db.query('SELECT COUNT(*) n FROM planes_tratamiento p WHERE p.id_diagnostico=? AND NOT EXISTS (SELECT 1 FROM planes_tratamiento_detalle d WHERE d.id_plan=p.id_plan)',[otherDiag.data.id]);assert.equal(orphans[0].n,0);
  const signUrl='/api/firma/diagnosticos/'+diagnosis.data.id;
  assert.equal((await doctor(signUrl,'POST',{pin:'1234'})).status,409);assert.equal((await doctor('/api/firma/pin','POST',{contrasena:'incorrecta',pin:'4321'})).status,403);assert.equal((await doctor('/api/firma/pin','POST',{contrasena:password,pin:'12'})).status,400);assert.equal((await doctor('/api/firma/pin','POST',{contrasena:password,pin:'4321'})).status,200);
  assert.equal((await doctor(signUrl,'POST',{pin:'0000'})).status,403);assert.equal((await receptionist(signUrl,'POST',{pin:'4321'})).status,403);assert.equal((await admin(signUrl,'POST',{pin:'4321'})).status,403);
  assert.equal((await doctor('/api/recursos/diagnosticos')).data.data.find((d:any)=>d.id_diagnostico===diagnosis.data.id).puede_firmar,1);
  assert.equal((await doctor(signUrl,'POST',{pin:'4321'})).status,200);assert.equal((await doctor(signUrl,'POST',{pin:'4321'})).status,409);
  assert.equal((await admin('/api/recursos/diagnosticos/'+diagnosis.data.id,'PUT',{observaciones_generales:'Cambio posterior'})).status,409);assert.equal((await admin('/api/recursos/diagnosticos/'+diagnosis.data.id,'DELETE')).status,409);
  const signature=await doctor(signUrl);assert.equal(signature.data.firmado,true);assert.equal(signature.data.integro,true);assert.equal((await doctor('/api/recursos/diagnosticos')).data.data.find((d:any)=>d.id_diagnostico===diagnosis.data.id).firmado,1);
  await db.execute('UPDATE diagnosticos SET observaciones_generales="Alterado fuera de la aplicación" WHERE id_diagnostico=?',[diagnosis.data.id]);assert.equal((await doctor(signUrl)).data.integro,false);
  assert.equal((await admin('/api/recursos/pacientes/'+patientId,'DELETE')).status,200);const [preserved]:any=await db.query('SELECT COUNT(*) n FROM pacientes WHERE id_paciente=?',[patientId]);assert.equal(preserved[0].n,1);assert.equal((await admin('/api/recursos/pacientes')).data.total,1);
  assert.equal((await visitor('/api/auth/login','POST',{correo:'admin@validation.local',contrasena:'incorrecta'})).status,401);
  assert.equal((await admin('/api/recursos/auditoria')).status,200);assert.equal((await receptionist('/api/recursos/auditoria')).status,403);assert.equal((await admin('/api/recursos/auditoria','POST',{accion:'x'})).status,405);
  // Fases 2 y 3: atención del día (estado de cita), agenda, inicio por rol, comprobante con plan, reporte por doctor y PDF.
  {
   const today=(await db.query('SELECT DATE_FORMAT(CURRENT_DATE,"%Y-%m-%d") d') as any)[0][0].d;
   const visit=await admin('/api/recursos/citas','POST',{id_paciente:patientId,id_doctor:2,fecha:today,hora:'09:30',id_categoria_cita:1,motivo:'Atención guiada',estado:'Pendiente'});assert.equal(visit.status,201,JSON.stringify(visit.data));
   assert.equal((await admin('/api/clinica/citas/'+visit.data.id+'/estado','POST',{estado:'Cancelada'})).status,400);
   assert.equal((await receptionist('/api/clinica/citas/'+visit.data.id+'/estado','POST',{estado:'Confirmada'})).status,200);
   assert.equal((await doctor('/api/clinica/citas/'+visit.data.id+'/estado','POST',{estado:'Atendida'})).status,200);
   assert.equal((await admin('/api/recursos/citas/'+visit.data.id)).data.estado,'Atendida');
   assert.equal((await admin('/api/clinica/citas/'+visit.data.id+'/estado','POST',{estado:'Confirmada'})).status,409);
   assert.equal((await admin('/api/clinica/citas/999999/estado','POST',{estado:'Confirmada'})).status,404);
   const [stateAudit]:any=await db.query("SELECT COUNT(*) n FROM dentino_audit WHERE modulo='citas' AND registro=? AND accion IN ('estado_confirmada','estado_atendida')",[visit.data.id]);assert.equal(Number(stateAudit[0].n),2);
   const doctorHome=await doctor('/api/dashboard');assert.equal(doctorHome.status,200);assert.ok(doctorHome.data.today.every((c:any)=>c.id_doctor===2));assert.ok(doctorHome.data.today.some((c:any)=>c.id_cita===visit.data.id&&c.id_paciente===patientId));assert.deepEqual(doctorHome.data.pending,[]);assert.deepEqual(doctorHome.data.alerts,[]);
   const adminHome=await admin('/api/dashboard');assert.ok(Array.isArray(adminHome.data.pending));assert.ok(adminHome.data.alerts.every((a:any)=>['Vencido','Agotado','Por vencer','Por agotarse'].includes(a.tipo)));
   const agenda=await receptionist('/api/clinica/agenda?inicio='+today+'&fin='+today+'&doctor=2');assert.equal(agenda.status,200);assert.ok(agenda.data.some((c:any)=>c.id_cita===visit.data.id&&c.fecha===today));
   assert.equal((await doctor('/api/clinica/agenda?inicio=2026-01-01&fin=2026-12-31')).status,400);
   assert.equal((await doctor('/api/clinica/agenda?inicio=2026-02-01&fin=2026-01-01')).status,400);
   const flowPlan=await admin('/api/clinica/planes/completo','POST',{id_diagnostico:diagnosis.data.id,estado_plan:'En progreso',descuento_aplicado:0,tratamientos:[{id_tratamiento:1,diente:21,costo_unitario:50}]});assert.equal(flowPlan.status,201,JSON.stringify(flowPlan.data));
   const flowAccount=await admin('/api/caja/pacientes/'+patientId+'/cuenta');const target=flowAccount.data.planes.find((x:any)=>x.saldo_pendiente>0&&x.detalles.some((d:any)=>d.saldo_servicio>0));assert.ok(target);const service=target.detalles.find((d:any)=>d.saldo_servicio>0);
   const flowPay=await admin('/api/caja/pacientes/'+patientId+'/pagos','POST',{id_plan:target.id_plan,id_detalle_plan:service.id_detalle_plan,monto:'10.00',metodo_pago:'Yape',nota:'Atención guiada',clave_pago:crypto.randomUUID()});assert.equal(flowPay.status,201,JSON.stringify(flowPay.data));
   // Inicio: una cita cuyo paciente ya pagó ese día viene marcada como pagada (en lugar de «Cobrar»); sin pago del día, no.
   const unpaidVisit=await admin('/api/recursos/citas','POST',{id_paciente:other.data.id,id_doctor:2,fecha:today,hora:'11:00',id_categoria_cita:1,motivo:'Sin pago',estado:'Atendida'});assert.equal(unpaidVisit.status,201,JSON.stringify(unpaidVisit.data));
   const paidHome=(await admin('/api/dashboard')).data.today;assert.equal(paidHome.find((c:any)=>c.id_cita===visit.data.id).pagado,1);assert.equal(paidHome.find((c:any)=>c.id_cita===unpaidVisit.data.id).pagado,0);
   assert.ok((await doctor('/api/dashboard')).data.today.every((c:any)=>Number(c.pagado)===0),'el estado de pago solo se envía al Administrador');
   const quick=await admin('/api/recursos/comprobantes','POST',{id_movimiento:flowPay.data.id_movimiento,tipo_comprobante:'Factura',serie:'F001',correlativo:999});assert.equal(quick.status,201,JSON.stringify(quick.data));
   const quickDetail=await admin('/api/comprobantes/'+quick.data.id+'/detalle');assert.notEqual(quickDetail.data.correlativo,999);assert.ok(quickDetail.data.correlativo>=1);assert.equal(quickDetail.data.plan.id_plan,target.id_plan);assert.ok(quickDetail.data.tratamientos.length>=1);assert.ok(quickDetail.data.tratamientos.every((t:any)=>typeof t.nombre_tratamiento==='string'));
   const perDoctor=await admin('/api/reportes/doctores?inicio='+today+'&fin='+today);assert.equal(perDoctor.status,200);const row=perDoctor.data.find((r:any)=>r.doctor==='Prueba Aislada'&&r.rol==='Doctor');assert.ok(row&&row.atendidas>=1);
   assert.equal((await receptionist('/api/reportes/doctores')).status,403);assert.equal((await doctor('/api/reportes/doctores')).status,403);
   for(const kind of ['citas','doctores','inventario']){const pdf=await admin('/api/reportes/'+kind+'?inicio=2026-01-01&fin=2026-12-31&format=pdf');assert.equal(pdf.status,200);assert.equal(pdf.r.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(pdf.data as ArrayBuffer).subarray(0,5).toString(),'%PDF-');}
   const [indexes]:any=await db.query("SELECT COUNT(DISTINCT INDEX_NAME) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND INDEX_NAME IN ('idx_citas_fecha','idx_citas_doctor_fecha','idx_movimientos_fecha')");assert.equal(Number(indexes[0].n),3);
  }
  // Auditoría 2, hallazgos medios.
  {
   // M-01: una cita «No asistió» libera su horario; volver a confirmarla debe revalidar que el horario siga libre.
   const missed=await admin('/api/recursos/citas','POST',{id_paciente:other.data.id,id_doctor:2,fecha:'2026-11-04',hora:'10:00',id_categoria_cita:1,motivo:'Control',estado:'Pendiente'});assert.equal(missed.status,201,JSON.stringify(missed.data));
   assert.equal((await admin('/api/clinica/citas/'+missed.data.id+'/estado','POST',{estado:'No asistió'})).status,200);
   const replacement=await admin('/api/recursos/citas','POST',{id_paciente:other.data.id,id_doctor:2,fecha:'2026-11-04',hora:'10:00',id_categoria_cita:1,motivo:'Reemplazo',estado:'Pendiente'});assert.equal(replacement.status,201,JSON.stringify(replacement.data));
   assert.equal((await admin('/api/clinica/citas/'+missed.data.id+'/estado','POST',{estado:'Confirmada'})).status,409);
   assert.equal((await admin('/api/recursos/citas/'+replacement.data.id,'DELETE')).status,200);
   assert.equal((await admin('/api/clinica/citas/'+missed.data.id+'/estado','POST',{estado:'Confirmada'})).status,200);
   // M-02: un comprobante emitido no se edita (serie, tipo o movimiento romperían la numeración).
   assert.equal((await admin('/api/recursos/comprobantes/'+paymentReceipt.data.id,'PUT',{serie:'F001',tipo_comprobante:'Factura'})).status,405);
   const unchanged=(await admin('/api/comprobantes/'+paymentReceipt.data.id+'/detalle')).data;assert.equal(unchanged.serie,'B001');assert.equal(unchanged.tipo_comprobante,'Boleta');
   // M-03: un plan (con pagos) o un diagnóstico con planes no pasan a otro paciente; dentro del mismo paciente sí se puede reasignar.
   assert.equal((await admin('/api/recursos/planes/'+plan.data.id,'PUT',{id_diagnostico:otherDiag.data.id})).status,409);
   assert.equal((await admin('/api/recursos/diagnosticos/'+otherDiag.data.id,'PUT',{id_paciente:patientId})).status,409);
   assert.equal((await admin('/api/recursos/planes/'+plan.data.id)).data.id_diagnostico,diagnosis.data.id);assert.equal((await admin('/api/recursos/diagnosticos/'+otherDiag.data.id)).data.id_paciente,other.data.id);
   assert.equal((await admin('/api/recursos/planes/'+plan.data.id,'PUT',{id_diagnostico:verDiag.data.id})).status,200);
   // M-04a: a un diagnóstico firmado se le pueden agregar exámenes, pero los existentes no se editan ni se borran.
   const lateForm=new FormData();lateForm.append('archivo',new Blob(['%PDF-1.4\n% posterior'],{type:'application/pdf'}),'posterior.pdf');const lateUpload=await admin('/api/archivos','POST',lateForm);assert.equal(lateUpload.status,201);
   try{
    const lateExam=await admin('/api/recursos/examenes','POST',{id_diagnostico:diagnosis.data.id,tipo_examen:'Fotografías',ruta_archivo:lateUpload.data.path,notas:'Posterior a la firma'});assert.equal(lateExam.status,201,JSON.stringify(lateExam.data));
    assert.equal((await admin('/api/recursos/examenes/'+lateExam.data.id,'PUT',{notas:'Cambiado'})).status,409);
    assert.equal((await admin('/api/recursos/examenes/'+lateExam.data.id,'DELETE')).status,409);
   }finally{await (await import('node:fs/promises')).unlink(lateUpload.data.path);}
   // M-04b: firmar un diagnóstico sin odontograma y luego agregar una versión no debe dar una falsa alarma de integridad.
   const bare=await admin('/api/recursos/diagnosticos','POST',{id_paciente:other.data.id,id_doctor:2,observaciones_generales:'Sin odontograma al firmar'});assert.equal(bare.status,201);
   assert.equal((await doctor('/api/firma/diagnosticos/'+bare.data.id,'POST',{pin:'4321'})).status,200);
   assert.equal((await admin('/api/clinica/diagnosticos/'+bare.data.id+'/odontograma/version','POST',{piezas:[{numero_pieza:16,estado_general_pieza:'Caries'}],nota:'Hallazgo posterior'})).status,201);
   assert.equal((await doctor('/api/firma/diagnosticos/'+bare.data.id)).data.integro,true);
   // M-05: el Doctor externo ve solo sus citas (listado, detalle y reporte); el Doctor sigue viendo todas para agendar.
   await db.execute("UPDATE usuarios SET estado='Activo' WHERE id_usuario=4");
   const external=client();await external('/api/auth/me');assert.equal((await external('/api/auth/login','POST',{correo:'externo@validation.local',contrasena:password})).status,200);
   const externalVisit=await admin('/api/recursos/citas','POST',{id_paciente:other.data.id,id_doctor:4,fecha:'2026-11-05',hora:'08:00',id_categoria_cita:1,motivo:'Interconsulta',estado:'Pendiente'});assert.equal(externalVisit.status,201,JSON.stringify(externalVisit.data));
   const externalList=(await external('/api/recursos/citas?size=200')).data.data;assert.ok(externalList.some((c:any)=>c.id_cita===externalVisit.data.id));assert.ok(externalList.every((c:any)=>c.id_doctor===4),'el Doctor externo ve citas ajenas');
   assert.equal((await external('/api/recursos/citas/'+missed.data.id)).status,403);assert.equal((await external('/api/recursos/citas/'+externalVisit.data.id)).status,200);
   assert.equal((await external('/api/reportes/citas?inicio=2000-01-01&fin=2099-12-31')).data.length,1);
   assert.ok((await doctor('/api/recursos/citas?size=200')).data.data.some((c:any)=>c.id_doctor!==2));
   // M-06: si un comprobante se confirma mientras se anula su pago, la anulación debe verlo y rechazarse (409).
   const raceAccount=(await admin('/api/caja/pacientes/'+other.data.id+'/cuenta')).data;const racePlan=raceAccount.planes.find((p:any)=>p.saldo_pendiente>0&&p.detalles.some((d:any)=>d.saldo_servicio>0));assert.ok(racePlan);
   const racePay=await admin('/api/caja/pacientes/'+other.data.id+'/pagos','POST',{id_plan:racePlan.id_plan,id_detalle_plan:racePlan.detalles.find((d:any)=>d.saldo_servicio>0).id_detalle_plan,monto:'5.00',metodo_pago:'Efectivo',clave_pago:'00000000-0000-4000-8000-000000000061'});assert.equal(racePay.status,201,JSON.stringify(racePay.data));
   const raceTx=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:name});
   try{
    await raceTx.beginTransaction();await raceTx.execute('INSERT INTO comprobantes(id_movimiento,tipo_comprobante,serie,correlativo) VALUES (?,?,?,?)',[racePay.data.id_movimiento,'Boleta','B099',1]);
    const voiding=admin('/api/caja/pacientes/'+other.data.id+'/pagos/'+racePay.data.id_movimiento+'/anular','POST',{motivo:'Carrera con comprobante'});
    await new Promise(r=>setTimeout(r,700));await raceTx.commit();
    assert.equal((await voiding).status,409);
   }finally{await raceTx.end();}
   // M-07: un movimiento manual repetido (doble clic o reintento con la misma clave) se registra una sola vez.
   const manual={subtotal:12,descuento_tipo:'ninguno',tipo_movimiento:'Egreso',metodo_pago:'Efectivo',descripcion:'Compra de insumos (validación)',clave_pago:'00000000-0000-4000-8000-000000000071'};
   const manualTwice=await Promise.all([admin('/api/caja/movimiento','POST',manual),admin('/api/caja/movimiento','POST',manual)]);assert.deepEqual(manualTwice.map(r=>r.status).sort(),[200,201]);
   const [manualRows]:any=await db.query('SELECT COUNT(*) n FROM caja_movimientos WHERE descripcion=?',[manual.descripcion]);assert.equal(Number(manualRows[0].n),1);
   assert.equal((await admin('/api/caja/movimiento','POST',{...manual,subtotal:13})).status,409);
   assert.equal((await admin('/api/caja/movimiento','POST',{...manual,clave_pago:undefined})).status,400);
  }
  // Auditoría 2, hallazgos bajos.
  {
   const outsider=client();await outsider('/api/auth/me');assert.equal((await outsider('/api/auth/login','POST',{correo:'externo@validation.local',contrasena:password})).status,200);
   const pdf=()=>{const f=new FormData();f.append('archivo',new Blob(['%PDF-1.4\n% acceso'],{type:'application/pdf'}),'acceso.pdf');return f;};
   // B-01: solo los roles que registran exámenes suben archivos, y cada archivo se sirve solo a quien puede ver el examen que lo usa.
   for(const role of [outsider,receptionist]){const denied=await role('/api/archivos','POST',pdf());if(denied.status===201)await (await import('node:fs/promises')).unlink((denied.data as any).path);assert.equal(denied.status,403);}
   const fourth=await admin('/api/recursos/pacientes','POST',{nombre:'Cuarto',apellido:'Paciente',dni:'80000004',fecha_nacimiento:'2000-01-01',sexo:'Otro',telefono:'999999995',direccion:'Prueba',correo:null,id_categoria:null});assert.equal(fourth.status,201);
   const foreignDiagnosis=await admin('/api/recursos/diagnosticos','POST',{id_paciente:fourth.data.id,id_doctor:5,observaciones_generales:'Paciente de otro doctor'});assert.equal(foreignDiagnosis.status,201);
   const privateUpload=await admin('/api/archivos','POST',pdf());assert.equal(privateUpload.status,201);
   try{
    assert.equal((await admin('/api/recursos/examenes','POST',{id_diagnostico:foreignDiagnosis.data.id,tipo_examen:'Fotografías',ruta_archivo:privateUpload.data.path,notas:'Privado'})).status,201);
    assert.equal((await doctor('/'+privateUpload.data.path)).status,403);assert.equal((await receptionist('/'+privateUpload.data.path)).status,403);assert.equal((await admin('/'+privateUpload.data.path)).status,200);
   }finally{await (await import('node:fs/promises')).unlink(privateUpload.data.path);}
   assert.equal((await admin('/api/recursos/pacientes/'+fourth.data.id,'DELETE')).status,200);
   // B-02: cambiar la contraseña cierra las sesiones abiertas de esa cuenta (salvo la propia de quien la cambia) y /auth/me no devuelve usuarios desactivados.
   const second=client();await second('/api/auth/me');assert.equal((await second('/api/auth/login','POST',{correo:'doctor2@validation.local',contrasena:password})).status,200);
   assert.equal((await admin('/api/recursos/usuarios/5','PUT',{contrasena:'NuevaClave_2026!'})).status,200);
   assert.equal((await second('/api/dashboard')).status,401);assert.equal((await second('/api/auth/me')).data.user,null);
   assert.equal((await second('/api/auth/login','POST',{correo:'doctor2@validation.local',contrasena:'NuevaClave_2026!'})).status,200);assert.equal((await second('/api/dashboard')).status,200);
   await db.execute("UPDATE usuarios SET estado='Inactivo' WHERE id_usuario=5");assert.equal((await second('/api/auth/me')).data.user,null);
   assert.equal((await admin('/api/recursos/usuarios/1','PUT',{contrasena:'AdminNueva_2026!'})).status,200);assert.equal((await admin('/api/dashboard')).status,200);
   // B-03: la agenda rechaza fechas imposibles (antes saltaban el límite de dos meses).
   assert.equal((await admin('/api/clinica/agenda?inicio=2026-01-01&fin=2026-13-01')).status,400);assert.equal((await admin('/api/clinica/agenda?inicio=2026-02-30&fin=2026-03-01')).status,400);
   // B-04: borrar el último comprobante de una serie no hace que su número se reutilice.
   assert.equal((await admin('/api/caja/movimiento','POST',{subtotal:30,descuento_tipo:'ninguno',tipo_movimiento:'Ingreso',metodo_pago:'Efectivo',descripcion:'Ingreso para numeración',clave_pago:'00000000-0000-4000-8000-000000000081'})).status,201);
   const numbered=(await admin('/api/caja')).data.movements.find((m:any)=>m.descripcion==='Ingreso para numeración');assert.ok(numbered);
   const firstNumber=await admin('/api/recursos/comprobantes','POST',{id_movimiento:numbered.id_movimiento,tipo_comprobante:'Boleta',serie:'B777'});assert.equal(firstNumber.status,201);assert.equal((await admin('/api/comprobantes/'+firstNumber.data.id+'/detalle')).data.correlativo,1);
   assert.equal((await admin('/api/recursos/comprobantes/'+firstNumber.data.id,'DELETE')).status,200);
   const secondNumber=await admin('/api/recursos/comprobantes','POST',{id_movimiento:numbered.id_movimiento,tipo_comprobante:'Boleta',serie:'B777'});assert.equal(secondNumber.status,201);assert.equal((await admin('/api/comprobantes/'+secondNumber.data.id+'/detalle')).data.correlativo,2);
   // B-06 (regresión): un descuento mayor que el presupuesto se rechaza también en un plan sin pagos.
   const unpaid=await admin('/api/clinica/planes/completo','POST',{id_diagnostico:otherDiag.data.id,estado_plan:'Propuesto',descuento_aplicado:0,tratamientos:[{id_tratamiento:1,diente:11,costo_unitario:40}]});assert.equal(unpaid.status,201);
   assert.equal((await admin('/api/recursos/planes/'+unpaid.data.id_plan,'PUT',{descuento_aplicado:9999})).status,409);assert.equal(Number((await admin('/api/recursos/planes/'+unpaid.data.id_plan)).data.descuento_aplicado),0);
   // Recepcionista en caja: cobra, emite comprobantes y registra ingresos y egresos; anular, borrar comprobantes, historial y correo siguen siendo de Administrador.
   assert.ok((await receptionist('/api/modulos')).data.some((m:any)=>m.key==='comprobantes'));
   const desk=await receptionist('/api/caja');assert.equal(desk.status,200);assert.deepEqual(desk.data.history,[]);assert.equal((await receptionist('/api/caja/'+desk.data.active.id_cierre+'/detalle')).status,403);
   assert.equal((await receptionist('/api/caja/movimiento','POST',{subtotal:15,descuento_tipo:'ninguno',tipo_movimiento:'Egreso',metodo_pago:'Efectivo',descripcion:'Pago de internet (recepción)',clave_pago:'00000000-0000-4000-8000-000000000091'})).status,201);
   const deskAccount=(await receptionist('/api/caja/pacientes/'+other.data.id+'/cuenta')).data;const deskPlan=deskAccount.planes.find((p:any)=>p.saldo_pendiente>=1&&p.detalles.some((d:any)=>d.saldo_servicio>=1));assert.ok(deskPlan);
   const deskPay=await receptionist('/api/caja/pacientes/'+other.data.id+'/pagos','POST',{id_plan:deskPlan.id_plan,id_detalle_plan:deskPlan.detalles.find((d:any)=>d.saldo_servicio>=1).id_detalle_plan,monto:'1.00',metodo_pago:'Yape',clave_pago:'00000000-0000-4000-8000-000000000092'});assert.equal(deskPay.status,201,JSON.stringify(deskPay.data));
   const deskReceipt=await receptionist('/api/recursos/comprobantes','POST',{id_movimiento:deskPay.data.id_movimiento,tipo_comprobante:'Boleta',serie:'B001'});assert.equal(deskReceipt.status,201,JSON.stringify(deskReceipt.data));
   assert.equal((await receptionist('/api/comprobantes/'+deskReceipt.data.id+'/detalle')).status,200);assert.equal((await receptionist('/api/recursos/comprobantes/'+deskReceipt.data.id,'DELETE')).status,403);
   assert.equal((await receptionist('/api/caja/pacientes/'+other.data.id+'/pagos/'+deskPay.data.id_movimiento+'/anular','POST',{motivo:'Prueba de permiso'})).status,403);
   assert.ok((await receptionist('/api/dashboard')).data.today.some((c:any)=>Number(c.pagado)===1),'la Recepcionista ve qué citas están pagadas');
   assert.equal((await doctor('/api/caja')).status,403);assert.equal((await doctor('/api/caja/pacientes/'+patientId+'/cuenta')).status,403);
   // B-07: distribuidores y laboratorios son de Administrador; los demás roles solo ven sus nombres en las listas desplegables.
   for(const key of ['distribuidores','laboratorios']){assert.equal((await doctor('/api/recursos/'+key)).status,403);assert.equal((await receptionist('/api/recursos/'+key+'/1','PUT',{telefono:'999999999'})).status,403);assert.equal((await admin('/api/recursos/'+key)).status,200);assert.equal((await doctor('/api/opciones/'+key)).status,200);}
  }
  assert.equal((await admin('/api/auth/logout','POST')).status,200);assert.equal((await admin('/api/dashboard')).status,401);
  const [events]:any=await db.query("SELECT accion,COUNT(*) n FROM dentino_audit WHERE accion IN ('login','logout','login_fallido','acceso_denegado') GROUP BY accion");const counts:any=Object.fromEntries(events.map((e:any)=>[e.accion,Number(e.n)]));assert.ok(counts.login>=3&&counts.logout>=1&&counts.login_fallido>=1&&counts.acceso_denegado>=1,JSON.stringify(counts));
  const [failed]:any=await db.query("SELECT detalle FROM dentino_audit WHERE accion='login_fallido' LIMIT 1");assert.ok(String(failed[0].detalle).startsWith('correo#')&&!String(failed[0].detalle).includes('validation.local'));
 }finally{server?.kill();await new Promise(r=>setTimeout(r,300));await db.query('DROP DATABASE IF EXISTS `'+name+'`');await db.end();}
});
