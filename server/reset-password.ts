// Restablece la contraseña de una cuenta desde la terminal local (para cuando nadie puede iniciar sesión).
// Uso: npm run user:reset-password
// No muestra ni guarda la contraseña en texto: solo su hash bcrypt. Deja constancia en el registro de auditoría.
import {createInterface} from 'node:readline';
import bcrypt from 'bcryptjs';
import {rows,exec,pool} from './db.js';

// Una sola interfaz para todas las preguntas (abrir y cerrar varias se traba en la consola de Windows).
const rl=createInterface({input:process.stdin,output:process.stdout});
const lines:string[]=[];const waiting:((line:string)=>void)[]=[];
rl.on('line',line=>{const next=waiting.shift();if(next)next(line);else lines.push(line);});
// Ctrl+C o fin de la entrada: salir sin cambiar nada.
rl.on('SIGINT',()=>{process.stdout.write('\nCancelado. No se cambió nada.\n');void pool.end();process.exit(130);});
rl.on('close',()=>{if(waiting.length){process.stdout.write('\nCancelado. No se cambió nada.\n');void pool.end();process.exit(130);}});
let muted=false;const output=(rl as any)._writeToOutput;
(rl as any)._writeToOutput=function(text:string){if(!muted)return output.call(rl,text);if(text==='\r\n'||text==='\n')return output.call(rl,text);};
function ask(question:string,hidden=false):Promise<string>{
 process.stdout.write(question);muted=hidden&&Boolean(process.stdin.isTTY);
 return new Promise(resolve=>{const done=(line:string)=>{if(muted)process.stdout.write('\n');muted=false;resolve(line);};const queued=lines.shift();if(queued!==undefined)done(queued);else waiting.push(done);});
}

async function main(){
 const users=await rows("SELECT id_usuario,nombre,apellido,correo,rol,estado FROM usuarios ORDER BY rol='Administrador' DESC,id_usuario");
 if(!users.length){console.log('No hay usuarios registrados.');return;}
 console.log('\nCuentas registradas:\n');
 for(const u of users)console.log(`  [${u.id_usuario}] ${u.nombre} ${u.apellido} · ${u.correo} · ${u.rol} · ${u.estado}`);
 const id=Number((await ask('\nEscribe el número entre corchetes de la cuenta y pulsa Enter: ')).trim());
 const user=users.find(u=>u.id_usuario===id);
 if(!user){console.log('Número no válido. No se cambió nada.');return;}
 console.log(`Cuenta elegida: ${user.correo}`);
 if(user.estado!=='Activo')console.log('Aviso: esta cuenta está inactiva; podrás cambiar la contraseña, pero no podrá iniciar sesión hasta reactivarla.');
 console.log('(Por seguridad, lo que escribas en la contraseña no se verá en pantalla. Escribe y pulsa Enter.)');
 const first=await ask('Nueva contraseña (mínimo 8 caracteres): ',true);
 if(first.length<8||first.length>200){console.log('La contraseña debe tener entre 8 y 200 caracteres. No se cambió nada.');return;}
 const second=await ask('Repite la nueva contraseña: ',true);
 if(first!==second){console.log('Las contraseñas no coinciden. No se cambió nada.');return;}
 const hash=await bcrypt.hash(first,12);
 await exec('UPDATE usuarios SET contrasena=? WHERE id_usuario=?',[hash,id]);
 try{await exec('INSERT INTO dentino_audit(usuario,modulo,registro,accion,ip,detalle) VALUES (?,?,?,?,?,?)',[null,'usuarios',id,'contrasena_restablecida','terminal local','Restablecida con npm run user:reset-password']);}catch{/* la auditoría no debe impedir el cambio */}
 console.log(`\nListo. La contraseña de ${user.correo} fue actualizada. Ya puedes iniciar sesión.`);
}

main().catch(e=>{console.error('No se pudo restablecer la contraseña:',e instanceof Error?e.message:e);process.exitCode=1;}).finally(()=>{rl.close();pool.end();});
