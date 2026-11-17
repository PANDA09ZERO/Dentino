import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pool,rows,exec,transaction,quote} from './db.js';
// Manifiesto que deja seed-demo.ts. Carpeta configurable con DEMO_OUTPUT_DIR (por defecto work/demo, excluida de git).
const manifest=JSON.parse(await readFile(path.join(path.resolve(process.env.DEMO_OUTPUT_DIR||'work/demo'),'Dentino-datos-demo.json'),'utf8'));
const ids:number[]=manifest.records.filter((r:any)=>r.table==='pacientes').map((r:any)=>r.id);
async function summary(){return rows(`SELECT p.id_paciente,(SELECT COUNT(*) FROM antecedentes_medicos a WHERE a.id_paciente=p.id_paciente) antecedentes,(SELECT COUNT(*) FROM diagnosticos d WHERE d.id_paciente=p.id_paciente) diagnosticos,(SELECT COUNT(*) FROM odontograma_piezas o JOIN diagnosticos d ON d.id_diagnostico=o.id_diagnostico WHERE d.id_paciente=p.id_paciente) piezas,(SELECT COUNT(*) FROM planes_tratamiento t JOIN diagnosticos d ON d.id_diagnostico=t.id_diagnostico WHERE d.id_paciente=p.id_paciente) planes,(SELECT COUNT(*) FROM evoluciones e JOIN planes_tratamiento_detalle dt ON dt.id_detalle_plan=e.id_detalle_plan JOIN planes_tratamiento t ON t.id_plan=dt.id_plan JOIN diagnosticos d ON d.id_diagnostico=t.id_diagnostico WHERE d.id_paciente=p.id_paciente) evoluciones FROM pacientes p WHERE p.id_paciente IN (${ids.map(()=>'?')})`,ids);}
try{
 console.log('Antes:',JSON.stringify(await summary()));
 if(!process.argv.includes('--check'))await transaction(async db=>{
  const doctor=(await rows("SELECT id_usuario FROM usuarios WHERE correo='equipo1@dentino-demo.invalid' AND rol='Doctor'",[],db))[0];
  const treatment=(await rows("SELECT id_tratamiento,precio_base FROM catalogo_tratamientos WHERE nombre_tratamiento='Evaluación [DEMO]'",[],db))[0];
  if(!doctor||!treatment)throw new Error('No se encontraron las referencias DEMO');
  const insert=async(table:string,data:Record<string,unknown>)=>{const keys=Object.keys(data);return(await exec(`INSERT INTO ${quote(table)} (${keys.map(quote)}) VALUES (${keys.map(()=>'?')})`,Object.values(data),db)).insertId;};
  for(const id of ids){
   const p=(await rows('SELECT apellido,correo FROM pacientes WHERE id_paciente=? FOR UPDATE',[id],db))[0];if(p?.apellido!=='Demo'||!p.correo.endsWith('@dentino-demo.invalid'))throw new Error('El paciente no corresponde a la carga DEMO');
   if(!(await rows('SELECT 1 FROM antecedentes_medicos WHERE id_paciente=?',[id],db)).length)await insert('antecedentes_medicos',{id_paciente:id,hipertension:0,diabetes:0,alergias:'Sin alergias registradas [DEMO]',observaciones:'Antecedentes ficticios de demostración [DEMO]',ultima_actualizacion:new Date()});
   let diagnosis=(await rows('SELECT id_diagnostico FROM diagnosticos WHERE id_paciente=? ORDER BY id_diagnostico LIMIT 1',[id],db))[0]?.id_diagnostico;
   if(!diagnosis)diagnosis=await insert('diagnosticos',{id_paciente:id,id_doctor:doctor.id_usuario,observaciones_generales:'Evaluación odontológica ficticia [DEMO]'});
   if(!(await rows('SELECT 1 FROM odontograma_piezas WHERE id_diagnostico=?',[diagnosis],db)).length)for(const tooth of [11,12,21,22])await insert('odontograma_piezas',{id_diagnostico:diagnosis,numero_pieza:tooth,estado_general_pieza:tooth===12?'Caries':'Sano'});
   let plan=(await rows('SELECT id_plan FROM planes_tratamiento WHERE id_diagnostico=? ORDER BY id_plan LIMIT 1',[diagnosis],db))[0]?.id_plan;
   if(!plan)plan=await insert('planes_tratamiento',{id_diagnostico:diagnosis,costo_total:treatment.precio_base,monto_pagado:0,estado_pago:'Pendiente',estado_plan:'En progreso',descuento_aplicado:0});
   let detail=(await rows('SELECT id_detalle_plan FROM planes_tratamiento_detalle WHERE id_plan=? ORDER BY id_detalle_plan LIMIT 1',[plan],db))[0]?.id_detalle_plan;
   if(!detail)detail=await insert('planes_tratamiento_detalle',{id_plan:plan,id_tratamiento:treatment.id_tratamiento,diente:12,costo_unitario:treatment.precio_base,estado_tratamiento:'Pendiente'});
   if(!(await rows('SELECT 1 FROM evoluciones e JOIN planes_tratamiento_detalle dt ON dt.id_detalle_plan=e.id_detalle_plan WHERE dt.id_plan=?',[plan],db)).length)await insert('evoluciones',{id_detalle_plan:detail,id_doctor:doctor.id_usuario,descripcion_procedimiento:'Seguimiento ficticio del tratamiento [DEMO]',proxima_cita_sugerida:'2026-10-17'});
  }
 });
 console.log('Después:',JSON.stringify(await summary()));
}finally{await pool.end();}
