import {lazy,useEffect,useState,Suspense} from 'react';
import {ShieldCheck,CalendarDays,ChevronRight,FileText,LayoutDashboard,LogOut,Menu,Smile,Users,Wallet} from 'lucide-react';
import {api} from './api';
import {label,type Module} from '../shared/modules';
import {Dashboard} from './Dashboard';
import {Login} from './Login';
import {revealTab,sectionsFor,tabOf,sectionOf,PatientSearch,patientRoutes} from './Navigation';
import {Resources,CategoryManager} from './Resources';
import {type User,go,title,Notice,Empty,Loading,Modal} from './ui';
// Pantallas secundarias y pesadas: se descargan solo cuando se abren.
const ClinicSettings=lazy(()=>import('./ClinicSettings').then(m=>({default:m.ClinicSettings})));
const PinSettings=lazy(()=>import('./PinSettings').then(m=>({default:m.PinSettings})));
const PublicPage=lazy(()=>import('./PublicPage').then(m=>({default:m.PublicPage})));
const ReceiptPreview=lazy(()=>import('./ReceiptPreview').then(m=>({default:m.ReceiptPreview})));
const UserDetail=lazy(()=>import('./UserDetail').then(m=>({default:m.UserDetail})));
const Agenda=lazy(()=>import('./Agenda').then(m=>({default:m.Agenda})));
const Reports=lazy(()=>import('./Reports').then(m=>({default:m.Reports})));
const Cash=lazy(()=>import('./Cash').then(m=>({default:m.Cash})));
const History=lazy(()=>import('./PatientFile').then(m=>({default:m.History})));
// Secciones exclusivas de Administrador (el servidor también las bloquea).
// La Recepcionista también cobra: entra a Caja y a Comprobantes (el servidor limita lo demás: anular, borrar, historial y correo).
const cashierRoutes=['caja','comprobante','comprobantes'];
const adminRoutes=['caja','comprobante','comprobantes','configuracion','categorias','usuarios','usuario-detalle','inventario','movimientos-inventario','tratamientos','especialidades','promociones','solicitudes','auditoria'];
function NoAccess(){return <div className="no-access"><ShieldCheck size={36}/><h1>Esta sección no está disponible para tu rol</h1><p>Si necesitas acceder, pide a un administrador que revise tus permisos.</p><a className="button primary" href="#dashboard">Volver al inicio</a></div>;}
export function App(){const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[startup,setStartup]=useState(''),[route,setRoute]=useState(location.hash.slice(1)||'inicio'),[mobile,setMobile]=useState(false);const [modules,setModules]=useState<Module[]>([]);
 useEffect(()=>{api('/auth/me').then(r=>{setUser(r.user);setReady(true);}).catch(e=>{setStartup(e.message);setReady(true);});const listener=()=>{setRoute(location.hash.slice(1)||'inicio');setMobile(false);};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
 useEffect(()=>{if(user)api<Module[]>('/modulos').then(setModules).catch(e=>setStartup(e.message));},[user]);
 if(!ready)return <Loading/>;// Abierta como app instalada (el equipo la descargó en su teléfono), sin sesión: va directo al inicio de sesión, no a la página pública.
 const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true;
 if(!user)return route==='login'||standalone?<Login onLogin={setUser}/>:<Suspense fallback={<Loading/>}><PublicPage onLogin={()=>go('login')} error={startup}/></Suspense>;
 const [key,query='']=route.split('?'),filter=new URLSearchParams(query);const mod=modules.find(m=>m.key===key);
 const cashier=user.rol==='Administrador'||user.rol==='Recepcionista';
 const denied=(user.rol!=='Administrador'&&adminRoutes.some(r=>key===r||key.startsWith('categorias-'))&&!(user.rol==='Recepcionista'&&cashierRoutes.includes(key)))||(user.rol==='Recepcionista'&&patientRoutes.includes(key));
 const sections=sectionsFor(user,modules),current=sectionOf(key,sections),activeTab=tabOf(key,current);
 const clinical=user.rol!=='Recepcionista',readOnly=user.rol==='Doctor externo';
 const quickNav:[string,string,any][]=[['dashboard','Inicio',LayoutDashboard],['pacientes','Pacientes',Users],['agenda','Agenda',CalendarDays],cashier?['caja','Caja',Wallet]:['reportes','Reportes',FileText]];
 const logout=async()=>{await api('/auth/logout','POST');await api('/auth/me');setUser(null);go('inicio');};
 const sectionLinks=(size:number)=>sections.map(s=>{const Icon=s.icon;return <a key={s.key} href={'#'+s.tabs[0][0]} className={current?.key===s.key?'active':''}><Icon size={size}/>{s.text}</a>;});
 const crumb=[current?.text,current&&current.tabs.length>1?current.tabs.find(([k])=>k===activeTab)?.[1]:undefined,key==='historial'?'Ficha clínica':!current&&mod?mod.title:undefined].filter(Boolean);
 return <div className="app-shell"><aside className={mobile?'sidebar open':'sidebar'}><a className="brand" href="#dashboard"><span className="brand-mark"><Smile size={25}/></span>Dentino<span className="brand-dot">.</span></a><nav><span className="nav-label">CLÍNICA</span>{sectionLinks(18).slice(0,3)}<span className="nav-label">GESTIÓN</span>{sectionLinks(18).slice(3)}</nav><div className="profile"><div className="avatar">{user.nombre.slice(0,1)}{user.apellido.slice(0,1)}</div><div>{user.nombre}<small>{user.rol}</small></div><button className="icon-btn" aria-label="Cerrar sesión" onClick={logout}><LogOut size={17}/></button></div></aside><main className="main"><div className="topbar"><button className="icon-btn mobile-toggle" aria-label="Abrir menú" onClick={()=>setMobile(!mobile)}><Menu/></button><span className="breadcrumb"><span className="crumb-root">Dentino</span>{crumb.map((c,i)=><span key={i} className="crumb"><ChevronRight size={13}/>{c}</span>)}</span><PatientSearch clinical={clinical}/></div><div className="page"><Notice error={startup}/>{current&&current.tabs.length>1&&<nav className="section-tabs" aria-label={current.text}>{current.tabs.map(([k,text])=><a key={k} href={'#'+k} ref={activeTab===k?revealTab:undefined} className={activeTab===k?'active':''} aria-current={activeTab===k?'page':undefined}>{text}</a>)}</nav>}<Suspense fallback={<Loading/>}>{key==='inicio'||key==='dashboard'?<Dashboard user={user}/>:key==='agenda'?<Agenda canCreate={!readOnly} clinical={clinical} doctorView={user.rol.startsWith('Doctor')}/>:denied?<NoAccess/>:key==='caja'?<Cash patient={filter.get('id_paciente')||''} plan={filter.get('id_plan')||''} admin={user.rol==='Administrador'}/>:key==='reportes'?<Reports rol={user.rol}/>:key==='comprobante'?<ReceiptPreview id={filter.get('id')||'demo'} canMail={user.rol==='Administrador'}/>:key==='categorias'||key.startsWith('categorias-')?<CategoryManager modules={modules} selected={key.startsWith('categorias-')?key:'categorias-'+(filter.get('tipo')||'pacientes')}/>:key==='usuario-detalle'?<UserDetail id={filter.get('id')||''}/>:key==='pin'?<PinSettings/>:key==='configuracion'&&user.rol==='Administrador'?<ClinicSettings/>:key==='historial'?<History key={filter.get('id')||''} id={filter.get('id')||''} tab={filter.get('tab')||'resumen'} flow={filter.get('flujo')==='1'} modules={modules} canPay={user.rol==='Administrador'} canEdit={user.rol==='Administrador'||user.rol==='Doctor'} canSchedule={!readOnly} userId={(user as any).id_usuario} role={user.rol}/>:mod?<Resources key={route} mod={mod} filter={filter} clinical={clinical} canWrite={!readOnly} canRemove={!(mod.cashier&&user.rol!=='Administrador')}/>:<Empty>Módulo no encontrado.</Empty>}</Suspense></div><footer className="app-footer">Dentino · Cuidado que deja sonrisas</footer></main>
 <nav className="bottom-nav" aria-label="Navegación principal">{quickNav.map(([k,text,Icon])=><a key={k} href={'#'+k} className={current?.tabs.some(([t])=>t===k)||(k==='pacientes'&&current?.key==='pacientes')?'active':''}><Icon size={20}/><span>{text}</span></a>)}<button type="button" className={mobile?'active':''} onClick={()=>setMobile(true)} aria-label="Abrir el menú completo"><Menu size={20}/><span>Más</span></button></nav>
 {mobile&&<Modal title="Menú" onClose={()=>setMobile(false)}><p className="muted">{user.nombre} {user.apellido} · {user.rol}</p><div className="menu-grid">{sectionLinks(20)}</div><div className="form-footer"><button type="button" className="button" onClick={logout}><LogOut size={16}/>Cerrar sesión</button></div></Modal>}
 </div>;
}
