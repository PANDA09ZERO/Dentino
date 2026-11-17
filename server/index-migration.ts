import {exec,rows} from './db.js';
// Índices para las búsquedas y filtros más frecuentes (agenda por fecha y doctor, caja y reportes por fecha).
// Migración aditiva e idempotente: solo crea índices que no existen; no modifica ni elimina datos.
const indexes:[string,string,string][]=[
 ['citas','idx_citas_fecha','fecha'],
 ['citas','idx_citas_doctor_fecha','id_doctor,fecha'],
 ['caja_movimientos','idx_movimientos_fecha','fecha_movimiento'],
 ['planes_tratamiento','idx_planes_fecha','fecha_creacion'],
 ['evoluciones','idx_evoluciones_fecha','fecha_evolucion'],
 ['pacientes','idx_pacientes_apellido_nombre','apellido,nombre']
];
export async function migrateIndexes(){
 if((await rows('SELECT 1 FROM dentino_migrations WHERE version=?',['20261117_indexes'])).length)return;
 for(const [table,name,columns] of indexes){
  const columnsExist=(await rows('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME IN (?)',[table,columns.split(',')]))[0].n===columns.split(',').length;
  if(!columnsExist)continue;
  if(!(await rows('SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1',[table,name])).length)
   await exec(`CREATE INDEX \`${name}\` ON \`${table}\` (${columns.split(',').map(c=>'`'+c+'`').join(',')})`);
 }
 await exec('INSERT IGNORE INTO dentino_migrations(version) VALUES (?)',['20261117_indexes']);
}
