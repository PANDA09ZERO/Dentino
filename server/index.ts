import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import {randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {pool,rows,exec,transaction} from './db.js';
import {closeExpiredCashes} from './automatic-cash.js';
import {migrate} from './migrate.js';
import {MySQLSessionStore,passwordStamp} from './session.js';
import {resourceRouter,loadSchemas,fail,HttpError} from './resources.js';
import {clinicalRouter} from './clinical.js';
import {financeRouter} from './finance.js';
import {reportsRouter} from './reports.js';
import {modules,cashierCan} from '../shared/modules.js';
import {scopeFor,clinicalModules,assertAccess} from './access.js';
import {settingsRouter,contactRequest,loadSettings} from './settings.js';
import {mailRouter} from './mail-routes.js';
import {signatureRouter} from './signatures.js';
import {auditEvent,fingerprint} from './audit.js';
import {startMailWorker} from './mailer.js';
const root=process.cwd();
const production=process.env.NODE_ENV==='production';const cookieName=production?'__Host-dentino.sid':'dentino.sid';
for(const name of ['DB_USER','DB_NAME','APP_ORIGIN'])if(!process.env[name])throw new Error('Falta la variable de entorno '+name);
if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw new Error('Configura SESSION_SECRET de al menos 32 caracteres');
if(production&&!/^https:\/\//.test(process.env.APP_ORIGIN!))throw new Error('En producción APP_ORIGIN debe usar HTTPS');
if(production&&process.env.DB_USER==='root')console.warn('Aviso: en producción usa un usuario MySQL con permisos limitados, no root.');
if(process.env.SMTP_HOST&&!process.env.SMTP_FROM)console.warn('Aviso: define SMTP_FROM para activar el correo saliente.');
await migrate();await loadSchemas();
const dummyHash=bcrypt.hashSync(randomBytes(16).toString('hex'),10);
const app=express();app.disable('x-powered-by');if(process.env.TRUST_PROXY)app.set('trust proxy',Number(process.env.TRUST_PROXY)||1);app.use(helmet({strictTransportSecurity:production?undefined:false,referrerPolicy:{policy:'same-origin'},contentSecurityPolicy:{directives:{'upgrade-insecure-requests':production?[]:null,'img-src':["'self'",'data:','https:'],'script-src':["'self'"],'frame-src':["https://www.google.com","https://maps.google.com"],'style-src':["'self'","'unsafe-inline'"]}}}));app.use((_req,res,next)=>{res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');next();});
app.use('/api',rateLimit({windowMs:60*1000,limit:Number(process.env.API_RATE_LIMIT)||300,standardHeaders:true,legacyHeaders:false,message:{error:'Demasiadas solicitudes. Espera un momento.'}}));
app.use(express.json({limit:'1mb'}));
app.use(session({name:cookieName,secret:process.env.SESSION_SECRET,store:new MySQLSessionStore(),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:production,maxAge:8*3600000}}));
app.get('/api/health',async(_req,res)=>{await rows('SELECT 1');res.json({ok:true});});
app.get('/api/publico',async(_req,res)=>{res.json({map:((await rows("SELECT valor FROM configuracion_clinica WHERE clave='mapa_url'"))[0]||{}).valor||'',contact:await loadSettings(),sections:await rows('SELECT seccion_key,titulo,contenido,imagen_url FROM secciones_pagina WHERE activo=1 ORDER BY orden'),promotions:await rows("SELECT titulo,descripcion,badge_texto,imagen_url FROM promociones WHERE estado='Activo' AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin"),
 // Tratamientos que ofrece la clínica (solo nombres de los activos; sin precios ni registros de demostración).
 treatments:(await rows("SELECT DISTINCT nombre_tratamiento FROM catalogo_tratamientos WHERE estado='Activo' AND nombre_tratamiento NOT LIKE '%demo%' ORDER BY nombre_tratamiento LIMIT 60")).map(r=>String(r.nombre_tratamiento))});});
/** Usuario vigente de la sesión: null si la cuenta se desactivó o cambió su contraseña; actualiza el rol. */
async function currentUser(req:express.Request){
 const user=req.session.user;if(!user)return null;
 const row=(await rows("SELECT rol,contrasena,cambio_clave_pendiente FROM usuarios WHERE id_usuario=? AND estado='Activo'",[user.id_usuario]))[0];
 const stamp=row?passwordStamp(row.contrasena):'';
 if(!row||(req.session.pwd&&req.session.pwd!==stamp)){delete req.session.user;delete req.session.pwd;return null;}
 req.session.pwd??=stamp;user.rol=row.rol;user.cambio_clave_pendiente=row.cambio_clave_pendiente;return user;
}
app.get('/api/auth/me',async(req,res)=>{req.session.csrf??=randomBytes(32).toString('hex');res.json({user:await currentUser(req),csrf:req.session.csrf});});
app.use('/api',(req,_res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){const origin=req.headers.origin;if(origin&&origin!==process.env.APP_ORIGIN&&!(process.env.ADDITIONAL_ORIGINS||'').split(',').map(s=>s.trim()).includes(origin)&&origin!==`http://127.0.0.1:${process.env.PORT||3001}`)fail(403,'Origen no permitido');if(!req.session.csrf||req.headers['x-csrf-token']!==req.session.csrf)fail(403,'Sesión de formulario inválida. Recarga la página.');}next();});
app.post('/api/publico/solicitud',rateLimit({windowMs:60*60*1000,limit:5,message:{error:'Demasiadas solicitudes. Intenta de nuevo más tarde.'}}),contactRequest);
const loginLimit=rateLimit({windowMs:15*60*1000,limit:20,handler:async(req,res)=>{await auditEvent(req,{usuario:null,modulo:'sesion',registro:0,accion:'login_bloqueado',detalle:'limite por IP'});res.status(429).json({error:'Demasiados intentos. Espera unos minutos.'});}});
const loginAccountLimit=rateLimit({windowMs:15*60*1000,limit:8,skipSuccessfulRequests:true,keyGenerator:req=>'cuenta:'+String(req.body?.correo||'').trim().toLowerCase().slice(0,100),handler:async(req,res)=>{await auditEvent(req,{usuario:null,modulo:'sesion',registro:0,accion:'login_bloqueado',detalle:fingerprint(req.body?.correo)});res.status(429).json({error:'Demasiados intentos para esta cuenta. Espera unos minutos.'});}});
app.post('/api/auth/login',loginLimit,loginAccountLimit,async(req,res)=>{const {correo,contrasena}=req.body;if(typeof correo!=='string'||typeof contrasena!=='string'||correo.length>100||contrasena.length>200)fail(400,'Completa el correo y la contraseña');const user=(await rows("SELECT id_usuario,nombre,apellido,correo,rol,contrasena,cambio_clave_pendiente FROM usuarios WHERE correo=? AND estado='Activo' LIMIT 1",[correo.trim()]))[0];const valid=await bcrypt.compare(contrasena,user?user.contrasena.replace(/^\$2y\$/,'$2b$'):dummyHash);if(!user||!valid){await auditEvent(req,{usuario:user?user.id_usuario:null,modulo:'sesion',registro:user?user.id_usuario:0,accion:'login_fallido',detalle:fingerprint(correo)});fail(401,'Credenciales incorrectas o usuario inactivo');}const stamp=passwordStamp(user.contrasena);delete user.contrasena;await new Promise<void>((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.user=user;req.session.pwd=stamp;req.session.csrf=randomBytes(32).toString('hex');await auditEvent(req,{usuario:user.id_usuario,modulo:'sesion',registro:user.id_usuario,accion:'login'});res.json({user,csrf:req.session.csrf});});
app.post('/api/auth/logout',async(req,res)=>{const who=req.session.user?.id_usuario;if(who)await auditEvent(req,{usuario:who,modulo:'sesion',registro:who,accion:'logout'});await new Promise<void>((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));res.clearCookie(cookieName,{httpOnly:true,sameSite:'lax',secure:production,path:'/'});res.json({ok:true});});
app.use('/api',async(req,_res,next)=>{if(!req.session.user)fail(401,'Inicia sesión para continuar');if(!(await currentUser(req)))fail(401,'La sesión ya no es válida. Inicia sesión de nuevo.');next();});
app.get('/api/perfil',async(req,res)=>{res.json((await rows('SELECT nombre,apellido,correo,telefono,fecha_nacimiento,sexo,direccion,especialidad FROM usuarios WHERE id_usuario=?',[req.session.user!.id_usuario]))[0]);});
app.put('/api/perfil',async(req,res)=>{
 const {nombre,apellido,telefono,fecha_nacimiento,sexo,direccion,especialidad}=req.body;
 if(typeof nombre!=='string'||!nombre.trim()||nombre.length>50||typeof apellido!=='string'||!apellido.trim()||apellido.length>50||typeof telefono!=='string'||!/^\d{0,15}$/.test(telefono))fail(400,'Revisa el nombre, apellido y teléfono (solo números, hasta 15 dígitos)');
 if(fecha_nacimiento&&typeof fecha_nacimiento==='string'&&!/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento))fail(400,'Fecha de nacimiento inválida');
 if(sexo&&typeof sexo==='string'&&!['M','F','Otro'].includes(sexo))fail(400,'Sexo inválido');
 if(direccion&&typeof direccion==='string'&&direccion.length>500)fail(400,'La dirección excede 500 caracteres');
 if(especialidad&&typeof especialidad==='string'&&especialidad.length>100)fail(400,'La especialidad excede 100 caracteres');
 await exec('UPDATE usuarios SET nombre=?,apellido=?,telefono=?,fecha_nacimiento=?,sexo=?,direccion=?,especialidad=? WHERE id_usuario=?',[nombre.trim(),apellido.trim(),telefono||null,fecha_nacimiento||null,sexo||null,direccion||null,especialidad||null,req.session.user!.id_usuario]);
 Object.assign(req.session.user!,{nombre:nombre.trim(),apellido:apellido.trim()});res.json({user:req.session.user});
});
app.post('/api/perfil/clave',async(req,res)=>{
 const {actual,nueva}=req.body;if(typeof actual!=='string'||actual.length>200||typeof nueva!=='string'||nueva.length<8||nueva.length>72)fail(400,'La nueva contraseña debe tener entre 8 y 72 caracteres');
 const user=(await rows('SELECT contrasena FROM usuarios WHERE id_usuario=?',[req.session.user!.id_usuario]))[0];
 if(!await bcrypt.compare(actual,user.contrasena.replace(/^\$2y\$/,'$2b$')))fail(400,'La contraseña actual no es correcta');
 if(actual===nueva)fail(400,'Elige una contraseña diferente de la actual');
 const hash=await bcrypt.hash(nueva,12);await exec('UPDATE usuarios SET contrasena=?,cambio_clave_pendiente=0 WHERE id_usuario=? AND contrasena=?',[hash,req.session.user!.id_usuario,user.contrasena]);
 req.session.pwd=passwordStamp(hash);req.session.user!.cambio_clave_pendiente=0;res.json({user:req.session.user});
});
app.use('/api',(req,_res,next)=>{if(req.session.user?.cambio_clave_pendiente)fail(403,'Debes cambiar tu contraseña temporal antes de continuar');next();});
app.get('/api/opciones/:module',async(req,res)=>{const mod=modules.find(m=>m.key===String(req.params.module))||fail(404,'Módulo no encontrado');if(req.session.user!.rol==='Recepcionista'&&clinicalModules.includes(mod.key))fail(403,'Tu rol no tiene acceso a información clínica');if(mod.admin&&!['usuarios','tratamientos','categorias-pacientes','categorias-citas','categorias-tratamientos','especialidades','distribuidores','laboratorios'].includes(mod.key)&&req.session.user!.rol!=='Administrador')fail(403,'Acceso no permitido');const fields=(await rows('SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[mod.table])).map(c=>c.COLUMN_NAME);let expression=fields.includes('nombre')?fields.includes('apellido')?"CONCAT(nombre,' ',apellido)":'nombre':fields.includes('nombre_tratamiento')?'nombre_tratamiento':fields.includes('nombre_categoria')?'nombre_categoria':fields.includes('nombre_empresa')?'nombre_empresa':fields.includes('nombre_especialidad')?'nombre_especialidad':fields.includes('nombre_insumo')?'nombre_insumo':fields.includes('titulo')?'titulo':fields.includes('descripcion')?'LEFT(descripcion,70)':fields.includes('observaciones_generales')?'LEFT(observaciones_generales,70)':`CONCAT('#',${mod.pk})`;const optionLabels:Record<string,string>={
 diagnosticos:"CONCAT('#',id_diagnostico,' · ',COALESCE((SELECT CONCAT(p.nombre,' ',p.apellido) FROM pacientes p WHERE p.id_paciente=diagnosticos.id_paciente),'Paciente'),' · ',DATE(fecha_diagnostico),' · ',LEFT(COALESCE(observaciones_generales,''),40))",
 planes:"CONCAT('Plan #',id_plan,' · ',COALESCE((SELECT CONCAT(p.nombre,' ',p.apellido) FROM diagnosticos d JOIN pacientes p ON p.id_paciente=d.id_paciente WHERE d.id_diagnostico=planes_tratamiento.id_diagnostico),'Paciente'),' · ',estado_plan)",
 detalles:"CONCAT('Plan #',id_plan,' · ',COALESCE((SELECT t.nombre_tratamiento FROM catalogo_tratamientos t WHERE t.id_tratamiento=planes_tratamiento_detalle.id_tratamiento),'Tratamiento'),' · Pieza ',COALESCE(diente,'—'),' · ',COALESCE((SELECT CONCAT(p.nombre,' ',p.apellido) FROM planes_tratamiento pl JOIN diagnosticos d ON d.id_diagnostico=pl.id_diagnostico JOIN pacientes p ON p.id_paciente=d.id_paciente WHERE pl.id_plan=planes_tratamiento_detalle.id_plan),'Paciente'))",
 evoluciones:"CONCAT('Evolución #',id_evolucion,' · ',DATE(fecha_evolucion))"
};if(optionLabels[mod.key])expression=optionLabels[mod.key];const scope=scopeFor(req,mod.key,true);const filter=mod.key==='usuarios'?" WHERE rol IN ('Doctor','Doctor externo') AND estado='Activo'":scope?' WHERE '+scope.sql:'';res.json(await rows(`SELECT ${mod.pk} id,${expression} label FROM ${mod.table}${filter} ORDER BY ${mod.pk} DESC LIMIT 1000`,scope?scope.params:[]));});
app.get('/api/comprobantes/:id/detalle',async(req,res)=>{if(!['Administrador','Recepcionista'].includes(req.session.user!.rol))fail(403,'Tu rol no tiene acceso a los comprobantes');const data=await rows('SELECT c.id_comprobante,c.tipo_comprobante,c.serie,c.correlativo,c.fecha_emision,m.id_movimiento,m.monto,m.descuento,m.servicio_pago,m.metodo_pago,m.descripcion,m.id_plan,CONCAT(p.nombre," ",p.apellido) paciente,p.dni,p.direccion FROM comprobantes c JOIN caja_movimientos m ON m.id_movimiento=c.id_movimiento LEFT JOIN pacientes p ON p.id_paciente=m.id_paciente WHERE c.id_comprobante=?',[Number(req.params.id)]);const receipt=data[0]||fail(404,'Comprobante no encontrado');const plan=receipt.id_plan?(await rows('SELECT id_plan,estado_plan,costo_total,descuento_aplicado,monto_pagado FROM planes_tratamiento WHERE id_plan=?',[receipt.id_plan]))[0]||null:null;const tratamientos=plan?await rows('SELECT dt.id_detalle_plan,ct.nombre_tratamiento,dt.diente,dt.costo_unitario,dt.estado_tratamiento FROM planes_tratamiento_detalle dt JOIN catalogo_tratamientos ct ON ct.id_tratamiento=dt.id_tratamiento WHERE dt.id_plan=? ORDER BY dt.id_detalle_plan',[plan.id_plan]):[];res.json({...receipt,plan,tratamientos,empresa:await loadSettings()});});
app.get('/api/modulos',(req,res)=>res.json(modules.filter(m=>(!m.admin||req.session.user!.rol==='Administrador'||cashierCan(m,req.session.user!.rol))&&!(req.session.user!.rol==='Recepcionista'&&clinicalModules.includes(m.key)))));
// Panel de inicio: los doctores ven solo sus citas; Administrador ve además saldos pendientes y alertas de inventario.
app.get('/api/dashboard',async(req,res)=>{const user=req.session.user!;const admin=user.rol==='Administrador',doctor=user.rol==='Doctor'||user.rol==='Doctor externo';
 const patients=(await rows('SELECT COUNT(*) total FROM pacientes WHERE archivado=0'+(doctor?' AND id_paciente IN (SELECT id_paciente FROM citas WHERE id_doctor=? UNION SELECT id_paciente FROM diagnosticos WHERE id_doctor=?)':''),doctor?[user.id_usuario,user.id_usuario]:[]))[0].total;
 // «pagado»: el paciente tiene un pago vigente registrado el mismo día de la cita (solo para quienes cobran: Administrador y Recepcionista).
 const paid=admin||user.rol==='Recepcionista'?"EXISTS(SELECT 1 FROM caja_movimientos m WHERE m.id_paciente=c.id_paciente AND m.tipo_movimiento='Ingreso' AND m.anulado=0 AND DATE(m.fecha_movimiento)=DATE(c.fecha))":'0';
 const today=await rows('SELECT c.id_cita,c.id_paciente,c.id_doctor,c.hora,c.estado,c.motivo,'+paid+' pagado,CONCAT(p.nombre," ",p.apellido) paciente,CONCAT(u.nombre," ",u.apellido) doctor FROM citas c JOIN pacientes p ON p.id_paciente=c.id_paciente JOIN usuarios u ON u.id_usuario=c.id_doctor WHERE DATE(c.fecha)=CURRENT_DATE'+(doctor?' AND c.id_doctor=?':'')+' ORDER BY c.hora',doctor?[user.id_usuario]:[]);
 const plans=(await rows("SELECT COUNT(*) total FROM planes_tratamiento WHERE estado_plan='En progreso'"))[0].total;
 const alerts=admin?await rows("SELECT id_insumo,nombre_insumo,stock_actual,stock_minimo,unidad_medida,fecha_vencimiento_proxima,CASE WHEN fecha_vencimiento_proxima<CURRENT_DATE THEN 'Vencido' WHEN stock_actual<=0 THEN 'Agotado' WHEN fecha_vencimiento_proxima<=DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY) THEN 'Por vencer' ELSE 'Por agotarse' END tipo FROM inventario_insumos WHERE stock_actual<=stock_minimo OR fecha_vencimiento_proxima<=DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY) ORDER BY FIELD(tipo,'Vencido','Agotado','Por vencer','Por agotarse'),nombre_insumo"):[];
 const pending=admin?await rows("SELECT pl.id_plan,d.id_paciente,CONCAT(p.nombre,' ',p.apellido) paciente,GREATEST(0,pl.costo_total-pl.descuento_aplicado-pl.monto_pagado) saldo FROM planes_tratamiento pl JOIN diagnosticos d ON d.id_diagnostico=pl.id_diagnostico JOIN pacientes p ON p.id_paciente=d.id_paciente WHERE pl.estado_plan<>'Abandonado' AND p.archivado=0 AND pl.costo_total-pl.descuento_aplicado-pl.monto_pagado>0 ORDER BY saldo DESC LIMIT 6"):[];
 res.json({patients,today,plans,alerts,pending});});
fs.mkdirSync(path.join(root,'uploads','examenes'),{recursive:true});
const upload=multer({storage:multer.diskStorage({destination:path.join(root,'uploads','examenes'),filename:(_req,file,cb)=>cb(null,randomUUID()+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:15*1024*1024,files:1},fileFilter:(_req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();if(!{'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext as '.pdf']||!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.mimetype))return cb(new HttpError(400,'Solo PDF, PNG, JPG y WebP'));cb(null,true);}});
const uploadLimit=rateLimit({windowMs:10*60*1000,limit:40,message:{error:'Demasiadas subidas. Espera unos minutos.'}});
// Solo suben archivos clínicos los roles que registran exámenes (Recepcionista no tiene datos clínicos; Doctor externo es de solo lectura).
app.post('/api/archivos',(req,_res,next)=>{if(!['Administrador','Doctor'].includes(req.session.user!.rol))fail(403,'Tu rol no puede subir archivos clínicos');next();},uploadLimit,upload.single('archivo'),async(req,res)=>{if(!req.file)fail(400,'Selecciona un archivo');const filePath=req.file!.path;const bytes=fs.readFileSync(filePath);const ext=path.extname(filePath);const valid=ext==='.pdf'?bytes.subarray(0,5).toString()==='%PDF-':ext==='.png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):['.jpg','.jpeg'].includes(ext)?bytes[0]===255&&bytes[1]===216:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid){fs.unlinkSync(filePath);fail(400,'El contenido del archivo no coincide con su formato');}res.status(201).json({path:'uploads/examenes/'+req.file!.filename});});
app.use('/api/configuracion',settingsRouter);app.use('/api/correo',mailRouter);app.use('/api/firma',signatureRouter);app.use('/api/clinica',clinicalRouter);app.use('/api/caja',financeRouter);app.use('/api/reportes',rateLimit({windowMs:60*1000,limit:60,message:{error:'Demasiados reportes. Espera un momento.'}}),reportsRouter);app.use('/api/recursos',resourceRouter);
app.use('/api',(_req,_res)=>fail(404,'Ruta no encontrada'));
// Archivos clínicos: el Administrador ve todos; los demás roles, solo los de un examen al que tienen acceso (mismo control que la historia clínica).
app.use('/uploads',async(req,_res,next)=>{if(!req.session.user)fail(401,'Inicia sesión para ver archivos clínicos');const active=await currentUser(req);if(!active)fail(401,'La sesión ya no es válida. Inicia sesión de nuevo.');
 if(active!.rol!=='Administrador'){const exams=await rows('SELECT * FROM examenes_auxiliares WHERE ruta_archivo=?',['uploads'+req.path]);if(!exams.length)fail(404,'Archivo no encontrado');let allowed=false;for(const exam of exams){try{await assertAccess(req,'examenes',exam);allowed=true;break;}catch(e){if(!(e instanceof HttpError&&e.status===403))throw e;}}if(!allowed)fail(403,'No tienes acceso a este archivo');}
 next();},express.static(path.join(root,'uploads'),{dotfiles:'deny',setHeaders:res=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');}}));
app.use('/images',express.static(path.join(root,'images')));app.use(express.static(path.join(root,'dist')));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(root,'dist','index.html')));
app.use(async(error:any,req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=error instanceof HttpError?error.status:error?.type==='entity.parse.failed'?400:error?.type==='entity.too.large'?413:error.code==='ER_DUP_ENTRY'?409:error.code?.startsWith('ER_NO_REFERENCED')||error.code?.startsWith('ER_ROW_IS_REFERENCED')?409:error instanceof multer.MulterError?400:500;if(status===403)await auditEvent(req,{usuario:req.session?.user?.id_usuario??null,modulo:'seguridad',registro:0,accion:'acceso_denegado',detalle:(req.method+' '+req.originalUrl.split('?')[0]).slice(0,200)});res.status(status).json({error:status===500?'No se pudo completar la operación. Intenta de nuevo.':error instanceof HttpError?error.message:error?.type==='entity.parse.failed'?'Solicitud mal formada.':error?.type==='entity.too.large'?'La solicitud es demasiado grande.':error.code==='ER_DUP_ENTRY'?'Ya existe un registro con esos datos únicos.':status===409?'El registro está relacionado con otros datos. Revisa las referencias.':'Archivo inválido o demasiado grande.'});if(status===500)console.error('Error de operación:',error.code||error.name);});
let closingCash=false;async function closeDueCash(){if(closingCash)return;closingCash=true;try{await transaction(db=>closeExpiredCashes(db));}catch(e){console.error('No se pudo verificar el cierre automático:',(e as any).code||'error');}finally{closingCash=false;}}
await closeDueCash();const dailyCashTimer=setInterval(()=>void closeDueCash(),60000);dailyCashTimer.unref();
const server=app.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>{
 console.log(`Dentino local: http://127.0.0.1:${process.env.PORT||3001}`);
 if(process.env.HOST==='0.0.0.0'){
  for(const origin of (process.env.ADDITIONAL_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean))console.log(`Compartir por Wi-Fi (otros equipos y celulares): ${origin}`);
  console.log('Los dispositivos deben estar conectados al mismo Wi-Fi. Mantén esta ventana abierta.');
 }
});
const cleanup=setInterval(()=>{void exec('DELETE FROM dentino_sessions WHERE expires<?',[Date.now()]).catch(()=>{});},3600000);cleanup.unref();
startMailWorker();
process.on('SIGTERM',()=>server.close(()=>void pool.end()));
