import {exec,rows,pool} from './db.js';
import {pathToFileURL} from 'node:url';
import {migratePayments} from './payment-migration.js';
import {migrateServices} from './service-migration.js';
import {migrateSecurity} from './security-migration.js';
import {migrateIndexes} from './index-migration.js';
export async function migrate(){
 async function add(table:string,column:string,definition:string){if(!(await rows('SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,column])).length)await exec(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);}
 await add('usuarios','cambio_clave_pendiente','TINYINT(1) NOT NULL DEFAULT 0');
 await add('usuarios','fecha_nacimiento','DATE NULL');
 await add('usuarios','sexo',"ENUM('M','F','Otro') NULL");
 await add('usuarios','direccion','TEXT NULL');
 await add('usuarios','especialidad','VARCHAR(100) NULL');
 await add('categorias_pacientes','descuento_tipo',"ENUM('Porcentaje','Importe fijo') NOT NULL DEFAULT 'Porcentaje'");
 await exec('CREATE TABLE IF NOT EXISTS dentino_migrations (version VARCHAR(80) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
 if((await rows('SELECT 1 FROM dentino_migrations WHERE version=?',['20261010_typescript'])).length){await migratePayments();await migrateServices();await migrateSecurity();await migrateIndexes();return;}
 await add('caja_movimientos','descuento','DECIMAL(10,2) NOT NULL DEFAULT 0');
 await add('pacientes','archivado','TINYINT(1) NOT NULL DEFAULT 0');
 await add('antecedentes_medicos','ultima_actualizacion','TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
 const yn=['hospitalizado_ultimos_2_anos','atencion_medica_ultimos_2_anos','alergico_medicamentos_comida','sangrado_tratado','infarto_cardiaco','insuficiencia_cardiaca','tratamiento_oncologico','coagulacion_alterada','epilepsia','presion_alta','artritis','hepatitis','tuberculosis','vih_sida_ets','gastritis','toma_medicacion_actualmente','anestesia_aplicada','convulsiones_desmayos'];
 for(const c of yn)await add('antecedentes_medicos',c,"VARCHAR(10) NULL DEFAULT 'No'");
 for(const c of ['hospitalizado_por_que','hospitalizado_donde','alergico_cuales','otras_enfermedades','medicacion_cuales','urgencia_llamar_a','parentesco_nombre','como_se_entero','motivo_consulta','firma_paciente'])await add('antecedentes_medicos',c,'TEXT NULL');
 for(const c of ['embarazada','dando_lactar'])await add('antecedentes_medicos',c,"VARCHAR(15) NULL DEFAULT 'No aplica'");
 await exec('CREATE TABLE IF NOT EXISTS secciones_pagina (id_seccion INT PRIMARY KEY AUTO_INCREMENT,seccion_key VARCHAR(50) NOT NULL UNIQUE,titulo VARCHAR(255),contenido TEXT,imagen_url VARCHAR(500),orden INT DEFAULT 0,activo TINYINT DEFAULT 1,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) CHARACTER SET utf8mb4');
 await exec('CREATE TABLE IF NOT EXISTS dentino_sessions (sid VARCHAR(128) PRIMARY KEY, expires BIGINT NOT NULL, data MEDIUMTEXT NOT NULL)');
 await exec('CREATE TABLE IF NOT EXISTS dentino_audit (id BIGINT PRIMARY KEY AUTO_INCREMENT,usuario INT,modulo VARCHAR(80),registro INT,accion VARCHAR(30),fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
 // Populate only editorial copy present in the old source; no fabricated operational records.
 const defaults=[['hero_titulo','Tu sonrisa en manos de expertos','Atención odontológica y seguimiento clínico en Dentino.'],['servicio_1_titulo','Ortodoncia avanzada','Seguimiento de tu sonrisa y alineación dental.'],['servicio_2_titulo','Cirugía dental','Atención profesional para procedimientos dentales.'],['servicio_3_titulo','Endodoncia','Cuidado y conservación de tus piezas dentales.'],['contacto_titulo','Contacto y ubicación',''],['contacto_telefono','',''],['contacto_direccion','',''],['contacto_email','',''],['contacto_horario','','']];
 for(let i=0;i<defaults.length;i++)await exec('INSERT IGNORE INTO secciones_pagina (seccion_key,titulo,contenido,orden) VALUES (?,?,?,?)',[...defaults[i],i]);
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',['20261010_typescript']);
 await migratePayments();
 await migrateServices();
 await migrateSecurity();
 await migrateIndexes();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await migrate();console.log('Migración aditiva completada; datos existentes conservados.');await pool.end();}
