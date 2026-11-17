import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pool,rows,exec,transaction,quote} from './db.js';

// Explicit, additive demo data. A transaction and marker prevent partial or duplicate loads.
const marker='demo_20261010_v1';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima'}).format(new Date());
const day=(offset:number)=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
const manifest:{table:string;id:number}[]=[];
try {
 const summary=await transaction(async db=>{
  await exec('INSERT IGNORE INTO dentino_migrations(version) VALUES (?)',[marker],db).then(r=>{if(!r.affectedRows)throw new Error('DEMO_ALREADY_LOADED');});
  const insert=async(table:string,data:Record<string,unknown>)=>{
   const keys=Object.keys(data);
   const result=await exec(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(data),db);
   manifest.push({table,id:result.insertId});return result.insertId;
  };
  const specialty=await insert('especialidades',{nombre_especialidad:'Ortodoncia [DEMO]',descripcion:'Especialidad ficticia para explorar el sistema',estado:'Activo'});
  const patientCategory=await insert('categorias_pacientes',{nombre_categoria:'Paciente de prueba [DEMO]',descripcion:'Datos ficticios, sin atención real',descuento_default:0,color:'#84a978',estado:'Activo'});
  const appointmentCategory=await insert('categorias_citas',{nombre_categoria:'Control de prueba [DEMO]',duracion_minutos:30,color:'#84a978',estado:'Activo'});
  const treatmentCategory=await insert('categorias_tratamientos',{nombre_categoria:'Procedimientos de prueba [DEMO]',descripcion:'Catálogo ficticio',color:'#84a978',estado:'Activo'});
  const stockCategory=await insert('categorias_insumos',{nombre_categoria:'Materiales de prueba [DEMO]',descripcion:'Insumos ficticios',estado:'Activo'});
  const movementCategory=await insert('categorias_movimientos',{nombre_categoria:'Operaciones de prueba [DEMO]',tipo_movimiento:'Ingreso',descripcion:'Sin valor contable real',color:'#84a978',estado:'Activo'});
  const staff:number[]=[];
  for(const [i,name,role,shift] of [[1,'Lucía','Doctor','Mañana'],[2,'Mateo','Doctor externo','Tarde'],[3,'Valeria','Recepcionista','Mañana']] as const){
   staff.push(await insert('usuarios',{nombre:name,apellido:'Demo',dni:'9901000'+i,direccion:'Dirección ficticia [DEMO]',telefono:'000000000',correo:`equipo${i}@dentino-demo.invalid`,contrasena:await bcrypt.hash(randomBytes(32).toString('hex'),12),rol:role,id_especialidad:role==='Recepcionista'?null:specialty,turno:shift,estado:'Activo'}));
  }
  const patients:number[]=[];
  for(const [i,name,birth,sex] of [[1,'Ana','1995-03-15','Femenino'],[2,'Bruno','1988-08-21','Masculino'],[3,'Camila','2015-06-10','Femenino'],[4,'Diego','2001-11-04','Masculino'],[5,'Elena','1974-02-18','Femenino'],[6,'Felipe','1992-09-30','Masculino']] as const){
   patients.push(await insert('pacientes',{nombre:name,apellido:'Demo',dni:'9902000'+i,fecha_nacimiento:birth,sexo:sex,telefono:'000000000',correo:`paciente${i}@dentino-demo.invalid`,direccion:'Dirección ficticia [DEMO]',id_categoria:patientCategory,archivado:0}));
  }
  const treatments:number[]=[];
  for(const [name,price,duration] of [['Evaluación [DEMO]',60,30],['Resina [DEMO]',150,45],['Control de ortodoncia [DEMO]',100,30]] as const){treatments.push(await insert('catalogo_tratamientos',{nombre_tratamiento:name,id_categoria:treatmentCategory,precio_base:price,duracion_estimada:duration,estado:'Activo'}));}
  for(let i=0;i<6;i++)await insert('citas',{id_paciente:patients[i],id_doctor:i<3?staff[0]:staff[1],fecha:day(i<3?0:i-2),hora:i<3?['09:00','10:00','11:00'][i]:['14:00','15:00','16:00'][i-3],motivo:'Consulta ficticia para explorar la agenda [DEMO]',id_categoria_cita:appointmentCategory,estado:['Atendida','Confirmada','Pendiente','Confirmada','Pendiente','Cancelada'][i]});
  for(let i=0;i<3;i++){
   await insert('antecedentes_medicos',{id_paciente:patients[i],hipertension:i===2?1:0,diabetes:0,alergias:i===1?'Alergia ficticia [DEMO]':'Sin alergias registradas [DEMO]',observaciones:'Antecedentes ficticios de demostración',ultima_actualizacion:today+' 09:00:00'});
   const diagnosis=await insert('diagnosticos',{id_paciente:patients[i],id_doctor:staff[0],observaciones_generales:['Evaluación inicial con caries simulada [DEMO]','Seguimiento de ortodoncia ficticio [DEMO]','Revisión de dentición infantil [DEMO]'][i]});
   for(const tooth of i===2?[51,52,61,62]:[11,12,21,22])await insert('odontograma_piezas',{id_diagnostico:diagnosis,numero_pieza:tooth,estado_general_pieza:tooth===12?'Caries':i===1?'Bracket metálico':'Sano'});
   const plan=await insert('planes_tratamiento',{id_diagnostico:diagnosis,costo_total:210,monto_pagado:i===1?210:i===0?60:0,estado_pago:i===1?'Cancelado':i===0?'Parcial':'Pendiente',descuento_aplicado:0,estado_plan:['En progreso','Finalizado','Propuesto'][i]});
   await insert('planes_tratamiento_detalle',{id_plan:plan,id_tratamiento:treatments[0],diente:null,costo_unitario:60,estado_tratamiento:i<2?'Realizado':'Pendiente'});
   const detail=await insert('planes_tratamiento_detalle',{id_plan:plan,id_tratamiento:treatments[1],diente:i===2?51:12,costo_unitario:150,estado_tratamiento:i===1?'Realizado':'Pendiente'});
   if(i<2){const evolution=await insert('evoluciones',{id_detalle_plan:detail,id_doctor:staff[0],descripcion_procedimiento:'Evolución ficticia para explorar el historial [DEMO]',proxima_cita_sugerida:day(7)});if(i===1)await insert('ortodoncia_arcos',{id_evolucion:evolution,arcada:'Superior',tipo_arco:'NiTi [DEMO]',calibre:'0.014',higiene_paciente:'Buena',cooperacion:'Excelente'});}
  }
  for(const [name,stock,min,expiry] of [['Guantes [DEMO]',50,10,day(90)],['Resina [DEMO]',2,5,day(20)],['Material vencido [DEMO]',5,3,day(-5)]] as const){const item=await insert('inventario_insumos',{nombre_insumo:name,id_categoria:stockCategory,stock_actual:stock,stock_minimo:min,unidad_medida:'Unidades',ubicacion:'Almacén ficticio [DEMO]',fecha_vencimiento_proxima:expiry});await insert('inventario_movimientos',{id_insumo:item,tipo_cambio:'Entrada',cantidad:stock,motivo:'Carga inicial ficticia [DEMO]',id_usuario:staff[2]});}
  await insert('distribuidores',{nombre_empresa:'Proveedor ficticio [DEMO]',telefono:'000000000',vendedor_contacto:'Contacto Demo',estado:'Activo'});
  await insert('laboratorios',{nombre:'Laboratorio ficticio [DEMO]',contacto:'Contacto Demo',telefono:'000000000',correo:'laboratorio@dentino-demo.invalid',estado:'Activo'});
  // Closed sample cash register: never alter the real active register or issue real tax documents.
  const cash=await insert('caja_cierres',{id_usuario_caja:staff[2],monto_apertura:100,monto_cierre_calculado:220,monto_cierre_real:220,diferencia:0,estado:'Cerrada',fecha_cierre:today+' 12:00:00'});
  const payment=await insert('caja_movimientos',{id_cierre:cash,tipo_movimiento:'Ingreso',id_categoria_mov:movementCategory,monto:150,descuento:0,metodo_pago:'Efectivo',descripcion:'Ingreso ficticio SIN VALOR CONTABLE [DEMO]'});
  await insert('caja_movimientos',{id_cierre:cash,tipo_movimiento:'Egreso',monto:30,descuento:0,metodo_pago:'Efectivo',descripcion:'Egreso ficticio SIN VALOR CONTABLE [DEMO]'});
  await insert('comprobantes',{id_movimiento:payment,tipo_comprobante:'Boleta',serie:'DEMO',correlativo:1});
  return {patients:patients.length,staff:staff.length,appointments:6,plans:3,records:manifest.length};
 });
 const output=path.resolve('C:/Users/P_A_N/Documents/Codex/2026-10-10/linear-plugin-linear-openai-curated-remote/outputs');
 await mkdir(output,{recursive:true});await writeFile(path.join(output,'Dentino-datos-demo.json'),JSON.stringify({marker,date:today,summary,records:manifest},null,2));
 console.log(JSON.stringify({created:true,...summary}));
}catch(error){if((error as Error).message==='DEMO_ALREADY_LOADED')console.log('Los datos DEMO ya estaban cargados; no se duplicaron.');else {console.error('No se cargaron datos:',(error as any).code||(error as Error).message);process.exitCode=1;}}
finally{await pool.end();}
