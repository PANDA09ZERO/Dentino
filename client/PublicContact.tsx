import {useState,type FormEvent} from 'react';
import {Check,AlertCircle,Phone,MessageCircle} from 'lucide-react';
import {api} from './api';
const empty={nombre:'',telefono:'',correo:'',interes:'',turno:'',mensaje:'',sitio_web:''};
const shifts=['Mañana','Tarde','Noche'];
// Solicitud de cita del formulario público. El servicio de interés y el turno preferido se agregan al mensaje,
// así Recepción los ve en «Solicitudes de contacto» sin cambiar el servidor.
export function ContactForm({interests=[],tel='',wa=''}:{interests?:string[];tel?:string;wa?:string}){
 const [form,setForm]=useState(empty),[busy,setBusy]=useState(false),[done,setDone]=useState(''),[error,setError]=useState('');
 const set=(key:keyof typeof empty,value:string)=>setForm(f=>({...f,[key]:value}));
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setError('');
  if(!form.telefono.trim()&&!form.correo.trim()){setError('Indica un teléfono o un correo para poder responderte.');return;}
  const mensaje=[form.interes&&'Servicio de interés: '+form.interes,form.turno&&'Turno preferido: '+form.turno,form.mensaje.trim()].filter(Boolean).join('\n');
  if(mensaje.length<5){setError('Elige un servicio o cuéntanos en pocas palabras qué necesitas.');return;}
  if(mensaje.length>1000){setError('El mensaje es demasiado largo (máximo 1000 caracteres).');return;}
  setBusy(true);
  try{await api('/publico/solicitud','POST',{nombre:form.nombre,telefono:form.telefono,correo:form.correo,mensaje,sitio_web:form.sitio_web});setDone(form.nombre.trim().split(' ')[0]||'listo');setForm(empty);}
  catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 if(done)return <div className="pub-success" role="status"><span className="pub-success-icon" aria-hidden="true"><Check size={22}/></span><h3>¡Gracias, {done}!</h3><p>Recibimos tu solicitud. Te contactaremos para acordar el día y la hora de tu cita.</p>
  {(tel||wa)&&<p className="pub-success-urgent">¿Es urgente? {tel&&<a href={tel}><Phone size={14}/>Llámanos</a>}{wa&&<a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={14}/>WhatsApp</a>}</p>}
  <button type="button" className="button" onClick={()=>setDone('')}>Enviar otra solicitud</button></div>;
 return <form onSubmit={submit} className="pub-contact-form" noValidate>
  {error&&<div className="notice" role="alert"><AlertCircle size={16}/>{error}</div>}
  <div className="form-grid">
   <label className="full">Nombre y apellido<input value={form.nombre} onChange={e=>set('nombre',e.target.value)} maxLength={100} autoComplete="name" required/></label>
   <label>Teléfono<input type="tel" value={form.telefono} onChange={e=>set('telefono',e.target.value.replace(/\D/g,''))} maxLength={15} inputMode="numeric" autoComplete="tel"/></label>
   <label>Correo electrónico<input type="email" value={form.correo} onChange={e=>set('correo',e.target.value)} maxLength={100} autoComplete="email"/></label>
   {interests.length>0&&<label>Servicio de interés<select value={form.interes} onChange={e=>set('interes',e.target.value)}><option value="">Elige una opción</option>{interests.map(x=><option key={x}>{x}</option>)}<option>Otro / no estoy seguro</option></select></label>}
   <label>Turno preferido<select value={form.turno} onChange={e=>set('turno',e.target.value)}><option value="">Sin preferencia</option>{shifts.map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="full">Mensaje {form.interes?<small>(opcional)</small>:null}<textarea value={form.mensaje} onChange={e=>set('mensaje',e.target.value)} maxLength={900} rows={3} placeholder="Cuéntanos qué necesitas o si tienes alguna molestia."/></label>
  </div>
  <div aria-hidden="true" className="pub-trap"><label>No completar este campo<input tabIndex={-1} autoComplete="off" value={form.sitio_web} onChange={e=>set('sitio_web',e.target.value)}/></label></div>
  <div className="pub-form-footer"><small>Indica al menos un teléfono o un correo. Usamos tus datos solo para coordinar tu cita.</small><button className="button primary" disabled={busy}>{busy?'Enviando…':'Solicitar cita'}</button></div>
 </form>;
}
