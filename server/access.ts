import type {Request} from 'express';
import {rows,pool,type DB} from './db.js';
import {fail} from './resources.js';
// Control de acceso por rol y por paciente (se valida siempre en el servidor).
// Administrador: todo. Recepcionista: sin información clínica. Doctor: solo pacientes con cita o diagnóstico propio.
// Doctor externo: lo mismo que Doctor, pero solo lectura (ver checkModule en resources.ts).
export const clinicalModules=['diagnosticos','antecedentes','examenes','planes','detalles','evoluciones','arcos'];
const own='SELECT id_paciente FROM citas WHERE id_doctor=? UNION SELECT id_paciente FROM diagnosticos WHERE id_doctor=?';
const byDiagnosis='SELECT id_diagnostico FROM diagnosticos WHERE id_paciente IN ('+own+')';
const byPlan='SELECT id_plan FROM planes_tratamiento WHERE id_diagnostico IN ('+byDiagnosis+')';
const byDetail='SELECT id_detalle_plan FROM planes_tratamiento_detalle WHERE id_plan IN ('+byPlan+')';
const byEvolution='SELECT id_evolucion FROM evoluciones WHERE id_detalle_plan IN ('+byDetail+')';
const scopes:Record<string,string>={
 pacientes:'id_paciente IN ('+own+')',diagnosticos:'id_paciente IN ('+own+')',antecedentes:'id_paciente IN ('+own+')',
 examenes:'id_diagnostico IN ('+byDiagnosis+')',planes:'id_diagnostico IN ('+byDiagnosis+')',detalles:'id_plan IN ('+byPlan+')',
 evoluciones:'id_detalle_plan IN ('+byDetail+')',arcos:'id_evolucion IN ('+byEvolution+')'
};
const isPatientData=(key:string)=>key==='pacientes'||clinicalModules.includes(key);
/** Condición SQL (con sus parámetros) que limita un listado a los pacientes del doctor; null si no aplica. */
export function scopeFor(req:Request,key:string,options=false){
 const user=req.session.user!;
 // El Doctor externo ve solo sus citas (como en la agenda y el inicio); el Doctor ve todas para poder agendar sin solapes.
 if(key==='citas')return user.rol==='Doctor externo'?{sql:'id_doctor=?',params:[user.id_usuario]}:null;
 if(user.rol==='Administrador'||user.rol==='Recepcionista'||!isPatientData(key)||(key==='pacientes'&&options))return null;
 return {sql:scopes[key]||'1=0',params:[user.id_usuario,user.id_usuario]};
}
/** Paciente al que pertenece un registro clínico (directo o a través de diagnóstico, plan, detalle o evolución). */
export async function patientOf(row:Record<string,any>,db:DB):Promise<number|null>{
 if(row.id_paciente!=null)return Number(row.id_paciente);
 const queries:[string,string][]=[
  ['id_evolucion','SELECT d.id_paciente FROM evoluciones e JOIN planes_tratamiento_detalle dt ON dt.id_detalle_plan=e.id_detalle_plan JOIN planes_tratamiento p ON p.id_plan=dt.id_plan JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE e.id_evolucion=?'],
  ['id_detalle_plan','SELECT d.id_paciente FROM planes_tratamiento_detalle dt JOIN planes_tratamiento p ON p.id_plan=dt.id_plan JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE dt.id_detalle_plan=?'],
  ['id_plan','SELECT d.id_paciente FROM planes_tratamiento p JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE p.id_plan=?'],
  ['id_diagnostico','SELECT id_paciente FROM diagnosticos WHERE id_diagnostico=?']
 ];
 for(const [column,sql] of queries)if(row[column]!=null){const found=(await rows(sql,[row[column]],db))[0];return found?Number(found.id_paciente):null;}
 return null;
}
/** Lanza 403 si el usuario no puede acceder al registro (existente o por crear) de ese módulo. */
export async function assertAccess(req:Request,key:string,row:Record<string,any>,db:DB=pool){
 const user=req.session.user!;
 if(key==='citas'&&user.rol==='Doctor externo'&&Number(row.id_doctor)!==user.id_usuario)fail(403,'Solo puedes ver tus propias citas');
 if(user.rol==='Administrador'||!isPatientData(key))return;
 if(user.rol==='Recepcionista'){if(key==='pacientes')return;fail(403,'Tu rol no tiene acceso a información clínica');}
 if(key==='pacientes'&&row.id_paciente==null)return;
 const patient=await patientOf(row,db);
 if(patient==null||!(await rows('SELECT 1 FROM ('+own+') t WHERE t.id_paciente=? LIMIT 1',[user.id_usuario,user.id_usuario,patient],db)).length)fail(403,'No tienes acceso a este paciente');
}
/**
 * Una cita da al Doctor acceso a la historia del paciente, así que el rol Doctor solo puede agendar (crear, o cambiar el paciente o el doctor
 * de una cita) a su propio nombre y para pacientes que ya son suyos o que aún no tienen historia clínica. Los demás roles no cambian.
 */
export async function assertCanSchedule(req:Request,data:Record<string,any>,old:Record<string,any>|null,db:DB=pool){
 const user=req.session.user!;
 if(user.rol!=='Doctor')return;
 if(old&&Number(data.id_doctor)===Number(old.id_doctor)&&Number(data.id_paciente)===Number(old.id_paciente))return;
 if(Number(data.id_doctor)!==user.id_usuario)fail(403,'Como Doctor solo puedes agendar citas a tu nombre');
 const patient=Number(data.id_paciente);
 if((await rows('SELECT 1 FROM ('+own+') t WHERE t.id_paciente=? LIMIT 1',[user.id_usuario,user.id_usuario,patient],db)).length)return;
 if((await rows('SELECT 1 FROM diagnosticos WHERE id_paciente=? UNION ALL SELECT 1 FROM antecedentes_medicos WHERE id_paciente=? LIMIT 1',[patient,patient],db)).length)fail(403,'El paciente tiene historia clínica con otro doctor. Pide a Recepción que agende la primera cita.');
}
/** Autoría clínica: el rol Doctor registra diagnósticos y evoluciones a su propio nombre y no puede cambiar el autor de un registro existente. */
export const authoredModules=['diagnosticos','evoluciones'];
export function assertAuthor(req:Request,key:string,data:Record<string,any>,old:Record<string,any>|null){
 const user=req.session.user!;
 if(user.rol!=='Doctor'||!authoredModules.includes(key)||data.id_doctor===undefined)return;
 if(old?Number(data.id_doctor)!==Number(old.id_doctor):Number(data.id_doctor)!==user.id_usuario)fail(403,old?'No puedes cambiar el doctor responsable del registro':'Como Doctor solo puedes registrar a tu nombre');
}
/** Acceso a la historia clínica consolidada de un paciente. */
export async function patientAccess(req:Request,patientId:number){
 if(req.session.user!.rol==='Recepcionista')fail(403,'Tu rol no tiene acceso a información clínica');
 await assertAccess(req,'pacientes',{id_paciente:patientId});
}
