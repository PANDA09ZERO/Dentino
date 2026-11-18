import {useEffect,useState,type MouseEvent,type ReactNode} from 'react';
import {BrandMark} from './BrandMark';
import {ArrowUpRight,HeartPulse,Sparkles,ShieldCheck,Phone,MessageCircle,MapPin,Clock,Mail,CalendarCheck,Stethoscope} from 'lucide-react';
import {api} from './api';
import {ContactForm} from './PublicContact';
import './public.css';
type Row=Record<string,any>;
const serviceIcons=[HeartPulse,Sparkles,ShieldCheck];
const gallery=['clinica-1.jpg','clinica-2.jpg','clinica-3.jpg','clinica-4.jpg','clinica-5.jpg','clinica-6.jpg','clinica-7.jpg','clinica-8.jpg'];
// Cada foto tiene una versión ligera de 640 px en /images/sm/: el navegador elige según el tamaño en pantalla.
const photo=(img:string)=>({src:'/images/sm/'+img,srcSet:'/images/sm/'+img+' 640w, /images/'+img+' 1200w'});
// Desplaza a una sección sin cambiar el hash de la dirección (el hash se usa como ruta de la aplicación).
const jump=(id:string)=>(e:MouseEvent)=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});};
function Fact({icon,label,href,external,children}:{icon:ReactNode;label:string;href?:string;external?:boolean;children:ReactNode}){
 const body=<><span className="pub-fact-icon" aria-hidden="true">{icon}</span><span><b>{label}</b>{children}</span></>;
 return href?<a className="pub-fact" href={href} {...(external?{target:'_blank',rel:'noopener noreferrer'}:{})}>{body}</a>:<div className="pub-fact">{body}</div>;
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
 const [banner,...otherPromos]=promotions;
 useEffect(()=>{document.title=name+' · Clínica odontológica';},[name]);
 return <div className="pub">
  <a className="pub-skip" href="#contenido" onClick={jump('contenido')}>Saltar al contenido</a>
  <header className="pub-nav">
   <div className="pub-wrap pub-nav-in">
    <a className="pub-brand" href="#inicio" aria-label="Dental Dentino, inicio">
     <BrandMark size={40}/>
     <span className="pub-brand-text"><span className="pub-brand-name"><span className="pub-teal">Dental</span> <span className="pub-lilac">Dentino</span></span><span className="pub-brand-sub">Centro odontológico</span></span>
    </a>
    <nav className="pub-links" aria-label="Secciones de la página">
     {services.length>0&&<a href="#servicios" onClick={jump('servicios')}>Servicios</a>}
     {treatments.length>0&&<a href="#tratamientos" onClick={jump('tratamientos')}>Tratamientos</a>}
     <a href="#galeria" onClick={jump('galeria')}>La clínica</a>
     {promotions.length>0&&<a href="#promociones" onClick={jump('promociones')}>Promociones</a>}
     <a href="#contacto" onClick={jump('contacto')}>Contacto</a>
    </nav>
    <div className="pub-nav-actions">
     <button type="button" className="pub-login" onClick={onLogin}>Acceso al equipo<ArrowUpRight size={15} aria-hidden="true"/></button>
     <a className="pub-btn pub-btn-primary pub-btn-sm" href="#contacto" onClick={jump('contacto')}>Pedir cita</a>
    </div>
   </div>
  </header>
  {(error||loadError)&&<div className="pub-wrap"><div className="notice" role="alert">{error||loadError}</div></div>}

  <main id="contenido">
   <section className="pub-wrap pub-hero" id="inicio">
    <div className="pub-hero-copy">
     <h1>{get('hero_titulo')||'Tu sonrisa en manos de expertos'}</h1>
     <p className="pub-lead">{get('hero_titulo','contenido')||'Te explicamos cada paso y acordamos contigo el plan antes de empezar. Sin prisas y sin sorpresas.'}</p>
     <div className="pub-cta">
      <a className="pub-btn pub-btn-primary" href="#contacto" onClick={jump('contacto')}><CalendarCheck size={17} aria-hidden="true"/>Solicitar una cita</a>
      {wa&&<a className="pub-btn pub-btn-ghost" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true"/>WhatsApp</a>}
      {tel&&!wa&&<a className="pub-btn pub-btn-ghost" href={tel}><Phone size={16} aria-hidden="true"/>Llamar</a>}
      {!tel&&!wa&&services.length>0&&<a className="pub-btn pub-btn-ghost" href="#servicios" onClick={jump('servicios')}>Ver servicios</a>}
     </div>
     {(hours||address||phone)&&<div className="pub-facts">
      {hours&&<Fact icon={<Clock size={16}/>} label="Horario">{hours}</Fact>}
      {address&&<Fact icon={<MapPin size={16}/>} label="Dirección" href={route} external>{address}</Fact>}
      {phone&&<Fact icon={<Phone size={16}/>} label="Teléfono" href={tel}>{phone}</Fact>}
     </div>}
    </div>
    <div className="pub-room">
     <img {...photo('clinica-4.jpg')} sizes="(max-width: 900px) 92vw, 560px" alt="Consultorio de la clínica con paneles de madera y luz cálida" fetchPriority="high"/>
     <span className="pub-slats" aria-hidden="true"/>
     <a className="pub-room-tag" href="#contacto" onClick={jump('contacto')}><b>¿Primera visita?</b><span>Pide tu cita en un minuto</span></a>
    </div>
   </section>

   {services.length>0&&<section className="pub-wrap pub-section" id="servicios" aria-labelledby="pub-servicios">
    <h2 id="pub-servicios">Lo que hacemos por tu sonrisa</h2>
    <div className="pub-services">
     {services.map((n,i)=>{const Icon=serviceIcons[i%serviceIcons.length];return <article className="pub-service" key={n}><Icon size={22} aria-hidden="true"/><h3>{get('servicio_'+n+'_titulo')}</h3><p>{get('servicio_'+n+'_titulo','contenido')}</p></article>;})}
    </div>
   </section>}

   {treatments.length>0&&<section className="pub-wrap pub-section pub-treatments" id="tratamientos" aria-labelledby="pub-tratamientos">
    <div><h2 id="pub-tratamientos">Tratamientos</h2><p>Pregunta por precios y disponibilidad al pedir tu cita.</p><a className="pub-btn pub-btn-ghost" href="#contacto" onClick={jump('contacto')}>Consultar un tratamiento</a></div>
    <ul>{treatments.map(t=><li key={t}><Stethoscope size={14} aria-hidden="true"/>{t}</li>)}</ul>
   </section>}

   <section className="pub-wrap pub-section" aria-labelledby="pub-pasos">
    <h2 id="pub-pasos">Tu cita en tres pasos</h2>
    <ol className="pub-steps">{steps.map(([title,text])=><li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ol>
   </section>

   <section className="pub-wrap pub-section" id="galeria" aria-labelledby="pub-galeria">
    <div className="pub-section-head"><h2 id="pub-galeria">Conoce la clínica</h2><p>Un espacio cálido y ordenado, pensado para que estés tranquilo durante tu atención.</p></div>
    <div className="pub-gallery">{gallery.map((img,i)=><img key={img} {...photo(img)} sizes={i===0||i===gallery.length-1?'(max-width: 760px) 78vw, 600px':'(max-width: 760px) 78vw, 300px'} alt={'Instalaciones de la clínica, foto '+(i+1)} loading="lazy"/>)}</div>
   </section>

   {banner?<section className="pub-wrap pub-section" id="promociones" aria-labelledby="pub-promo">
    <div className="pub-band">{banner.badge_texto&&<span className="pub-badge">{banner.badge_texto}</span>}<h2 id="pub-promo">{banner.titulo}</h2>{banner.descripcion&&<p>{banner.descripcion}</p>}<a className="pub-btn pub-btn-light" href="#contacto" onClick={jump('contacto')}>Pedir cita</a></div>
    {otherPromos.length>0&&<div className="pub-promos">{otherPromos.map((p:Row,i:number)=><article className="pub-promo" key={i}>{p.badge_texto&&<span className="pub-badge pub-badge-soft">{p.badge_texto}</span>}<h3>{p.titulo}</h3><p>{p.descripcion}</p></article>)}</div>}
   </section>:<section className="pub-wrap pub-section">
    <div className="pub-band"><h2>¿Hace tiempo que no vas al dentista? Empecemos con una revisión.</h2><a className="pub-btn pub-btn-light" href="#contacto" onClick={jump('contacto')}>Pedir cita</a></div>
   </section>}

   <section className={'pub-wrap pub-section pub-contact'+(hasMap||hasInfo?'':' pub-contact-solo')} id="contacto" aria-labelledby="pub-contacto">
    <div className="pub-form">
     {/* El título configurado (p. ej. «Contacto y ubicación») solo se usa si hay ubicación que mostrar. */}
     <h2 id="pub-contacto">{(address||hasMap)&&get('contacto_titulo')||'Solicita tu cita'}</h2>
     <p>Déjanos tus datos y te contactamos para acordar el día y la hora.</p>
     <ContactForm interests={interests} tel={tel} wa={wa}/>
    </div>
    {(hasMap||hasInfo)&&<aside className="pub-where" aria-label="Datos de contacto">
     {hours&&<Fact icon={<Clock size={16}/>} label="Horario de atención">{hours}</Fact>}
     {address&&<Fact icon={<MapPin size={16}/>} label="Dirección" href={route} external>{address}<small>Cómo llegar</small></Fact>}
     {phone&&<Fact icon={<Phone size={16}/>} label="Teléfono" href={tel}>{phone}</Fact>}
     {wa&&<Fact icon={<MessageCircle size={16}/>} label="WhatsApp" href={wa} external>Escríbenos por WhatsApp</Fact>}
     {email&&<Fact icon={<Mail size={16}/>} label="Correo" href={'mailto:'+email}>{email}</Fact>}
     {data?.map&&<iframe title="Ubicación de la clínica" src={data.map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>}
    </aside>}
   </section>
  </main>

  <footer className="pub-footer">
   <div className="pub-wrap pub-footer-in">
    <div className="pub-footer-brand"><BrandMark size={32}/><span><b>{name}</b>{c.ruc?'RUC '+c.ruc:'Centro odontológico'}{address?<><br/>{address}</>:null}</span></div>
    <nav aria-label="Enlaces del pie">{services.length>0&&<a href="#servicios" onClick={jump('servicios')}>Servicios</a>}<a href="#contacto" onClick={jump('contacto')}>Pedir cita</a>{tel&&<a href={tel}>{phone}</a>}{email&&<a href={'mailto:'+email}>{email}</a>}<button type="button" className="pub-link" onClick={onLogin}>Acceso al equipo</button></nav>
    <small>© {new Date().getFullYear()} {name}</small>
   </div>
  </footer>
  <div className="pub-actions" role="group" aria-label="Acciones rápidas">{tel&&<a href={tel}><Phone size={20} aria-hidden="true"/><span>Llamar</span></a>}{wa&&<a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true"/><span>WhatsApp</span></a>}{route&&<a href={route} target="_blank" rel="noopener noreferrer"><MapPin size={20} aria-hidden="true"/><span>Cómo llegar</span></a>}<a href="#contacto" onClick={jump('contacto')}><CalendarCheck size={20} aria-hidden="true"/><span>Pedir cita</span></a></div>
 </div>;
}
