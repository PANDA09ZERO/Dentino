import {useState} from 'react';
import {Activity,ArrowRight,ArrowUpRight,CalendarDays,FileText,Package,Plus,Users,Wallet,Stethoscope,Check} from 'lucide-react';
import {api} from './api';
import {type Row} from '../shared/modules';
import {type User,money,date,go,useLoad,Notice,Empty,Loading,Header,Badge} from './ui';
// Inicio según el rol, con el diseño Bento de la clínica: bienvenida, cifras, citas del día con acciones rápidas,
// seguimiento clínico y, para Administrador, saldos por cobrar y alertas de inventario.
export function Dashboard({user}:{user:User}){
 const [version,setVersion]=useState(0),[busy,setBusy]=useState(0),[notice,setNotice]=useState(''),[actionError,setActionError]=useState('');
 const {data,error,loading}=useLoad('/dashboard',[version]);
 const admin=user.rol==='Administrador',readOnly=user.rol==='Doctor externo',clinical=user.rol!=='Recepcionista',canTreat=admin||user.rol==='Doctor',doctor=user.rol.startsWith('Doctor');
 async function setState(c:Row,estado:string){if(busy)return;setBusy(c.id_cita);setActionError('');setNotice('');
  try{await api('/clinica/citas/'+c.id_cita+'/estado','POST',{estado});
   if(estado==='Atendida'&&canTreat){go('historial?'+new URLSearchParams({id:String(c.id_paciente),tab:'planes',flujo:'1'}));return;}
   setNotice(estado==='Atendida'?'Cita de '+c.paciente+' marcada como atendida.':'Cita de '+c.paciente+' confirmada.');setVersion(v=>v+1);}
  catch(e){setActionError((e as Error).message);}finally{setBusy(0);}}
 // Cobran Administrador y Recepcionista. La Recepcionista no abre la ficha clínica, así que cobra desde Caja → Pagos del paciente.
 const cashier=admin||user.rol==='Recepcionista';
 const payLink=(c:Row,flow:boolean)=>admin?'#historial?'+new URLSearchParams({id:String(c.id_paciente),tab:'pagos',...(flow?{flujo:'1'}:{})}):'#caja?'+new URLSearchParams({id_paciente:String(c.id_paciente)});
 const open=(data?.today||[]).filter((c:Row)=>!/Cancelada|No asisti|Atendida/.test(c.estado));
 const pendingTotal=(data?.pending||[]).reduce((s:number,p:Row)=>s+Number(p.saldo),0);
 return <><Header heading={'Hola, '+user.nombre+'.'} description="Una mirada a tu clínica. Todo lo importante, a mano.">{!readOnly&&<button className="button primary" onClick={()=>go('citas?crear=1')}><Plus size={17}/>Nueva cita</button>}</Header>
  <Notice error={error||actionError}/>{notice&&<div className="success" role="status"><Check size={16}/>{notice}</div>}
  {loading&&!data?<Loading/>:data&&<div className="bento-grid">
   <section className="card welcome"><div><h2>Un buen día empieza con una buena atención.</h2><p>{data.today.length?<>Hoy tienes {data.today.length} cita{data.today.length===1?'':'s'}{open.length?<>, {open.length} por atender</>:<>, todas atendidas</>}.</>:<>Consulta la agenda y acompaña cada paso del tratamiento de tus pacientes.</>}</p><button className="button dark" onClick={()=>go('agenda')}>Ver agenda<ArrowUpRight size={17}/></button></div><div className="welcome-art" aria-hidden="true"><span className="slats"/></div></section>
   <section className="card stat"><span className="stat-icon"><Users/></span><span>{doctor?'Pacientes de la clínica':'Pacientes registrados'}</span><strong>{data.patients}</strong><a href="#pacientes">Ver pacientes <ArrowUpRight size={16}/></a></section>
   <section className="card stat lavender"><span className="stat-icon"><CalendarDays/></span><span>{doctor?'Tus citas de hoy':'Citas para hoy'}</span><strong>{data.today.length}</strong><a href="#agenda">Abrir agenda <ArrowUpRight size={16}/></a></section>
   <section className="card appointments"><div className="section-head"><div><h2>{doctor?'Tu agenda de hoy':'Agenda de hoy'}</h2>{data.today.length>0&&<small className="muted">{open.length?open.length+' por atender':'Todas atendidas'}</small>}</div><a href="#agenda">Ver agenda <ArrowUpRight size={16}/></a></div>
    {!data.today.length?<Empty>No hay citas programadas para hoy.</Empty>:<ul className="today-list">{data.today.map((c:Row)=>{const active=!/Cancelada|No asisti|Atendida/.test(c.estado);return <li key={c.id_cita} className={active?'':'done'}>
     <span className="time">{String(c.hora).slice(0,5)}</span>
     <div className="appointment-name"><div className="avatar soft" aria-hidden="true">{String(c.paciente).slice(0,1)}</div><div><strong>{clinical?<a href={'#historial?id='+c.id_paciente}>{c.paciente}</a>:c.paciente}</strong><small>{doctor?'':c.doctor+' · '}{c.motivo||'Consulta odontológica'}</small></div></div>
     <Badge value={c.estado}/>
     <div className="row-actions">
      {!readOnly&&/Pendiente|Reprogramada/.test(c.estado)&&<button type="button" disabled={busy===c.id_cita} onClick={()=>setState(c,'Confirmada')}>Confirmar</button>}
      {!readOnly&&active&&<button type="button" className="primary-text" disabled={busy===c.id_cita} onClick={()=>setState(c,'Atendida')}>{canTreat?'Atender':'Marcar atendida'}</button>}
      {c.estado==='Atendida'&&canTreat&&<a href={'#historial?'+new URLSearchParams({id:String(c.id_paciente),tab:'planes',flujo:'1'})}>Evolución</a>}
      {c.estado==='Atendida'&&cashier&&(Number(c.pagado)?<a className="paid-link" href={payLink(c,false)} title="El paciente ya registró un pago hoy. Abre sus pagos si necesitas cobrar otro servicio."><Check size={14}/>Pagado</a>:<a href={payLink(c,true)}>Cobrar</a>)}
     </div></li>;})}</ul>}
   </section>
   <section className="card progress"><Activity className="stat-icon"/><span className="eyebrow">Seguimiento clínico</span><h2>Sonrisas en progreso</h2><strong>{data.plans}</strong><p>Planes de tratamiento en curso</p>{clinical&&<button className="button" onClick={()=>go('pacientes')}>Ver pacientes <ArrowRight size={16}/></button>}</section>
   {admin&&<section className="card alerts"><div className="section-head"><div><span className="eyebrow">Por cobrar</span><h2>{money(pendingTotal)}</h2></div><Wallet size={20}/></div>
    {!data.pending.length?<p>No hay saldos pendientes.</p>:data.pending.map((p:Row)=><a className="alert-item" key={p.id_plan} href={'#historial?'+new URLSearchParams({id:String(p.id_paciente),tab:'pagos'})}><span>{p.paciente}<small>Plan #{p.id_plan}</small></span><strong>{money(p.saldo)}</strong></a>)}</section>}
   {admin&&<section className="card alerts"><div className="section-head"><div><span className="eyebrow">Inventario</span><h2>Atención al inventario</h2></div><Package size={20}/></div>
    {!data.alerts.length?<p>Sin alertas de stock o vencimiento.</p>:data.alerts.map((a:Row)=><a className="alert-item" href={'#inventario?q='+encodeURIComponent(a.nombre_insumo)} key={a.id_insumo}><span>{a.nombre_insumo}<small>Stock {a.stock_actual} {a.unidad_medida||''} · mínimo {a.stock_minimo}{a.fecha_vencimiento_proxima?' · vence '+date(a.fecha_vencimiento_proxima):''}</small></span><span className={'badge '+(/Vencido|Agotado/.test(a.tipo)?'bad':'')}>{a.tipo}</span></a>)}</section>}
   <section className="card quick wide"><h2>Accesos rápidos</h2><div>{[...(readOnly?[]:[['pacientes?crear=1','Registrar paciente',Users]]),...(canTreat?[['diagnosticos?crear=1','Nuevo diagnóstico',Stethoscope]]:[]),...(cashier?[['caja','Abrir caja',Wallet]]:[]),['reportes','Consultar reportes',FileText]].map(([url,text,Icon]:any)=><button key={url} onClick={()=>go(url)}><Icon size={20}/>{text}<ArrowUpRight size={18}/></button>)}</div></section>
  </div>}</>;
}
