import {createTransport,type Transporter} from 'nodemailer';
import {rows,exec} from './db.js';
// Correo saliente con cola persistente y reintentos. Se activa solo si .env define SMTP_HOST y SMTP_FROM.
// Las credenciales (SMTP_USER, SMTP_PASS) se leen únicamente del entorno y nunca se guardan ni se registran.
export const mailConfigured=()=>Boolean(process.env.SMTP_HOST&&process.env.SMTP_FROM);
let transporter:Transporter|null=null;
function transport(){return transporter??=createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS||''}:undefined,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000});}
const validAddress=(value:string)=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
/** Agrega un correo a la cola. Devuelve false si el correo no está configurado o el destinatario no es válido. */
export async function enqueueMail(to:string,subject:string,text:string){
 if(!mailConfigured()||!validAddress(to))return false;
 await exec('INSERT INTO cola_correos(destinatario,asunto,cuerpo) VALUES (?,?,?)',[to,subject.slice(0,200),text.slice(0,20000)]);
 setTimeout(()=>void processMailQueue(),500).unref();
 return true;
}
let sending=false;
export async function processMailQueue(){
 if(sending||!mailConfigured())return;sending=true;
 try{
  const due=await rows("SELECT id_correo,destinatario,asunto,cuerpo,intentos FROM cola_correos WHERE estado='Pendiente' AND proximo_intento<=CURRENT_TIMESTAMP ORDER BY id_correo LIMIT 10");
  for(const mail of due){
   try{
    await transport().sendMail({from:process.env.SMTP_FROM,to:mail.destinatario,subject:mail.asunto,text:mail.cuerpo});
    await exec("UPDATE cola_correos SET estado='Enviado',intentos=intentos+1,fecha_envio=CURRENT_TIMESTAMP,ultimo_error=NULL WHERE id_correo=?",[mail.id_correo]);
   }catch(error:any){
    const attempts=mail.intentos+1;const delay=[5,15,60,240][Math.min(attempts-1,3)];
    // Solo se guarda un código corto del error; nunca el mensaje completo, que puede incluir direcciones o credenciales.
    await exec("UPDATE cola_correos SET estado=?,intentos=?,ultimo_error=?,proximo_intento=DATE_ADD(CURRENT_TIMESTAMP,INTERVAL ? MINUTE) WHERE id_correo=?",[attempts>=5?'Fallido':'Pendiente',attempts,String(error?.code||error?.responseCode||'error').slice(0,100),delay,mail.id_correo]);
   }
  }
 }catch(error){console.error('No se pudo procesar la cola de correo:',(error as any).code||'error');}
 finally{sending=false;}
}
export function startMailWorker(){const timer=setInterval(()=>void processMailQueue(),60000);timer.unref();void processMailQueue();}
export async function mailStats(){
 const counts:Record<string,number>={Pendiente:0,Enviado:0,Fallido:0};
 for(const row of await rows('SELECT estado,COUNT(*) n FROM cola_correos GROUP BY estado'))counts[row.estado]=Number(row.n);
 return {configurado:mailConfigured(),pendientes:counts.Pendiente,enviados:counts.Enviado,fallidos:counts.Fallido};
}
