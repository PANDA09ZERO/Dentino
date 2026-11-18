import {useEffect,useState,type MouseEvent,type ReactNode} from 'react';
import {BrandMark} from './BrandMark';
import {ArrowUpRight,ArrowRight,HeartPulse,Sparkles,ShieldCheck,Phone,MessageCircle,MapPin,Clock,Mail,CalendarCheck,Stethoscope} from 'lucide-react';
import {api} from './api';
import {ContactForm} from './PublicContact';
import './public.css';
type Row=Record<string,any>;
const serviceIcons=[HeartPulse,Sparkles,ShieldCheck];
const accents=['teal','lilac','slate'] as const;
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
  <header className="pub-nav">
   <a className="pub-brand" href="#inicio" aria-label="Dental Dentino, inicio">
    <span className="pub-logo-mark"><BrandMark size={44}/></span>
    <span className="pub-brand-text"><span className="pub-brand-name"><span className="pub-teal">Dental</span> <span className="pub-lilac">Dentino</span></span><span className="pub-brand-sub">Centro odontológico</span></span>
   </a>
   <nav className="pub-links" aria-label="Secciones de la página">
    {services.length>0&&<a href="#servicios" onClick={jump('servicios')}>Servicios</a>}
    {treatments.length>0&&<a href="#tratamientos" onClick={jump('tratamientos')}>Tratamientos</a>}
    <a href="#galeria" onClick={jump('galeria')}>Galería</a>
    {promotions.length>0&&<a href="#promociones" onClick={jump('promociones')}>Promociones</a>}
    <a href="#contacto" onClick={jump('contacto')}>Contacto</a>
   </nav>
   <div className="pub-nav-actions">
    <button type="button" className="pub-login" onClick={onLogin}>Acceso al equipo<ArrowUpRight size={15}/></button>
    <a className="pub-cta-nav" href="#contacto" onClick={jump('contacto')}><CalendarCheck size={16}/>Agendar cita</a>
   </div>
  </header>
  {(error||loadError)&&<div className="notice" role="alert">{error||loadError}</div>}
  <main id="contenido" className="pub-bento">
   <section className="pub-hero" id="inicio">
    <div className="pub-hero-copy">
     <span className="pub-pill"><span className="pub-dot" aria-hidden="true"/>{name} · Clínica odontológica</span>
     <h1>{get('hero_titulo')||'Tu sonrisa en manos de expertos.'}</h1>
     {get('hero_titulo','contenido')&&<p>{get('hero_titulo','contenido')}</p>}
     <div className="pub-cta">
      <a className="pub-btn pub-btn-primary" href="#contacto" onClick={jump('contacto')}><CalendarCheck size={17}/>Solicitar una cita</a>
      {tel&&<a className="pub-btn pub-btn-ghost" href={tel}><Phone size={16}/>Llamar</a>}
      {wa&&<a className="pub-btn pub-btn-ghost" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>WhatsApp</a>}
      {!tel&&!wa&&services.length>0&&<a className="pub-btn pub-btn-ghost" href="#servicios" onClick={jump('servicios')}>Ver servicios<ArrowRight size={16}/></a>}
     </div>
    </div>
    <div className="pub-hero-art">
     <div className="pub-hero-card">
      <span className="pub-hero-bar" aria-hidden="true"/>
      <div className="pub-hero-inner">
       <div className="pub-hero-head">
        <div><span className="eyebrow">Tu clínica</span><h2>{name}</h2></div>
        {services.length>0&&<span className="pub-badge">{services.length} {services.length===1?'servicio':'servicios'}</span>}
       </div>
       <div className="pub-stats">
        {hours&&<div className="pub-stat"><b><Clock size={15} aria-hidden="true"/>Horario</b><span>{hours}</span></div>}
        {address&&<div className="pub-stat pub-stat-lilac"><b><MapPin size={15} aria-hidden="true"/>Dirección</b><span>{address}</span></div>}
       </div>
      </div>
      <div className="pub-hero-foot"><span>¿Primera visita?</span><a href="#contacto" onClick={jump('contacto')}>Pide tu cita <ArrowRight size={14}/></a></div>
     </div>
    </div>
   </section>

   <section className="pub-steps" aria-labelledby="pub-pasos"><span className="eyebrow">TU PRIMERA VISITA</span><h2 id="pub-pasos">Pide tu cita en 3 pasos</h2>
    <ol>{steps.map(([title,text],i)=><li key={title}><span className="pub-num" aria-hidden="true">{i+1}</span><span><b>{title}</b>{text}</span></li>)}</ol>
    <a className="pub-btn pub-btn-light" href="#contacto" onClick={jump('contacto')}>Empezar ahora<ArrowRight size={16}/></a>
   </section>

   {hasInfo&&<div className="pub-info-row">
    {hours&&<InfoTile icon={<Clock size={20}/>} label="Horario de atención">{hours}</InfoTile>}
    {address&&<InfoTile icon={<MapPin size={20}/>} label="Dirección" href={route} external>{address}<small>Cómo llegar ↗</small></InfoTile>}
    {phone&&<InfoTile icon={<Phone size={20}/>} label="Teléfono" href={tel}>{phone}</InfoTile>}
    {wa&&<InfoTile icon={<MessageCircle size={20}/>} label="WhatsApp" href={wa} external>Escríbenos por WhatsApp</InfoTile>}
    {email&&<InfoTile icon={<Mail size={20}/>} label="Correo" href={'mailto:'+email}>{email}</InfoTile>}
   </div>}

   {services.length>0&&<><div className="pub-head" id="servicios"><span className="pub-eyebrow-teal">QUÉ HACEMOS</span><h2>Nuestros servicios</h2></div>
    {services.map((n,i)=>{const Icon=serviceIcons[i%serviceIcons.length];return <article className={'pub-tile pub-service pub-accent-'+accents[i%accents.length]} key={n}><span className="pub-icon" aria-hidden="true"><Icon size={22}/></span><h3>{get('servicio_'+n+'_titulo')}</h3><p>{get('servicio_'+n+'_titulo','contenido')}</p></article>;})}</>}

   {treatments.length>0&&<section className="pub-tile pub-treatments" id="tratamientos"><div><span className="pub-eyebrow-lilac">TRATAMIENTOS</span><h2>Lo que podemos hacer por ti</h2><p>Pregunta por precios y disponibilidad al pedir tu cita.</p><a className="pub-btn pub-btn-primary" href="#contacto" onClick={jump('contacto')}>Consultar un tratamiento<ArrowRight size={16}/></a></div>
    <ul>{treatments.map(t=><li key={t}><Stethoscope size={14} aria-hidden="true"/>{t}</li>)}</ul></section>}

   <section className="pub-tile pub-gallery" id="galeria"><div className="pub-head"><span className="pub-eyebrow-teal">NUESTRA CLÍNICA</span><h2>Conoce nuestras instalaciones</h2><p>Un espacio pensado para tu comodidad y tranquilidad.</p></div><div className="pub-gallery-grid">{['clinica-1.jpg','clinica-2.jpg','clinica-3.jpg','clinica-4.jpg','clinica-5.jpg','clinica-6.jpg','clinica-7.jpg','clinica-8.jpg'].map((img,i)=><img key={img} src={'/images/'+img} alt={'Instalaciones de la clínica '+(i+1)} loading="lazy"/>)}</div></section>

   {promotions.length>0&&<><div className="pub-head" id="promociones"><span className="pub-eyebrow-lilac">OFERTAS</span><h2>Promociones vigentes</h2></div>
    {promotions.map((p:Row,i:number)=><article className={i===0?'pub-banner':'pub-tile pub-promo'} key={i}>{p.badge_texto&&<span className="pub-badge">{p.badge_texto}</span>}<h3>{p.titulo}</h3><p>{p.descripcion}</p>{i===0&&<a className="pub-btn pub-btn-light" href="#contacto" onClick={jump('contacto')}>Pedir cita<ArrowRight size={16}/></a>}</article>)}</>}

   <section className={hasMap||hasInfo?'pub-tile pub-form':'pub-tile pub-form pub-wide'} id="contacto"><span className="pub-eyebrow-teal">CONTACTO</span><h2>{get('contacto_titulo')||'Solicita tu cita'}</h2><p>Déjanos tus datos y te contactamos para acordar el día y la hora.</p><ContactForm interests={interests} tel={tel} wa={wa}/></section>
   {(hasMap||hasInfo)&&<section className="pub-tile pub-where"><span className="pub-eyebrow-lilac">ESTAMOS CERCA DE TI</span><h2>Ubicación</h2>{address&&<p>{address}</p>}{hours&&<p className="pub-where-hours"><Clock size={15} aria-hidden="true"/>{hours}</p>}{data?.map&&<iframe title="Ubicación de la clínica" src={data.map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>}{route&&<a className="pub-btn pub-btn-primary" href={route} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>Cómo llegar</a>}</section>}
  </main>
  <footer className="pub-footer">
   <div className="pub-footer-brand"><span className="pub-brand"><span className="pub-logo-mark"><BrandMark size={36}/></span><span className="pub-brand-name"><span className="pub-teal">Dental</span> <span className="pub-lilac">Dentino</span></span></span><span>{name}{c.ruc?' · RUC '+c.ruc:''}{address?' · '+address:''}</span></div>
   <nav aria-label="Enlaces del pie">{services.length>0&&<a href="#servicios" onClick={jump('servicios')}>Servicios</a>}<a href="#contacto" onClick={jump('contacto')}>Pedir cita</a>{tel&&<a href={tel}>{phone}</a>}{email&&<a href={'mailto:'+email}>{email}</a>}<button type="button" className="pub-link" onClick={onLogin}>Acceso al equipo</button></nav>
   <small>© {new Date().getFullYear()} {name} · Salud y bienestar para tu sonrisa</small>
  </footer>
  <div className="pub-actions" role="group" aria-label="Acciones rápidas">{tel&&<a href={tel}><Phone size={20}/><span>Llamar</span></a>}{wa&&<a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={20}/><span>WhatsApp</span></a>}{route&&<a href={route} target="_blank" rel="noopener noreferrer"><MapPin size={20}/><span>Cómo llegar</span></a>}<a href="#contacto" onClick={jump('contacto')}><CalendarCheck size={20}/><span>Pedir cita</span></a></div>
 </div>;
}
