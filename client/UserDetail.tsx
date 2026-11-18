import {useEffect,useState} from 'react';
import {ArrowLeft,Mail,Phone,MapPin,ShieldCheck,Clock,Stethoscope,Printer,Pencil,AlertCircle} from 'lucide-react';
import {api} from './api';
import type {Row} from '../shared/modules';

export function UserDetail({id}:{id:string}) {
  const [user,setUser]=useState<Row|null>(null);
  const [specialty,setSpecialty]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    setUser(null);setError('');setSpecialty('');setLoading(true);
    async function load(){
      if(!/^\d+$/.test(id)||Number(id)<1)throw new Error('Selecciona un usuario válido desde el listado.');
      const record=await api<Row>('/recursos/usuarios/'+encodeURIComponent(id));
      if(!active)return;
      setUser(record);
      if(record.id_especialidad){
        const details=await api<Row>('/recursos/especialidades/'+record.id_especialidad);
        if(active)setSpecialty(details.nombre_especialidad);
      }
    }
    load().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id]);
  const fullName=user?[user.nombre,user.apellido].filter(Boolean).join(' '):'';
  const initials=user?[user.nombre,user.apellido].map(v=>String(v||'').slice(0,1)).join(''):'';
  return <>
    <header className="page-header">
      <div><span className="eyebrow">Equipo</span><h1>Detalle de usuario</h1><p>Información personal y funciones dentro de la clínica.</p></div>
      <div className="header-actions">
        <a className="button" href="#usuarios"><ArrowLeft size={16}/>Volver a usuarios</a>
        {user&&<><a className="button primary" href={'#usuarios?editar='+user.id_usuario}><Pencil size={16}/>Editar usuario</a><button className="button" onClick={()=>window.print()}><Printer size={16}/>Imprimir / PDF</button></>}
      </div>
    </header>
    {error&&<div className="notice" role="alert"><AlertCircle size={18}/>{error}</div>}
    {loading?<div className="loading" role="status">Cargando ficha del usuario…</div>:user&&<div className="user-detail-grid">
      <section className="card user-profile-card" aria-label="Resumen del usuario">
        <div className="avatar user-detail-avatar">{initials}</div>
        <span className="eyebrow">Usuario #{user.id_usuario}</span>
        <h2>{fullName}</h2>
        <p>{user.rol}</p>
        <span className={'badge '+(user.estado==='Activo'?'good':'bad')}>{user.estado}</span>
        <dl className="user-profile-facts"><div><dt>DNI</dt><dd>{user.dni||'No registrado'}</dd></div><div><dt>Especialidad</dt><dd>{specialty||(user.id_especialidad?'Consultando especialidad…':'Sin especialidad asignada')}</dd></div></dl>
      </section>
      <section className="card" aria-labelledby="user-contact-heading">
        <span className="eyebrow">Datos personales</span><h2 id="user-contact-heading">Información de contacto</h2>
        <dl className="user-detail-facts">
          <div><dt><Mail size={17}/>Correo electrónico</dt><dd>{user.correo?<a href={'mailto:'+user.correo}>{user.correo}</a>:'No registrado'}</dd></div>
          <div><dt><Phone size={17}/>Teléfono</dt><dd>{user.telefono?<a href={'tel:'+String(user.telefono).replace(/[^+\d]/g,'')}>{user.telefono}</a>:'No registrado'}</dd></div>
          <div><dt><MapPin size={17}/>Dirección</dt><dd>{user.direccion||'No registrada'}</dd></div>
        </dl>
      </section>
      <section className="card" aria-labelledby="user-work-heading">
        <span className="eyebrow">Organización del equipo</span><h2 id="user-work-heading">Datos laborales</h2>
        <dl className="user-detail-facts">
          <div><dt><ShieldCheck size={17}/>Rol</dt><dd>{user.rol}</dd></div>
          <div><dt><Stethoscope size={17}/>Especialidad</dt><dd>{specialty||(user.id_especialidad?'No disponible':'Sin especialidad asignada')}</dd></div>
          <div><dt><Clock size={17}/>Turno</dt><dd>{user.turno||'Sin turno asignado'}</dd></div>
          <div><dt>Estado de la cuenta</dt><dd>{user.estado}</dd></div>
        </dl>
      </section>
    </div>}
  </>;
}
