import {useEffect,useState,type FormEvent} from 'react';
import {Mail,Phone,MapPin,Calendar,User as UserIcon,ShieldCheck} from 'lucide-react';
import {api} from './api';
import {type User,Notice} from './ui';
export function Profile({user,onUpdate}:{user:User;onUpdate:(user:User)=>void}){
 const [info,setInfo]=useState({nombre:user.nombre,apellido:user.apellido,telefono:'',fecha_nacimiento:'',sexo:'',direccion:'',especialidad:''}),[actual,setActual]=useState(''),[nueva,setNueva]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api('/perfil').then(r=>setInfo({nombre:r.nombre,apellido:r.apellido,telefono:r.telefono||'',fecha_nacimiento:r.fecha_nacimiento||'',sexo:r.sexo||'',direccion:r.direccion||'',especialidad:r.especialidad||''})).catch(e=>setError(e.message));},[]);
 async function save(e:FormEvent,password=false){e.preventDefault();setError('');setSuccess('');if(password&&nueva!==confirm){setError('Las contraseñas no coinciden');return;}setBusy(true);try{const r=await api(password?'/perfil/clave':'/perfil',password?'POST':'PUT',password?{actual,nueva}:info);onUpdate(r.user);setSuccess(password?'Contraseña actualizada.':'Perfil actualizado.');if(password){setActual('');setNueva('');setConfirm('');}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const initials=(user.nombre[0]||'')+(user.apellido[0]||'');
 const edad=info.fecha_nacimiento?new Date().getFullYear()-new Date(info.fecha_nacimiento).getFullYear():null;
 const sexoLabel=info.sexo==='M'?'Masculino':info.sexo==='F'?'Femenino':info.sexo==='Otro'?'Otro':'';
 return <>
  <header className="page-header">
   <div><span className="eyebrow">DENTINO / MI PERFIL</span><h1>Mi perfil</h1><p>Administra tu información personal y credenciales de acceso.</p></div>
  </header>
  <Notice error={error}/>
  {success&&<div className="success" role="status">{success}</div>}
  <div className="user-detail-grid">
   <section className="card user-profile-card" aria-label="Resumen del perfil">
    <div className="avatar user-detail-avatar">{initials}</div>
    <span className="eyebrow">USUARIO #{user.id_usuario}</span>
    <h2>{user.nombre} {user.apellido}</h2>
    <p>{user.rol}{info.especialidad&&` · ${info.especialidad}`}</p>
    <dl className="user-profile-facts">
     <div><dt>Correo</dt><dd>{user.correo}</dd></div>
     {edad!==null?<div><dt>Edad</dt><dd>{edad} años</dd></div>:null}
    </dl>
   </section>
   {!user.cambio_clave_pendiente&&<section className="card" aria-labelledby="personal-heading">
    <span className="eyebrow">DATOS PERSONALES</span><h2 id="personal-heading">Información personal</h2>
    <form onSubmit={e=>save(e)}>
     <dl className="user-detail-facts">
      <div><dt>Nombre</dt><dd><input required maxLength={50} aria-label="Nombre" value={info.nombre} onChange={e=>setInfo({...info,nombre:e.target.value})}/></dd></div>
      <div><dt>Apellido</dt><dd><input required maxLength={50} aria-label="Apellido" value={info.apellido} onChange={e=>setInfo({...info,apellido:e.target.value})}/></dd></div>
      <div><dt><Calendar size={17}/>Fecha de nacimiento</dt><dd><input type="date" aria-label="Fecha de nacimiento" value={info.fecha_nacimiento} onChange={e=>setInfo({...info,fecha_nacimiento:e.target.value})}/></dd></div>
      <div><dt><UserIcon size={17}/>Sexo</dt><dd><select aria-label="Sexo" value={info.sexo} onChange={e=>setInfo({...info,sexo:e.target.value})}><option value="">Seleccionar...</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="Otro">Otro</option></select></dd></div>
      <div><dt><Phone size={17}/>Teléfono</dt><dd><input maxLength={15} inputMode="numeric" aria-label="Teléfono" placeholder="Solo números" value={info.telefono} onChange={e=>setInfo({...info,telefono:e.target.value.replace(/\D/g,'')})}/></dd></div>
      <div><dt><MapPin size={17}/>Dirección</dt><dd><textarea rows={2} maxLength={500} aria-label="Dirección" placeholder="Dirección completa" value={info.direccion} onChange={e=>setInfo({...info,direccion:e.target.value})}/></dd></div>
      <div><dt>Especialidad</dt><dd><input maxLength={100} aria-label="Especialidad" placeholder="Ej: Odontopediatra, Ortodoncista" value={info.especialidad} onChange={e=>setInfo({...info,especialidad:e.target.value})}/></dd></div>
     </dl>
     <div className="form-footer"><button className="button primary" disabled={busy}>Guardar cambios</button></div>
    </form>
   </section>}
   <section className="card" aria-labelledby="password-heading">
    <span className="eyebrow">SEGURIDAD</span><h2 id="password-heading">{user.cambio_clave_pendiente?'Cambia tu contraseña temporal':'Cambiar contraseña'}</h2>
    {user.cambio_clave_pendiente?<p className="muted">Por seguridad, debes cambiar tu contraseña temporal antes de continuar.</p>:null}
    <form onSubmit={e=>save(e,true)}>
     <dl className="user-detail-facts">
      <div><dt><ShieldCheck size={17}/>Contraseña actual</dt><dd><input type="password" required autoComplete="current-password" aria-label="Contraseña actual" value={actual} onChange={e=>setActual(e.target.value)}/></dd></div>
      <div><dt>Nueva contraseña</dt><dd><input type="password" required minLength={8} maxLength={72} autoComplete="new-password" aria-label="Nueva contraseña" placeholder="Mínimo 8 caracteres" value={nueva} onChange={e=>setNueva(e.target.value)}/></dd></div>
      <div><dt>Repetir nueva contraseña</dt><dd><input type="password" required autoComplete="new-password" aria-label="Repetir nueva contraseña" placeholder="Confirma tu contraseña" value={confirm} onChange={e=>setConfirm(e.target.value)}/></dd></div>
     </dl>
     <div className="form-footer"><button className="button primary" disabled={busy}>{user.cambio_clave_pendiente?'Establecer contraseña':'Cambiar contraseña'}</button></div>
    </form>
   </section>
  </div>
 </>;
}
