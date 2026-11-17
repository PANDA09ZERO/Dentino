import {useEffect,useState,type MouseEvent,type ReactNode} from 'react';
import {Smile,ArrowUpRight,ArrowRight,HeartPulse,Sparkles,ShieldCheck,Phone,MessageCircle,MapPin,Clock,Mail,CalendarCheck,Stethoscope} from 'lucide-react';
import {api} from './api';
import {ContactForm} from './PublicContact';
import './public.css';
type Row=Record<string,any>;
const serviceIcons=[HeartPulse,Sparkles,ShieldCheck];
// Desplaza a una sección sin cambiar el hash de la dirección (el hash se usa como ruta de la aplicación).
const jump=(id:string)=>(e:MouseEvent)=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});};
function InfoTile({icon,label,href,external,children}:{icon:ReactNode;label:string;href?:string;external?:boolean;children:ReactNode}){
 const body=<><span className="pub-icon" aria-hidden="true">{icon}</span><span><b>{label}</b>{children}</span></>;
 return href?<a className="pub-tile pub-info" href={href} {...(external?{target:'_blank',rel:'noopener noreferrer'}:{})}>{body}</a>:<div className="pub-tile pub-info">{body}</div>;
}
// Página pública. Todo lo que se muestra sale de la base (Configuración de la clínica, contenido público, promociones y catálogo);
// lo que no está configurado simplemente no aparece: no se inventan datos de contacto, profesionales ni precios.
export function PublicPage({onLogin,error}:{onLogin:()=>void;error:string}){
 const [data,setData]=useState<Row|null>(null),[loadError,setLoadError]=useState('');
 useEffect(()=>{let active=true;api<Row>('/publico').then(r=>{if(active)setData(r);}).catch(e=>{if(active)setLoadError(e.message);});return()=>{active=false;};},[]);
 const sections:Row[]=data?.sections||[],promotions:Row[]=data?.promotions||[],treatments:string[]=data?.treatments||[],c:Record<string,string>=data?.contact||{};
 const get=(key:string,field='titulo')=>sections.find(s=>s.seccion_key===key)?.[field]||'';
 const name=c.razon_social||'Dentino',phone=c.telefono||get('contacto_telefono'),address=c.direccion||get('contacto_direccion'),email=c.correo||get('contacto_email'),hours=c.horario||get('contacto_horario'),whatsapp=c.whatsapp||'';
 const tel=phone?'tel:'+phone.replace(/[^\d+]/g,''):'',wa=whatsapp?'https://wa.me/'+whatsapp:'',route=address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address):'';
 const services=[1,2,3].filter(n=>get('servicio_'+n+'_titulo'));
 // Opciones de «Servicio de interés» del formulario: el catálogo real; si está vacío, los servicios destacados.
 const interests=treatments.length?treatments:services.map(n=>get('servicio_'+n+'_titulo'));
 const hasInfo=Boolean(hours||address||phone||whatsapp||email),hasMap=Boolean(data?.map);
 const steps:[string,string][]=[['Escríbenos','Completa el formulario'+(tel||wa?', llámanos o escríbenos por WhatsApp.':'; solo toma un minuto.')],['Coordinamos contigo','Te contactamos para acordar el día y la hora de tu cita.'],['Te atendemos','Llegas a tu cita y empezamos a cuidar tu sonrisa.']];
 useEffect(()=>{document.title=name+' · Clínica odontológica';},[name]);
 return <div className="pub">
  <a className="pub-skip" href="#contenido" onClick={jump('contenido')}>Saltar al contenido</a>
  <header className="pub-nav"><a className="brand" href="#inicio" aria-label={name+', inicio'}><span className="brand-mark"><Smile size={25}/></span>Dentino<span className="brand-dot">.</span></a>
   <nav aria-label="Secciones de la página">{services.length>0&&<a href="#servicios" onClick={jump('servicios')}>Servicios</a>}{treatments.length>0&&<a href="#tratamientos" onClick={jump('tratamientos')}>Tratamientos</a>}{promotions.length>0&&<a href="#promociones" onClick={jump('promociones')}>Promociones</a>}<a href="#contacto" onClick={jump('contacto')}>Contacto</a>
    <button type="button" className="button" onClick={onLogin}>Acceso al equipo<ArrowUpRight size={16}/></button><a className="button dark pub-nav-cta" href="#contacto" onClick={jump('contacto')}><CalendarCheck size={16}/>Pedir cita</a></nav></header>
  {(error||loadError)&&<div className="notice" role="alert">{error||loadError}</div>}
  <main id="contenido" className="pub-bento">
   <section className="pub-tile pub-hero"><span className="eyebrow">{name.toUpperCase()} · CLÍNICA ODONTOLÓGICA</span><h1>{get('hero_titulo')||'Tu sonrisa en manos de expertos.'}</h1>{get('hero_titulo','contenido')&&<p>{get('hero_titulo','contenido')}</p>}
    <div className="pub-cta"><a className="button dark" href="#contacto" onClick={jump('contacto')}><CalendarCheck size={17}/>Solicitar una cita</a>{tel&&<a className="button" href={tel}><Phone size={16}/>Llamar</a>}{wa&&<a className="button" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>WhatsApp</a>}{!tel&&!wa&&services.length>0&&<a className="button" href="#servicios" onClick={jump('servicios')}>Ver servicios<ArrowRight size={16}/></a>}</div></section>
   <section className="pub-tile pub-steps" aria-labelledby="pub-pasos"><span className="eyebrow">TU PRIMERA VISITA</span><h2 id="pub-pasos">Pide tu cita en 3 pasos</h2>
    <ol>{steps.map(([title,text],i)=><li key={title}><span className="pub-num" aria-hidden="true">{i+1}</span><span><b>{title}</b>{text}</span></li>)}</ol>
    <a className="button pub-light" href="#contacto" onClick={jump('contacto')}>Empezar ahora<ArrowRight size={16}/></a></section>
   {hasInfo&&<div className="pub-info-row">
    {hours&&<InfoTile icon={<Clock size={20}/>} label="Horario de atención">{hours}</InfoTile>}
    {address&&<InfoTile icon={<MapPin size={20}/>} label="Dirección" href={route} external>{address}<small>Cómo llegar ↗</small></InfoTile>}
    {phone&&<InfoTile icon={<Phone size={20}/>} label="Teléfono" href={tel}>{phone}</InfoTile>}
    {wa&&<InfoTile icon={<MessageCircle size={20}/>} label="WhatsApp" href={wa} external>Escríbenos por WhatsApp</InfoTile>}
    {email&&<InfoTile icon={<Mail size={20}/>} label="Correo" href={'mailto:'+email}>{email}</InfoTile>}
   </div>}
   {services.length>0&&<><div className="pub-head" id="servicios"><span className="eyebrow">QUÉ HACEMOS</span><h2>Nuestros servicios</h2></div>{services.map((n,i)=>{const Icon=serviceIcons[i%serviceIcons.length];return <article className="pub-tile pub-service" key={n}><span className="pub-icon" aria-hidden="true"><Icon size={22}/></span><h3>{get('servicio_'+n+'_titulo')}</h3><p>{get('servicio_'+n+'_titulo','contenido')}</p></article>;})}</>}
   {treatments.length>0&&<section className="pub-tile pub-treatments" id="tratamientos"><div><span className="eyebrow">TRATAMIENTOS</span><h2>Lo que podemos hacer por ti</h2><p>Pregunta por precios y disponibilidad al pedir tu cita.</p><a className="button" href="#contacto" onClick={jump('contacto')}>Consultar un tratamiento<ArrowRight size={16}/></a></div>
    <ul>{treatments.map(t=><li key={t}><Stethoscope size={14} aria-hidden="true"/>{t}</li>)}</ul></section>}
   {promotions.length>0&&<><div className="pub-head" id="promociones"><span className="eyebrow">OFERTAS</span><h2>Promociones vigentes</h2></div>{promotions.map((p:Row,i:number)=><article className="pub-tile pub-promo" key={i}>{p.badge_texto&&<span className="eyebrow">{p.badge_texto}</span>}<h3>{p.titulo}</h3><p>{p.descripcion}</p></article>)}</>}
   <section className={hasMap||hasInfo?'pub-tile pub-form':'pub-tile pub-form pub-wide'} id="contacto"><span className="eyebrow">CONTACTO</span><h2>{get('contacto_titulo')||'Solicita tu cita'}</h2><p>Déjanos tus datos y te contactamos para acordar el día y la hora.</p><ContactForm interests={interests} tel={tel} wa={wa}/></section>
   {(hasMap||hasInfo)&&<section className="pub-tile pub-where"><span className="eyebrow">ESTAMOS CERCA DE TI</span><h2>Ubicación</h2>{address&&<p>{address}</p>}{hours&&<p className="pub-where-hours"><Clock size={15} aria-hidden="true"/>{hours}</p>}{data?.map&&<iframe title="Ubicación de la clínica" src={data.map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>}{route&&<a className="button" href={route} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>Cómo llegar</a>}</section>}
  </main>
  <footer className="pub-footer">
   <div className="pub-footer-brand"><span className="brand"><span className="brand-mark"><Smile size={20}/></span>Dentino<span className="brand-dot">.</span></span><span>{name}{c.ruc?' · RUC '+c.ruc:''}{address?' · '+address:''}</span></div>
   <nav aria-label="Enlaces del pie">{services.length>0&&<a href="#servicios" onClick={jump('servicios')}>Servicios</a>}<a href="#contacto" onClick={jump('contacto')}>Pedir cita</a>{tel&&<a href={tel}>{phone}</a>}{email&&<a href={'mailto:'+email}>{email}</a>}<button type="button" className="pub-link" onClick={onLogin}>Acceso al equipo</button></nav>
   <small>© {new Date().getFullYear()} {name} · Salud y bienestar para tu sonrisa</small>
  </footer>
  <div className="pub-actions" role="group" aria-label="Acciones rápidas">{tel&&<a href={tel}><Phone size={20}/><span>Llamar</span></a>}{wa&&<a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={20}/><span>WhatsApp</span></a>}{route&&<a href={route} target="_blank" rel="noopener noreferrer"><MapPin size={20}/><span>Cómo llegar</span></a>}<a href="#contacto" onClick={jump('contacto')}><CalendarCheck size={20}/><span>Pedir cita</span></a></div>
 </div>;
}
