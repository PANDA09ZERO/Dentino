import {rows,exec,pool,type DB} from './db.js';
// Versiones del odontograma. `odontograma_piezas` sigue siendo el estado ACTUAL del diagnóstico (nada cambia para el resto de la aplicación);
// cada versión es una copia de ese estado guardada en `odontograma_versiones` y `odontograma_versiones_piezas`.
export const FACES=['cara_vestibular','cara_palatina','cara_lingual','cara_mesial','cara_distal','cara_oclusal','estado_general_pieza'];
const keyOf=(piece?:Record<string,any>)=>FACES.map(f=>piece?.[f]??'').join('|');
async function columns(db:DB){
 const found=(await rows('SELECT COLUMN_NAME c FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="odontograma_piezas"',[],db)).map((r:any)=>r.c);
 return FACES.filter(f=>found.includes(f));
}
async function copyCurrent(versionId:number,diagnosis:number,db:DB){
 const list=(await columns(db)).map(c=>','+c).join('');
 await exec(`INSERT IGNORE INTO odontograma_versiones_piezas (id_version,numero_pieza${list}) SELECT ?,numero_pieza${list} FROM odontograma_piezas WHERE id_diagnostico=?`,[versionId,diagnosis],db);
}
/** Guarda el estado actual como una versión nueva (la siguiente en número). */
export async function snapshotVersion(diagnosis:number,userId:number|null,note:string|null,db:DB){
 const next=Number((await rows('SELECT COALESCE(MAX(numero),0)+1 n FROM odontograma_versiones WHERE id_diagnostico=?',[diagnosis],db))[0].n);
 const created=await exec('INSERT INTO odontograma_versiones (id_diagnostico,numero,id_usuario,nota) VALUES (?,?,?,?)',[diagnosis,next,userId,note],db);
 await copyCurrent(created.insertId,diagnosis,db);
 return {id_version:created.insertId,numero:next};
}
/** Si el diagnóstico tiene odontograma pero aún no tiene versiones, crea la versión 1 con el estado actual. */
export async function ensureBaseline(diagnosis:number,userId:number|null,db:DB){
 if((await rows('SELECT 1 FROM odontograma_versiones WHERE id_diagnostico=? LIMIT 1',[diagnosis],db)).length)return;
 if((await rows('SELECT 1 FROM odontograma_piezas WHERE id_diagnostico=? LIMIT 1',[diagnosis],db)).length)await snapshotVersion(diagnosis,userId,null,db);
}
/** Edición en el mismo registro: la última versión se mantiene igual al estado actual (no crea una versión nueva). */
export async function syncLatestVersion(diagnosis:number,userId:number|null,db:DB){
 const latest=(await rows('SELECT id_version FROM odontograma_versiones WHERE id_diagnostico=? ORDER BY numero DESC LIMIT 1 FOR UPDATE',[diagnosis],db))[0];
 if(!latest){await ensureBaseline(diagnosis,userId,db);return;}
 await exec('DELETE FROM odontograma_versiones_piezas WHERE id_version=?',[latest.id_version],db);
 await copyCurrent(latest.id_version,diagnosis,db);
}
/** Todas las versiones de un diagnóstico (la más reciente primero) con sus piezas. */
export async function loadVersions(diagnosis:number,db:DB=pool){
 const versions=await rows('SELECT v.id_version,v.numero,v.fecha_registro,v.nota,CONCAT(u.nombre," ",u.apellido) usuario FROM odontograma_versiones v LEFT JOIN usuarios u ON u.id_usuario=v.id_usuario WHERE v.id_diagnostico=? ORDER BY v.numero DESC',[diagnosis],db);
 for(const version of versions)version.piezas=await rows('SELECT * FROM odontograma_versiones_piezas WHERE id_version=? ORDER BY numero_pieza',[version.id_version],db);
 return versions;
}
/** Números de pieza que difieren entre el estado actual y la última versión guardada. */
export async function changedPieces(diagnosis:number,db:DB){
 const latest=(await rows('SELECT id_version FROM odontograma_versiones WHERE id_diagnostico=? ORDER BY numero DESC LIMIT 1',[diagnosis],db))[0];
 const current=await rows('SELECT * FROM odontograma_piezas WHERE id_diagnostico=?',[diagnosis],db);
 const previous=latest?await rows('SELECT * FROM odontograma_versiones_piezas WHERE id_version=?',[latest.id_version],db):[];
 const numbers=new Set([...current,...previous].map((p:any)=>Number(p.numero_pieza)));
 return [...numbers].filter(n=>keyOf(current.find((p:any)=>Number(p.numero_pieza)===n))!==keyOf(previous.find((p:any)=>Number(p.numero_pieza)===n))).sort((a,b)=>a-b);
}
