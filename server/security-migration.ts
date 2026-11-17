import bcrypt from 'bcryptjs';
import {exec,rows} from './db.js';
// Migraciones de seguridad. No eliminan registros.
async function done(version:string){return (await rows('SELECT 1 FROM dentino_migrations WHERE version=?',[version])).length>0;}
// 1) IP de origen en la auditoría (columna nueva).
async function auditIp(){
 const version='20261104_audit_ip';if(await done(version))return;
 if(!(await rows('SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="dentino_audit" AND COLUMN_NAME="ip"')).length)await exec('ALTER TABLE dentino_audit ADD COLUMN ip VARCHAR(64) NULL');
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 2) PIN de autorización: amplía la columna (un hash bcrypt mide 60 caracteres) y reemplaza los PIN en texto plano por su hash.
// Ningún flujo verifica el PIN todavía, así que no se afecta ninguna funcionalidad. Haz un respaldo de MySQL antes de la primera ejecución.
async function pinHash(){
 const version='20261104_pin_hash';if(await done(version))return;
 const column=(await rows('SELECT DATA_TYPE dtype,CHARACTER_MAXIMUM_LENGTH len,IS_NULLABLE nullable,COLUMN_DEFAULT def FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="usuarios" AND COLUMN_NAME="pin_autorizacion"'))[0];
 if(column){
  if(!['varchar','char'].includes(String(column.dtype).toLowerCase())||Number(column.len)<255)await exec(`ALTER TABLE usuarios MODIFY COLUMN pin_autorizacion VARCHAR(255) ${column.nullable==='YES'?'NULL':'NOT NULL'}${column.def===null||column.def===undefined?'':" DEFAULT '"+String(column.def).replaceAll("'","''")+"'"}`);
  const plain=await rows("SELECT id_usuario,pin_autorizacion pin FROM usuarios WHERE pin_autorizacion IS NOT NULL AND pin_autorizacion<>'' AND pin_autorizacion NOT LIKE '$2%'");
  for(const user of plain)await exec('UPDATE usuarios SET pin_autorizacion=? WHERE id_usuario=?',[await bcrypt.hash(String(user.pin),10),user.id_usuario]);
 }
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 3) Anulación de pagos: el movimiento se conserva y se marca como anulado (no se borra).
async function paymentVoid(){
 const version='20261104_payment_void';if(await done(version))return;
 for(const [name,type] of [['anulado','TINYINT(1) NOT NULL DEFAULT 0'],['motivo_anulacion','VARCHAR(500) NULL'],['anulado_por','INT NULL'],['fecha_anulacion','DATETIME NULL']])if(!(await rows('SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="caja_movimientos" AND COLUMN_NAME=?',[name])).length)await exec(`ALTER TABLE caja_movimientos ADD COLUMN ${name} ${type}`);
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 4) Configuración de la clínica y solicitudes de contacto (tablas nuevas).
async function clinicSettings(){
 const version='20261104_clinic_settings';if(await done(version))return;
 await exec('CREATE TABLE IF NOT EXISTS configuracion_clinica (clave VARCHAR(50) PRIMARY KEY,valor VARCHAR(800) NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) CHARACTER SET utf8mb4');
 await exec("CREATE TABLE IF NOT EXISTS solicitudes_contacto (id_solicitud INT PRIMARY KEY AUTO_INCREMENT,nombre VARCHAR(100) NOT NULL,telefono VARCHAR(30) NULL,correo VARCHAR(100) NULL,mensaje TEXT NOT NULL,estado ENUM('Nueva','Atendida') NOT NULL DEFAULT 'Nueva',fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP) CHARACTER SET utf8mb4");
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 5) Cola de correo saliente (tabla nueva).
async function mailQueue(){
 const version='20261104_mail_queue';if(await done(version))return;
 await exec("CREATE TABLE IF NOT EXISTS cola_correos (id_correo BIGINT PRIMARY KEY AUTO_INCREMENT,destinatario VARCHAR(254) NOT NULL,asunto VARCHAR(200) NOT NULL,cuerpo MEDIUMTEXT NOT NULL,estado ENUM('Pendiente','Enviado','Fallido') NOT NULL DEFAULT 'Pendiente',intentos INT NOT NULL DEFAULT 0,ultimo_error VARCHAR(100) NULL,proximo_intento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,fecha_envio DATETIME NULL,KEY idx_cola_estado (estado,proximo_intento)) CHARACTER SET utf8mb4");
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 6) Firmas clínicas (tabla nueva). No modifica registros existentes.
async function signatures(){
 const version='20261104_signatures';if(await done(version))return;
 await exec("CREATE TABLE IF NOT EXISTS firmas_clinicas (id_firma BIGINT PRIMARY KEY AUTO_INCREMENT,modulo VARCHAR(40) NOT NULL,id_registro INT NOT NULL,id_usuario INT NOT NULL,contenido MEDIUMTEXT NOT NULL,hash_contenido CHAR(64) NOT NULL,instante VARCHAR(30) NOT NULL,fecha_firma TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_firma_registro (modulo,id_registro)) CHARACTER SET utf8mb4");
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 7) Eventos de seguridad en la auditoría: columna de detalle (aditiva).
async function auditEvents(){
 const version='20261104_audit_events';if(await done(version))return;
 if(!(await rows('SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="dentino_audit" AND COLUMN_NAME="detalle"')).length)await exec('ALTER TABLE dentino_audit ADD COLUMN detalle VARCHAR(255) NULL');
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 8) Versiones del odontograma: tablas nuevas y versión 1 de cada diagnóstico que ya tiene odontograma. No modifica odontograma_piezas.
async function odontogramVersions(){
 const version='20261105_odontogram_versions';if(await done(version))return;
 await exec("CREATE TABLE IF NOT EXISTS odontograma_versiones (id_version INT PRIMARY KEY AUTO_INCREMENT,id_diagnostico INT NOT NULL,numero INT NOT NULL,fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,id_usuario INT NULL,nota VARCHAR(255) NULL,UNIQUE KEY uq_odonto_version (id_diagnostico,numero)) CHARACTER SET utf8mb4");
 await exec("CREATE TABLE IF NOT EXISTS odontograma_versiones_piezas (id_version_pieza BIGINT PRIMARY KEY AUTO_INCREMENT,id_version INT NOT NULL,numero_pieza INT NOT NULL,cara_vestibular VARCHAR(50) NULL,cara_palatina VARCHAR(50) NULL,cara_lingual VARCHAR(50) NULL,cara_mesial VARCHAR(50) NULL,cara_distal VARCHAR(50) NULL,cara_oclusal VARCHAR(50) NULL,estado_general_pieza VARCHAR(50) NULL,UNIQUE KEY uq_version_pieza (id_version,numero_pieza)) CHARACTER SET utf8mb4");
 if((await rows('SELECT 1 FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="odontograma_piezas"')).length){
  const faces=['cara_vestibular','cara_palatina','cara_lingual','cara_mesial','cara_distal','cara_oclusal','estado_general_pieza'];
  const found=(await rows('SELECT COLUMN_NAME c FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="odontograma_piezas"')).map((r:any)=>r.c);
  const list=faces.filter(f=>found.includes(f)).map(c=>','+c).join('');
  await exec('INSERT INTO odontograma_versiones (id_diagnostico,numero,fecha_registro) SELECT d.id_diagnostico,1,COALESCE(d.fecha_diagnostico,CURRENT_TIMESTAMP) FROM diagnosticos d WHERE EXISTS (SELECT 1 FROM odontograma_piezas o WHERE o.id_diagnostico=d.id_diagnostico) AND NOT EXISTS (SELECT 1 FROM odontograma_versiones v WHERE v.id_diagnostico=d.id_diagnostico)');
  await exec(`INSERT IGNORE INTO odontograma_versiones_piezas (id_version,numero_pieza${list}) SELECT v.id_version,o.numero_pieza${list.replace(/,/g,',o.')} FROM odontograma_piezas o JOIN odontograma_versiones v ON v.id_diagnostico=o.id_diagnostico AND v.numero=1`);
 }
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
// 9) Último número emitido por tipo y serie de comprobante, para no reutilizar el de uno borrado (tabla nueva; se inicializa con el máximo actual).
async function receiptCounters(){
 const version='20261117_receipt_counters';if(await done(version))return;
 await exec('CREATE TABLE IF NOT EXISTS comprobantes_correlativos (tipo_comprobante VARCHAR(30) NOT NULL,serie VARCHAR(30) NOT NULL,ultimo INT NOT NULL DEFAULT 0,PRIMARY KEY (tipo_comprobante,serie)) CHARACTER SET utf8mb4');
 await exec('INSERT IGNORE INTO comprobantes_correlativos (tipo_comprobante,serie,ultimo) SELECT tipo_comprobante,serie,MAX(correlativo) FROM comprobantes GROUP BY tipo_comprobante,serie');
 await exec('INSERT INTO dentino_migrations(version) VALUES (?)',[version]);
}
export async function migrateSecurity(){await auditIp();await pinHash();await paymentVoid();await clinicSettings();await mailQueue();await signatures();await auditEvents();await odontogramVersions();await receiptCounters();}
