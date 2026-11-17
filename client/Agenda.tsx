import {useState} from 'react';
import {ChevronLeft,ChevronRight,Plus} from 'lucide-react';
import {label,type Row} from '../shared/modules';
import {type Option,date,go,title,useLoad,Notice,Empty,Loading,Header} from './ui';
// Agenda en calendario: día, semana (lunes a domingo) o mes, filtrable por doctor (RF-16).
export const iso=(d:Date)=>d.toLocaleDateString('en-CA');
export const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
export const weekStart=(d:Date)=>addDays(d,-((d.getDay()+6)%7));
export const weekDays=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
export function Agenda({canCreate,clinical,doctorView}:{canCreate:boolean;clinical:boolean;doctorView:boolean}){
 const [day,setDay]=useState(()=>new Date(iso(new Date())+'T12:00:00')),[doctor,setDoctor]=useState(''),[mode,setMode]=useState<'dia'|'semana'|'mes'>(()=>window.innerWidth<760?'dia':'semana');
 const {data:doctors}=useLoad<Option[]>(doctorView?'':'/opciones/usuarios');
 const first=mode==='dia'?day:mode==='semana'?weekStart(day):weekStart(new Date(day.getFullYear(),day.getMonth(),1,12));
 const last=mode==='dia'?day:mode==='semana'?addDays(first,6):addDays(weekStart(new Date(day.getFullYear(),day.getMonth()+1,0,12)),6);
 const {data,error,loading}=useLoad<Row[]>('/clinica/agenda?'+new URLSearchParams({inicio:iso(first),fin:iso(last),...(doctor?{doctor}:{})}));
 const byDay=new Map<string,Row[]>();for(const c of data||[])byDay.set(c.fecha,[...(byDay.get(c.fecha)||[]),c]);
 const move=(n:number)=>setDay(d=>mode==='dia'?addDays(d,n):mode==='semana'?addDays(d,7*n):new Date(d.getFullYear(),d.getMonth()+n,1,12));
 const open=(c:Row)=>go(clinical?'historial?id='+c.id_paciente:canCreate?'citas?editar='+c.id_cita:'citas?id_paciente='+c.id_paciente);
 const today=iso(new Date());
 const label=mode==='dia'?day.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):mode==='semana'?first.toLocaleDateString('es-PE',{day:'numeric',month:'short'})+' – '+last.toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'}):day.toLocaleDateString('es-PE',{month:'long',year:'numeric'});
 const title=label.charAt(0).toUpperCase()+label.slice(1);
 const chip=(c:Row,full=false)=><button type="button" key={c.id_cita} className={'agenda-chip state-'+String(c.estado).toLowerCase().replace(/[^a-z]/g,'')} style={c.color?{borderLeftColor:c.color}:undefined} onClick={()=>open(c)} title={[c.hora,c.paciente,c.doctor,c.motivo,c.estado].filter(Boolean).join(' · ')}><strong>{String(c.hora).slice(0,5)}</strong> {c.paciente}{full&&<small>{doctorView?'':c.doctor+' · '}{c.motivo||'Consulta'} · {c.estado}</small>}</button>;
 const days:Date[]=[];for(let d=first;iso(d)<=iso(last);d=addDays(d,1))days.push(d);
 return <><Header heading="Agenda clínica" description="Citas por día, semana o mes.">{canCreate&&<button className="button primary" onClick={()=>go('citas?crear=1')}><Plus size={16}/>Nueva cita</button>}</Header>
  <section className="card">
   <div className="agenda-toolbar">
    <div className="agenda-nav"><button type="button" className="icon-btn" aria-label="Anterior" onClick={()=>move(-1)}><ChevronLeft size={18}/></button><button type="button" className="button small" onClick={()=>setDay(new Date(today+'T12:00:00'))}>Hoy</button><button type="button" className="icon-btn" aria-label="Siguiente" onClick={()=>move(1)}><ChevronRight size={18}/></button><h2>{title}</h2></div>
    <div className="agenda-filters"><div className="segmented" role="group" aria-label="Vista">{([['dia','Día'],['semana','Semana'],['mes','Mes']] as const).map(([k,t])=><button type="button" key={k} className={mode===k?'active':''} aria-pressed={mode===k} onClick={()=>setMode(k)}>{t}</button>)}</div>
     {!doctorView&&<select aria-label="Doctor" value={doctor} onChange={e=>setDoctor(e.target.value)}><option value="">Todos los doctores</option>{doctors?.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select>}</div>
   </div>
   <Notice error={error}/>
   {loading&&!data?<Loading/>:mode==='dia'?(!(byDay.get(iso(day))||[]).length?<Empty>No hay citas este día.</Empty>:<div className="agenda-day">{(byDay.get(iso(day))||[]).map(c=>chip(c,true))}</div>)
   :<div className={'agenda-grid '+mode}>{weekDays.map(w=><div key={w} className="agenda-weekday">{w}</div>)}{days.map(d=>{const key=iso(d),list=byDay.get(key)||[],outside=mode==='mes'&&d.getMonth()!==day.getMonth(),max=mode==='mes'?3:20;return <div key={key} className={'agenda-cell'+(key===today?' today':'')+(outside?' outside':'')+(list.length?'':' empty')}>
     <button type="button" className="agenda-date" onClick={()=>{setDay(new Date(key+'T12:00:00'));setMode('dia');}} aria-label={'Ver el '+d.toLocaleDateString('es-PE',{day:'numeric',month:'long'})}><span className="agenda-wd">{weekDays[(d.getDay()+6)%7]}</span>{d.getDate()}</button>
     {list.slice(0,max).map(c=>chip(c))}{list.length>max&&<button type="button" className="agenda-more" onClick={()=>{setDay(new Date(key+'T12:00:00'));setMode('dia');}}>+{list.length-max} más</button>}
    </div>;})}</div>}
   {data&&<p className="muted agenda-count">{data.length} cita{data.length===1?'':'s'} en este periodo</p>}
  </section></>;
}
