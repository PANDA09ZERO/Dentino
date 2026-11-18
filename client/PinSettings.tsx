import {useState,type FormEvent} from 'react';
import {Check,AlertCircle} from 'lucide-react';
import {api} from './api';
export function PinSettings(){
 const [password,setPassword]=useState(''),[pin,setPin]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 async function save(e:FormEvent){e.preventDefault();if(busy)return;setError('');setSaved(false);if(!/^\d{4,8}$/.test(pin)){setError('El PIN debe tener entre 4 y 8 dígitos.');return;}if(pin!==again){setError('Los PIN no coinciden.');return;}setBusy(true);try{await api('/firma/pin','POST',{contrasena:password,pin});setSaved(true);setPassword('');setPin('');setAgain('');}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 return <>
  <header className="page-header"><div><span className="eyebrow">MI CUENTA</span><h1>Mi PIN de firma</h1><p>Los doctores usan este PIN personal para firmar diagnósticos y evoluciones. Un registro firmado ya no puede modificarse ni eliminarse. Nadie más, ni el administrador, puede ver o cambiar tu PIN.</p></div></header>
  {error&&<div className="notice" role="alert"><AlertCircle size={16}/>{error}</div>}
  {saved&&<div className="success" role="status"><Check size={16}/>PIN guardado.</div>}
  <form className="card" onSubmit={save}><div className="form-grid">
   <label className="full">Contraseña de tu cuenta<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><small>La pedimos para confirmar que eres tú.</small></label>
   <label>PIN nuevo (4 a 8 dígitos)<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} minLength={4} maxLength={8} required/></label>
   <label>Repite el PIN<input type="password" inputMode="numeric" autoComplete="off" value={again} onChange={e=>setAgain(e.target.value.replace(/\D/g,''))} minLength={4} maxLength={8} required/></label>
  </div><div className="form-footer"><button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar PIN'}</button></div></form>
 </>;
}
