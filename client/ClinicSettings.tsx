import {useEffect,useState,type FormEvent} from 'react';
import {Check,AlertCircle} from 'lucide-react';
import {api} from './api';
const fields:[string,string,string][]=[['razon_social','Razón social','Nombre legal que aparecerá en los comprobantes'],['ruc','RUC','11 dígitos'],['direccion','Dirección','Se muestra en comprobantes y en la página pública'],['telefono','Teléfono','Se muestra en comprobantes y en la página pública'],['correo','Correo electrónico','Se muestra en la página pública'],['whatsapp','WhatsApp','Solo dígitos con código de país, por ejemplo 51987654321. Activa el botón de WhatsApp en la página pública'],['horario','Horario de atención','Se muestra en la página pública'],['mapa_url','URL del mapa de Google Maps','Pega solo la dirección https://www.google.com/maps/embed?... del atributo src del iframe']];
export function ClinicSettings(){
 const [mail,setMail]=useState<Record<string,any>|null>(null);
 const [values,setValues]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{let active=true;api<Record<string,string>>('/configuracion').then(data=>{if(active)setValues(data);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;api<Record<string,any>>('/correo/estado').then(d=>{if(active)setMail(d);}).catch(()=>{});return()=>{active=false;};},[]);
 async function save(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');setSaved(false);try{setValues(await api<Record<string,string>>('/configuracion','PUT',values));setSaved(true);}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 return <>
  <header className="page-header"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Configuración de la clínica</h1><p>Estos datos se usan en los comprobantes simulados y en la página pública. No se inventa ningún dato: lo que dejes vacío aparece como «Por configurar».</p></div></header>
  {mail&&<div className="card"><strong>Correo saliente:</strong> {mail.configurado?'configurado':'no configurado (define SMTP_HOST, SMTP_PORT, SMTP_FROM y las credenciales en el archivo .env y reinicia la API)'}{mail.configurado&&<> · Enviados: {mail.enviados} · Pendientes: {mail.pendientes} · Fallidos: {mail.fallidos}</>}</div>}
  {error&&<div className="notice" role="alert"><AlertCircle size={16}/>{error}</div>}
  {saved&&<div className="success" role="status"><Check size={16}/>Configuración guardada.</div>}
  {loading?<div className="loading" role="status">Cargando…</div>:<form className="card" onSubmit={save}><div className="form-grid">{fields.map(([key,text,help])=><label key={key} className={key==='mapa_url'?'full':undefined}>{text}<input value={values[key]||''} inputMode={/^(ruc|telefono|whatsapp)$/.test(key)?'numeric':undefined} onChange={e=>setValues(v=>({...v,[key]:/^(ruc|telefono|whatsapp)$/.test(key)?e.target.value.replace(/\D/g,''):e.target.value}))} maxLength={key==='mapa_url'?800:250}/><small>{help}</small></label>)}</div><div className="form-footer"><button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar configuración'}</button></div></form>}
 </>;
}
