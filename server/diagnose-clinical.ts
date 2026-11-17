// Diagnóstico de solo lectura de planes, tratamientos y evoluciones. No modifica nada y no muestra nombres ni datos personales.
// Uso:  npx tsx server/diagnose-clinical.ts [id_paciente]
import {rows,pool} from './db.js';
async function main(){
 const patient=Number(process.argv[2]||0);
 console.log('\n— Últimos 15 planes y el paciente al que pertenecen (id_paciente vacío = plan sin diagnóstico válido) —');
 console.table(await rows('SELECT p.id_plan,p.id_diagnostico,d.id_paciente,p.estado_plan,(SELECT COUNT(*) FROM planes_tratamiento_detalle dt WHERE dt.id_plan=p.id_plan) tratamientos FROM planes_tratamiento p LEFT JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico ORDER BY p.id_plan DESC LIMIT 15'));
 console.log('\n— Últimas 15 evoluciones y el paciente al que pertenecen —');
 console.table(await rows('SELECT ev.id_evolucion,ev.id_detalle_plan,dt.id_plan,d.id_paciente FROM evoluciones ev LEFT JOIN planes_tratamiento_detalle dt ON dt.id_detalle_plan=ev.id_detalle_plan LEFT JOIN planes_tratamiento p ON p.id_plan=dt.id_plan LEFT JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico ORDER BY ev.id_evolucion DESC LIMIT 15'));
 console.log('\n— Registros que quedan sin enlace (deberían ser 0) —');
 console.table(await rows(`SELECT 'planes sin diagnóstico' problema,COUNT(*) total FROM planes_tratamiento p LEFT JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE d.id_diagnostico IS NULL
  UNION ALL SELECT 'tratamientos sin plan',COUNT(*) FROM planes_tratamiento_detalle dt LEFT JOIN planes_tratamiento p ON p.id_plan=dt.id_plan WHERE p.id_plan IS NULL
  UNION ALL SELECT 'tratamientos sin catálogo',COUNT(*) FROM planes_tratamiento_detalle dt LEFT JOIN catalogo_tratamientos t ON t.id_tratamiento=dt.id_tratamiento WHERE t.id_tratamiento IS NULL
  UNION ALL SELECT 'evoluciones sin tratamiento',COUNT(*) FROM evoluciones ev LEFT JOIN planes_tratamiento_detalle dt ON dt.id_detalle_plan=ev.id_detalle_plan WHERE dt.id_detalle_plan IS NULL`));
 if(patient){
  console.log('\n— Paciente '+patient+': diagnósticos —');console.table(await rows('SELECT id_diagnostico,fecha_diagnostico,id_doctor FROM diagnosticos WHERE id_paciente=?',[patient]));
  console.log('— Paciente '+patient+': planes que devolvería la historia clínica —');console.table(await rows('SELECT p.id_plan,p.id_diagnostico,p.estado_plan FROM planes_tratamiento p JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE d.id_paciente=?',[patient]));
  console.log('— Paciente '+patient+': evoluciones que devolvería la historia clínica —');console.table(await rows('SELECT ev.id_evolucion,ev.id_detalle_plan FROM evoluciones ev JOIN planes_tratamiento_detalle dt ON dt.id_detalle_plan=ev.id_detalle_plan JOIN planes_tratamiento p ON p.id_plan=dt.id_plan JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE d.id_paciente=?',[patient]));
 }
 await pool.end();
}
main().catch(error=>{console.error('Error:',error.code||error.message);process.exit(1);});
