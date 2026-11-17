import {Router,type Request,type Response} from 'express';
import {rows,exec,transaction,pool,type DB} from './db.js';
import {fail,audit} from './resources.js';
import {enqueueMail} from './mailer.js';
// Datos de la clínica (comprobantes y página pública) y solicitudes de contacto del formulario público.
export const settingKeys=['razon_social','ruc','direccion','telefono','correo','whatsapp','horario','mapa_url'] as const;
const rules:Record<string,{max:number;test?:RegExp;message?:string}>={
 razon_social:{max:150},
 ruc:{max:11,test:/^\d{11}$/,message:'El RUC debe tener 11 dígitos'},
 direccion:{max:250},
 telefono:{max:30,test:/^[0-9+()\s-]{6,30}$/,message:'Teléfono inválido'},
 correo:{max:100,test:/^[^\s@]+@[^\s@]+\.[^\s@]+$/,message:'Correo electrónico inválido'},
 whatsapp:{max:15,test:/^\d{8,15}$/,message:'WhatsApp: solo dígitos con código de país, por ejemplo 51987654321'},
 horario:{max:200},
 mapa_url:{max:800,test:/^https:\/\/(www\.google\.com\/maps\/embed|maps\.google\.com\/maps)[A-Za-z0-9%&=._~:/?#@!$'()*+,;-]*$/,message:'Pega solo la URL del mapa (https://www.google.com/maps/embed?...), no el código HTML'}
};
export async function loadSettings(db:DB=pool){
 const data:Record<string,string>=Object.fromEntries(settingKeys.map(key=>[key,'']));
 for(const row of await rows('SELECT clave,valor FROM configuracion_clinica',[],db))if(row.clave in data)data[row.clave]=row.valor||'';
 return data;
}
export const settingsRouter=Router();
settingsRouter.use((req,_res,next)=>{if(req.session.user!.rol!=='Administrador')fail(403,'Necesitas el rol Administrador');next();});
settingsRouter.get('/',async(_req,res)=>{res.json(await loadSettings());});
settingsRouter.put('/',async(req,res)=>{
 const body=req.body||{};const values:Record<string,string>={};
 for(const key of settingKeys){
  if(body[key]===undefined)continue;
  if(typeof body[key]!=='string')fail(400,'Valor inválido');
  let value=body[key].trim();if(key==='whatsapp')value=value.replace(/[\s()+-]/g,'');const rule=rules[key];
  if(value.length>rule.max)fail(400,`El campo ${key} excede ${rule.max} caracteres`);
  if(value&&rule.test&&!rule.test.test(value))fail(400,rule.message||'Valor inválido');
  values[key]=value;
 }
 await transaction(async db=>{
  for(const [key,value] of Object.entries(values))await exec('INSERT INTO configuracion_clinica(clave,valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)',[key,value],db);
  // La página pública lee su contacto de secciones_pagina; se mantiene sincronizado desde este único formulario.
  const mirror:Record<string,string>={direccion:'contacto_direccion',telefono:'contacto_telefono',correo:'contacto_email',horario:'contacto_horario'};
  for(const [key,section] of Object.entries(mirror))if(key in values)await exec('UPDATE secciones_pagina SET titulo=? WHERE seccion_key=?',[values[key],section],db);
  await audit(req,'configuracion',0,'editar',db);
 });
 res.json(await loadSettings());
});
/** Formulario público de contacto: sin sesión, con CSRF, límite por IP y campo trampa. */
export async function contactRequest(req:Request,res:Response){
 const body=req.body||{};
 if(typeof body.sitio_web==='string'&&body.sitio_web.trim()){res.status(201).json({ok:true});return;}
 const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max+1):'';
 const nombre=text(body.nombre,100),telefono=text(body.telefono,30),correo=text(body.correo,100),mensaje=text(body.mensaje,1000);
 if(nombre.length<2||nombre.length>100)fail(400,'Escribe tu nombre');
 if(telefono&&!/^[0-9+()\s-]{6,30}$/.test(telefono))fail(400,'Teléfono inválido');
 if(correo&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)||correo.length>100))fail(400,'Correo electrónico inválido');
 if(!telefono&&!correo)fail(400,'Indica un teléfono o un correo para responderte');
 if(mensaje.length<5||mensaje.length>1000)fail(400,'Escribe tu mensaje (entre 5 y 1000 caracteres)');
 await exec('INSERT INTO solicitudes_contacto(nombre,telefono,correo,mensaje) VALUES (?,?,?,?)',[nombre,telefono||null,correo||null,mensaje]);
 // Aviso por correo al administrador (si el SMTP está configurado). Un fallo aquí nunca debe impedir guardar la consulta.
 try{
  const to=(await loadSettings()).correo||process.env.NOTIFY_EMAIL||'';
  if(to){const recent=(await rows("SELECT COUNT(*) n FROM cola_correos WHERE asunto LIKE 'Nueva solicitud de contacto%' AND fecha_creacion>DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 HOUR)"))[0].n;if(recent<30)await enqueueMail(to,'Nueva solicitud de contacto',`Nombre: ${nombre}\nTeléfono: ${telefono||'—'}\nCorreo: ${correo||'—'}\n\n${mensaje}\n\nRevísala en Administración → Solicitudes de contacto.`);}
 }catch{}
 res.status(201).json({ok:true});
}
