import {useState} from 'react';
import {Download} from 'lucide-react';
import {api} from './api';
import {label,type Row} from '../shared/modules';
import {type Option,date,useLoad,Notice,Loading,Header,SimpleTable} from './ui';
// Reportes con filtros, Excel y PDF generado en el servidor (RF-52 a RF-57).
export function Reports({rol}:{rol:string}){
 const admin=rol==='Administrador';
 const kinds:[string,string][]=([['pacientes','Pacientes'],['citas','Citas'],['ingresos','Ingresos y egresos'],['planes','Planes de tratamiento'],['tratamientos','Tratamientos más solicitados'],['inventario','Inventario'],['doctores','Rendimiento por doctor']] as [string,string][]).filter(([k])=>admin||(rol==='Recepcionista'?['pacientes','citas','tratamientos']:['citas','tratamientos']).includes(k));
 const [kind,setKind]=useState(kinds[0][0]),[start,setStart]=useState(new Date().toLocaleDateString('en-CA').slice(0,7)+'-01'),[end,setEnd]=useState(new Date().toLocaleDateString('en-CA')),[filter,setFilter]=useState(''),[doctor,setDoctor]=useState('');
 const withDoctor=kind==='citas'||kind==='doctores';
 const {data:doctors}=useLoad<Option[]>(withDoctor?'/opciones/usuarios':'');
 const query=new URLSearchParams({inicio:start,fin:end,...(filter?{[kind==='pacientes'?'sexo':kind==='ingresos'?'metodo_pago':'estado']:filter}:{}),...(withDoctor&&doctor?{doctor}:{})});
 const {data,error,loading}=useLoad<Row[]>('/reportes/'+kind+'?'+query);
 return <><Header heading="Reportes" description="Información de la clínica para tomar mejores decisiones."><a className="button" href={'/api/reportes/'+kind+'?'+query+'&format=xlsx'}><Download size={16}/>Excel</a><a className="button" href={'/api/reportes/'+kind+'?'+query+'&format=pdf'}><Download size={16}/>PDF</a></Header>
  <section className="card"><div className="filters"><label>Reporte<select value={kind} onChange={e=>{setKind(e.target.value);setFilter('');}}>{kinds.map(([k,t])=><option key={k} value={k}>{t}</option>)}</select></label>{kind!=='inventario'&&<><label>Desde<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Hasta<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></>}{['pacientes','citas','ingresos','planes'].includes(kind)&&<label>Filtro<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos</option>{(kind==='pacientes'?['Masculino','Femenino','Otro']:kind==='citas'?['Pendiente','Confirmada','Atendida','Cancelada','Reprogramada','No asistió']:kind==='ingresos'?['Efectivo','Tarjeta','Transferencia','Yape','Plin']:['Propuesto','En progreso','Finalizado','Abandonado']).map(v=><option key={v}>{v}</option>)}</select></label>}{withDoctor&&<label>Doctor<select value={doctor} onChange={e=>setDoctor(e.target.value)}><option value="">Todos</option>{doctors?.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}</div><Notice error={error}/>{loading?<Loading/>:data&&<SimpleTable rows={data}/>}</section></>;
}
