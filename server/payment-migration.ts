import {exec,rows} from './db.js';
export async function migratePayments(){
 const version='20261010_patient_payments';
 if((await rows('SELECT 1 FROM dentino_migrations WHERE version=?',[version])).length)return;
 for(const [name,type] of [['id_paciente','INT NULL'],['id_plan','INT NULL'],['id_usuario_pago','INT NULL'],['clave_pago','VARCHAR(64) NULL']])if(!(await rows('SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="caja_movimientos" AND COLUMN_NAME=?',[name])).length)await exec(`ALTER TABLE caja_movimientos ADD COLUMN ${name} ${type}`);
 for(const [name,column,table,pk] of [['fk_pago_paciente','id_paciente','pacientes','id_paciente'],['fk_pago_plan','id_plan','planes_tratamiento','id_plan'],['fk_pago_usuario','id_usuario_pago','usuarios','id_usuario']])if(!(await rows('SELECT 1 FROM information_schema.table_constraints WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME="caja_movimientos" AND CONSTRAINT_NAME=?',[name])).length)await exec(`ALTER TABLE caja_movimientos ADD CONSTRAINT ${name} FOREIGN KEY (${column}) REFERENCES ${table}(${pk}) ON DELETE RESTRICT`);
 if(!(await rows('SELECT 1 FROM information_schema.statistics WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="caja_movimientos" AND INDEX_NAME="uq_clave_pago"')).length)await exec('ALTER TABLE caja_movimientos ADD UNIQUE INDEX uq_clave_pago(clave_pago)');
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
