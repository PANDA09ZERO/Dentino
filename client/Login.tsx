import {useEffect,useState} from 'react';
import {BrandMark} from './BrandMark';
import {ArrowRight,Smartphone,Share,MoreVertical,X} from 'lucide-react';
import {api} from './api';
import {type User,go,Notice} from './ui';
import {canPromptInstall,isInstalled,isIOS,onInstallChange,promptInstall} from './install';
// «Descargar en el teléfono»: instala Dentino como app. Si el navegador lo permite abre su diálogo; si no (iPhone, o sin aviso
// del navegador), muestra los pasos para hacerlo desde el menú. No se muestra si ya se abrió como app instalada.
function InstallApp(){
 const [ready,setReady]=useState(canPromptInstall()),[installed,setInstalled]=useState(isInstalled()),[help,setHelp]=useState(false),[done,setDone]=useState(false);
 useEffect(()=>onInstallChange(()=>{setReady(canPromptInstall());setInstalled(isInstalled());}),[]);
 if(installed)return null;
 async function install(){if(ready){if(await promptInstall())setDone(true);}else setHelp(h=>!h);}
 const ios=isIOS();
 return <div className="install-app">
  <button type="button" className="button install-button" onClick={install} aria-expanded={!ready?help:undefined}><Smartphone size={17}/>Descargar en el teléfono</button>
  {done&&<p className="install-note" role="status">Listo: Dentino quedó en la pantalla de inicio de tu teléfono.</p>}
  {help&&<div className="install-help" role="region" aria-label="Cómo instalar Dentino"><button type="button" className="icon-btn install-close" aria-label="Cerrar instrucciones" onClick={()=>setHelp(false)}><X size={15}/></button>
   <b>Instala Dentino como una app</b>
   {ios?<ol><li>Abre esta página en <strong>Safari</strong>.</li><li>Toca <Share size={14} aria-label="Compartir"/> <strong>Compartir</strong>.</li><li>Elige <strong>Agregar a pantalla de inicio</strong> y confirma.</li></ol>
   :<ol><li>Abre esta página en <strong>Chrome</strong> desde tu teléfono.</li><li>Toca el menú <MoreVertical size={14} aria-label="Menú"/>.</li><li>Elige <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.</li></ol>}
   {!window.isSecureContext&&<small>La instalación necesita la dirección segura (https://) de la clínica. Pide al administrador el enlace correcto.</small>}
  </div>}
 </div>;
}
export function Login({onLogin}:{onLogin:(u:User)=>void}){const [error,setError]=useState(''),[busy,setBusy]=useState(false);return <main className="login-layout"><section className="login-intro"><a href="#inicio" className="brand"><BrandMark size={34}/>Dentino</a><h1>Más tiempo para cuidar sonrisas.</h1><p>Pacientes, tratamientos y equipo en un mismo lugar.</p><div className="login-room" aria-hidden="true"><img src="/images/sm/clinica-4.jpg" srcSet="/images/sm/clinica-4.jpg 640w, /images/clinica-4.jpg 1200w" sizes="45vw" alt=""/><span className="slats"/></div></section><section className="login-panel"><div className="login-card"><h2>Inicia sesión</h2><p>Usa las credenciales de tu cuenta de la clínica.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const values=Object.fromEntries(new FormData(e.currentTarget));try{const r=await api('/auth/login','POST',values);onLogin(r.user);go('dashboard');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Correo electrónico<input name="correo" type="email" autoComplete="username" required placeholder="tu@clinica.com"/></label><label>Contraseña<input name="contrasena" type="password" autoComplete="current-password" required/></label><Notice error={error}/><button className="button primary" disabled={busy}>{busy?'Ingresando…':'Entrar a la clínica'}<ArrowRight size={17}/></button></form><small>Acceso exclusivo para el equipo autorizado.</small><InstallApp/></div></section></main>;}
