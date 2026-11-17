import {useState,type FormEvent} from 'react';
import {Check,AlertCircle} from 'lucide-react';
import {api} from './api';
const empty={nombre:'',telefono:'',correo:'',mensaje:'',sitio_web:''};
export function ContactForm(){
 const [form,setForm]=useState(empty),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const set=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api('/publico/solicitud','POST',form);setDone(true);setForm(empty);}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 if(done)return <div className="success" role="status"><Check size={16}/>Recibimos tu mensaje. Te contactaremos pronto.</div>;
 return <form onSubmit={submit} style={{marginTop:16,position:'relative'}}>
  {error&&<div className="notice" role="alert"><AlertCircle size={16}/>{error}</div>}
  <div className="form-grid"><label>Nombre<input value={form.nombre} onChange={e=>set('nombre',e.target.value)} maxLength={100} required/></label><label>Teléfono<input value={form.telefono} onChange={e=>set('telefono',e.target.value)} maxLength={30} inputMode="tel"/></label><label>Correo electrónico<input type="email" value={form.correo} onChange={e=>set('correo',e.target.value)} maxLength={100}/></label><label className="full">Mensaje<textarea value={form.mensaje} onChange={e=>set('mensaje',e.target.value)} maxLength={1000} rows={4} required/></label></div>
  <div aria-hidden="true" style={{position:'absolute',left:'-9999px',height:0,overflow:'hidden'}}><label>No completar este campo<input tabIndex={-1} autoComplete="off" value={form.sitio_web} onChange={e=>set('sitio_web',e.target.value)}/></label></div>
  <p><small>Indica al menos un teléfono o un correo para que podamos responderte.</small></p>
  <div className="form-footer"><button className="button primary" disabled={busy}>{busy?'Enviando…':'Enviar mensaje'}</button></div>
 </form>;
}
