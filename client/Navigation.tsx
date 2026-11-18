import {useEffect,useState} from 'react';
import {CalendarDays,FileText,LayoutDashboard,Package,Search,Settings,User as UserIcon,Users,Wallet} from 'lucide-react';
import {api} from './api';
import {label,type Module,type Row} from '../shared/modules';
import {Agenda} from './Agenda';
import {type User,go} from './ui';
export type Section={key:string;text:string;icon:any;tabs:[string,string][]};
// Desplaza la barra de pestañas (no la página) para que la pestaña activa sea visible en pantallas angostas.
export const revealTab=(el:HTMLElement|null)=>{const bar=el?.parentElement;if(el&&bar&&bar.scrollWidth>bar.clientWidth)bar.scrollLeft=Math.max(0,el.offsetLeft-bar.offsetLeft-24);};
// Menú agrupado por secciones (máximo 7) y filtrado según los módulos que el servidor permite a cada rol.
export function sectionsFor(user:User,modules:Module[]):Section[]{
 const admin=user.rol==='Administrador',has=(k:string)=>modules.some(m=>m.key===k);
 const tabs=(list:[string,string,boolean?][])=>list.filter(([k,,ok])=>ok??has(k)).map(([k,t])=>[k,t] as [string,string]);
 const list:Section[]=[
  {key:'inicio',text:'Inicio',icon:LayoutDashboard,tabs:[['dashboard','Vista general']]},
  {key:'agenda',text:'Agenda',icon:CalendarDays,tabs:tabs([['agenda','Calendario',true],['citas','Listado de citas']])},
  {key:'pacientes',text:user.rol.startsWith('Doctor')?'Mis pacientes':'Pacientes',icon:Users,tabs:[['pacientes','Pacientes']]},
  {key:'perfil',text:'Mi perfil',icon:UserIcon,tabs:[['perfil','Mi perfil']]}
 ];
 // Caja: Administrador y Recepcionista (que también cobra y emite comprobantes).
 if(admin||user.rol==='Recepcionista')list.push({key:'caja',text:'Caja y comprobantes',icon:Wallet,tabs:tabs([['caja','Caja',true],['comprobantes','Comprobantes']])});
 const stock=tabs([['inventario','Insumos'],['movimientos-inventario','Movimientos de almacén'],['distribuidores','Distribuidores'],['laboratorios','Laboratorios']]);
 if(stock.length)list.push({key:'inventario',text:admin?'Inventario':'Proveedores',icon:Package,tabs:stock});
 list.push({key:'reportes',text:'Reportes',icon:FileText,tabs:[['reportes','Reportes']]});
 const settings=tabs([['configuracion','Clínica',admin],['usuarios','Usuarios'],['tratamientos','Catálogo de tratamientos'],['categorias','Categorías',admin],['especialidades','Especialidades'],['promociones','Promociones'],['solicitudes','Solicitudes'],['auditoria','Auditoría'],['pin','Mi PIN de firma',admin||user.rol==='Doctor']]);
 if(settings.length)list.push({key:'ajustes',text:'Configuración',icon:Settings,tabs:settings});
 return list.filter(x=>x.tabs.length>0);
}
// Rutas que no están en el menú pero pertenecen a una sección (se conservan todas las rutas anteriores).
export const routeAlias:Record<string,string>={inicio:'dashboard',comprobante:'comprobantes','usuario-detalle':'usuarios'};
export const patientRoutes=['historial','diagnosticos','antecedentes','examenes','planes','detalles','evoluciones','arcos'];
export function tabOf(key:string,section?:Section){const k=key.startsWith('categorias-')?'categorias':routeAlias[key]||key;return section?.tabs.some(([t])=>t===k)?k:section?.tabs[0]?.[0];}
export function sectionOf(key:string,sections:Section[]){if(patientRoutes.includes(key))return sections.find(s=>s.key==='pacientes');const k=key.startsWith('categorias-')?'categorias':routeAlias[key]||key;return sections.find(s=>s.tabs.some(([t])=>t===k));}
// Búsqueda global de pacientes por nombre, apellido o DNI, siempre visible en la cabecera.
export function PatientSearch({clinical}:{clinical:boolean}){
 const [q,setQ]=useState(''),[found,setFound]=useState<{term:string;rows:Row[]}>({term:'',rows:[]}),[open,setOpen]=useState(false),[active,setActive]=useState(0),[error,setError]=useState('');
 // Solo se muestran (y se pueden elegir) resultados del texto actual: nunca de una búsqueda anterior.
 const term=q.trim(),pending=term.length>=2&&found.term!==term&&!error,results=found.term===term?found.rows:[];
 useEffect(()=>{if(term.length<2){setError('');return;}let alive=true;setError('');const timer=setTimeout(()=>{api<{data:Row[]}>('/recursos/pacientes?'+new URLSearchParams({q:term,size:'8'})).then(r=>{if(alive){setFound({term,rows:r.data});setActive(0);}}).catch(e=>{if(alive)setError(e.message);});},250);return()=>{alive=false;clearTimeout(timer);};},[term]);
 const pick=(p:Row)=>{setQ('');setFound({term:'',rows:[]});setOpen(false);go(clinical?'historial?id='+p.id_paciente:'pacientes?q='+encodeURIComponent(p.dni||[p.nombre,p.apellido].join(' ')));};
 return <div className="global-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false);}}>
  <Search size={16}/><input type="search" role="combobox" aria-expanded={open&&q.trim().length>=2} aria-controls="global-search-results" aria-label="Buscar paciente por nombre o DNI" placeholder="Buscar paciente o DNI…" value={q} onFocus={()=>setOpen(true)} onChange={e=>{setQ(e.target.value);setOpen(true);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(a+1,results.length-1));}else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0));}else if(e.key==='Enter'&&results[active]){e.preventDefault();pick(results[active]);}else if(e.key==='Escape'){setOpen(false);}}}/>
  {open&&q.trim().length>=2&&<ul id="global-search-results" role="listbox" className="search-results">{error?<li className="muted">{error}</li>:pending?<li className="muted" role="status">Buscando…</li>:!results.length?<li className="muted">Sin coincidencias</li>:results.map((p,i)=><li key={p.id_paciente} role="option" aria-selected={i===active}><button type="button" className={i===active?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(p)}><strong>{[p.nombre,p.apellido].filter(Boolean).join(' ')}</strong><small>DNI {p.dni||'—'}{p.telefono?' · '+p.telefono:''}</small></button></li>)}</ul>}
 </div>;
}
