import {exec,rows} from './db.js';
export async function migrateServices(){
 const version='20261010_service_payments_daily_cash';if((await rows('SELECT 1 FROM dentino_migrations WHERE version=?',[version])).length)return;
 for(const [table,column,type] of [['caja_movimientos','id_detalle_plan','INT NULL'],['caja_movimientos','servicio_pago','VARCHAR(250) NULL'],['caja_cierres','cierre_automatico','TINYINT(1) NOT NULL DEFAULT 0']])if(!(await rows('SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,column])).length)await exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
 if(!(await rows('SELECT 1 FROM information_schema.table_constraints WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME="fk_pago_servicio"')).length)await exec('ALTER TABLE caja_movimientos ADD CONSTRAINT fk_pago_servicio FOREIGN KEY(id_detalle_plan) REFERENCES planes_tratamiento_detalle(id_detalle_plan) ON DELETE RESTRICT');
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
