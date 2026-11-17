import {Router} from 'express';
import {rows,exec,transaction,type DB} from './db.js';
import {fail,positiveId,audit} from './resources.js';
import {paymentsRouter} from './payments.js';
import {automaticCash} from './automatic-cash.js';
export const financeRouter=Router();
// Administrador: toda la caja. Recepcionista: caja del día, movimientos manuales, estado de cuenta y pagos de pacientes
// (sin anular pagos ni ver el historial o el detalle de cajas anteriores).
const cashierPath=(req:import('express').Request)=>(req.method==='GET'&&req.path==='/')||(req.method==='POST'&&req.path==='/movimiento')||/^\/pacientes\/\d+\/(cuenta|pagos)\/?$/.test(req.path);
financeRouter.use((req,_res,next)=>{const rol=req.session.user!.rol;if(rol!=='Administrador'&&!(rol==='Recepcionista'&&cashierPath(req)))fail(403,'Tu rol no tiene acceso a esta operación de caja');next();});
financeRouter.use('/pacientes',paymentsRouter);
export function money(value:unknown){const n=Number(value);if(!Number.isFinite(n)||n<0||n>99999999.99)fail(400,'Monto inválido');return Math.round(n*100)/100;}
const signedMoney=(value:number)=>Math.round(value*100)/100;
financeRouter.get('/:id/detalle',async(req,res)=>{
 const id=positiveId(req.params.id);
 const detail=await transaction(async db=>{
  const caja=(await rows('SELECT c.*,CONCAT(u.nombre," ",u.apellido) responsable FROM caja_cierres c LEFT JOIN usuarios u ON u.id_usuario=c.id_usuario_caja WHERE c.id_cierre=? FOR SHARE',[id],db))[0]||fail(404,'Caja no encontrada');
  const movements=await rows('SELECT m.*,cat.nombre_categoria categoria,CONCAT(p.nombre," ",p.apellido) paciente FROM caja_movimientos m LEFT JOIN categorias_movimientos cat ON cat.id_categoria=m.id_categoria_mov LEFT JOIN pacientes p ON p.id_paciente=m.id_paciente WHERE m.id_cierre=? ORDER BY m.fecha_movimiento,m.id_movimiento',[id],db);
  const ingresos=signedMoney(movements.filter(m=>m.tipo_movimiento==='Ingreso'&&!m.anulado).reduce((sum,m)=>sum+Number(m.monto),0));
  const egresos=signedMoney(movements.filter(m=>m.tipo_movimiento==='Egreso'&&!m.anulado).reduce((sum,m)=>sum+Number(m.monto),0));
  return {caja,movements,ingresos,egresos,saldo:signedMoney(Number(caja.monto_apertura)+ingresos-egresos)};
 });
 res.json(detail);
});
async function balance(id:number,db:DB){return (await rows("SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='Ingreso' THEN monto ELSE -monto END),0) total FROM caja_movimientos WHERE id_cierre=? AND anulado=0",[id],db))[0].total;}
financeRouter.get('/',async(req,res)=>{const active=await transaction(db=>automaticCash(req.session.user!.id_usuario,db));res.json({active,movements:active?await rows('SELECT m.*,CONCAT(p.nombre," ",p.apellido) paciente FROM caja_movimientos m LEFT JOIN pacientes p ON p.id_paciente=m.id_paciente WHERE m.id_cierre=? ORDER BY m.id_movimiento DESC',[active.id_cierre]):[],balance:active?signedMoney(active.monto_apertura+await balance(active.id_cierre,(await import('./db.js')).pool)):0,history:req.session.user!.rol==='Administrador'?await rows('SELECT * FROM caja_cierres ORDER BY id_cierre DESC LIMIT 20'):[]});});
// Movimiento manual (sin paciente). La clave de operación evita registrarlo dos veces por un doble clic o un reintento, como en los pagos.
financeRouter.post('/movimiento',async(req,res)=>{const {tipo_movimiento,metodo_pago,descripcion,descuento_tipo,clave_pago}=req.body;const subtotal=money(req.body.subtotal);if(subtotal<=0||!['Ingreso','Egreso'].includes(tipo_movimiento)||!['Efectivo','Tarjeta','Transferencia','Yape','Plin'].includes(metodo_pago)||typeof descripcion!=='string'||descripcion.length>5000)fail(400,'Completa correctamente el movimiento');if(typeof clave_pago!=='string'||!/^[0-9a-f-]{36}$/i.test(clave_pago))fail(400,'Identificador de operación inválido. Recarga la página.');const value=money(req.body.descuento_valor||0);const discount=money(descuento_tipo==='porcentaje'?subtotal*Math.min(value,100)/100:descuento_tipo==='fijo'?Math.min(value,subtotal):0);const net=money(subtotal-discount);if(net<=0)fail(400,'El importe neto debe ser mayor que cero');const category=req.body.id_categoria_mov?positiveId(req.body.id_categoria_mov):null;
 const repeated=await transaction(async db=>{const caja=await automaticCash(req.session.user!.id_usuario,db);
  // automaticCash serializa los movimientos; la lectura con bloqueo ve un envío idéntico ya confirmado.
  const previous=(await rows('SELECT tipo_movimiento,id_categoria_mov,monto,descuento,metodo_pago,descripcion,id_plan FROM caja_movimientos WHERE clave_pago=? FOR UPDATE',[clave_pago],db))[0];
  if(previous){if(previous.id_plan!=null||previous.tipo_movimiento!==tipo_movimiento||Number(previous.monto)!==net||Number(previous.descuento)!==discount||previous.metodo_pago!==metodo_pago||previous.descripcion!==descripcion.trim()||(previous.id_categoria_mov??null)!==category)fail(409,'La operación ya se utilizó para un movimiento diferente');return true;}
  const result=await exec('INSERT INTO caja_movimientos(id_cierre,tipo_movimiento,id_categoria_mov,monto,descuento,metodo_pago,descripcion,clave_pago) VALUES (?,?,?,?,?,?,?,?)',[caja.id_cierre,tipo_movimiento,category,net,discount,metodo_pago,descripcion.trim(),clave_pago],db);await audit(req,'caja',result.insertId,'movimiento',db);return false;});
 res.status(repeated?200:201).json({ok:true,repetido:repeated});});
