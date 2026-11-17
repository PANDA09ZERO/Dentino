// Instalación de Dentino como app en el teléfono (PWA).
// El navegador avisa una sola vez, a veces antes de que exista el botón, así que el aviso se guarda aquí.
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
let deferred:InstallEvent|null=null;
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(listener=>listener());
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event as InstallEvent;notify();});
window.addEventListener('appinstalled',()=>{deferred=null;notify();});
export const canPromptInstall=()=>deferred!==null;
export const isInstalled=()=>window.matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true;
export const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
export function onInstallChange(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
/** Abre el diálogo de instalación del navegador. Devuelve true si la persona aceptó. */
export async function promptInstall(){
 if(!deferred)return false;
 const event=deferred;deferred=null;
 await event.prompt();const choice=await event.userChoice;notify();
 return choice.outcome==='accepted';
}
// El service worker solo funciona en contexto seguro (HTTPS o localhost).
if('serviceWorker' in navigator&&window.isSecureContext)window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});
