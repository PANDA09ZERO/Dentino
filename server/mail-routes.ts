import {Router} from 'express';
import {rows,pool} from './db.js';
import {fail,audit,positiveId} from './resources.js';
import {loadSettings} from './settings.js';
import {enqueueMail,mailConfigured,mailStats} from './mailer.js';
export const mailRouter=Router();
mailRouter.use((req,_res,next)=>{if(req.session.user!.rol!=='Administrador')fail(403,'Necesitas el rol Administrador');next();});
mailRouter.get('/estado',async(_req,res)=>{res.json(await mailStats());});
// Envía por correo la simulación de un comprobante (sin validez fiscal). Solo Administrador.
mailRouter.post('/comprobantes/:id',async(req,res)=>{
 const id=positiveId(req.params.id);
 const receipt=(await rows('SELECT c.tipo_comprobante,c.serie,c.correlativo,c.fecha_emision,m.monto,m.descuento,m.metodo_pago,m.servicio_pago,m.descripcion,CONCAT(p.nombre," ",p.apellido) paciente,p.correo paciente_correo FROM comprobantes c JOIN caja_movimientos m ON m.id_movimiento=c.id_movimiento LEFT JOIN pacientes p ON p.id_paciente=m.id_paciente WHERE c.id_comprobante=?',[id]))[0]||fail(404,'Comprobante no encontrado');
 const to=typeof req.body?.correo==='string'&&req.body.correo.trim()?req.body.correo.trim():String(receipt.paciente_correo||'');
 if(!to||to.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))fail(400,'Indica un correo electrónico válido');
 if(!mailConfigured())fail(503,'El correo no está configurado en el servidor (variables SMTP_* en .env)');
 const company=await loadSettings();
 const lines=[company.razon_social||'Dentino · Clínica odontológica',company.ruc?'RUC: '+company.ruc:'','',`${receipt.tipo_comprobante} ${receipt.serie}-${String(receipt.correlativo).padStart(8,'0')}`,'Fecha: '+String(receipt.fecha_emision||'').slice(0,19).replace('T',' '),'Paciente: '+(receipt.paciente||'—'),'Detalle: '+(receipt.servicio_pago||receipt.descripcion||'Pago registrado'),'Método de pago: '+receipt.metodo_pago,'Total recibido: S/ '+Number(receipt.monto).toFixed(2),'','SIMULACIÓN · SIN VALIDEZ FISCAL. Este mensaje no es un comprobante electrónico autorizado.'];
 if(!await enqueueMail(to,`${receipt.tipo_comprobante} ${receipt.serie}-${String(receipt.correlativo).padStart(8,'0')} · ${company.razon_social||'Dentino'}`,lines.join('\n')))fail(400,'No se pudo preparar el correo');
 await audit(req,'comprobantes',id,'enviar_correo',pool);
 res.status(202).json({ok:true});
});
