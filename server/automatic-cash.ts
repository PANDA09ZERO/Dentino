import {rows,exec,type DB} from './db.js';
export async function closeExpiredCashes(db:DB,lock=true){
 if(lock)await rows("SELECT id_usuario FROM usuarios WHERE rol='Administrador' ORDER BY id_usuario LIMIT 1 FOR UPDATE",[],db);
 const expired=await rows("SELECT id_cierre,monto_apertura FROM caja_cierres WHERE estado='Abierta' AND DATE_ADD(fecha_apertura,INTERVAL 24 HOUR)<=CURRENT_TIMESTAMP(3) FOR UPDATE",[],db);
 for(const cash of expired){const total=(await rows("SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='Ingreso' THEN monto ELSE -monto END),0) saldo FROM caja_movimientos WHERE id_cierre=? AND anulado=0",[cash.id_cierre],db))[0].saldo;await exec("UPDATE caja_cierres SET estado='Cerrada',fecha_cierre=DATE_ADD(fecha_apertura,INTERVAL 24 HOUR),monto_cierre_calculado=?,monto_cierre_real=NULL,diferencia=NULL,cierre_automatico=1 WHERE id_cierre=?",[Math.round((Number(cash.monto_apertura)+Number(total))*100)/100,cash.id_cierre],db);}
 return expired.length;
}
export async function automaticCash(user:number,db:DB){
 // Serialize first use across operators; a single continuing register is reused.
 await rows("SELECT id_usuario FROM usuarios WHERE rol='Administrador' ORDER BY id_usuario LIMIT 1 FOR UPDATE",[],db);
 await closeExpiredCashes(db,false);
 const existing=(await rows("SELECT * FROM caja_cierres WHERE estado='Abierta' ORDER BY id_cierre DESC LIMIT 1 FOR UPDATE",[],db))[0];
 if(existing)return existing;
 const result=await exec("INSERT INTO caja_cierres(id_usuario_caja,monto_apertura,estado) VALUES (?,0,'Abierta')",[user],db);
 return (await rows('SELECT * FROM caja_cierres WHERE id_cierre=?',[result.insertId],db))[0];
}
