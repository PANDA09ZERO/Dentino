import {useEffect,useState,type MouseEvent,type ReactNode} from 'react';
import {Smile,ArrowUpRight,HeartPulse,Sparkles,ShieldCheck,Phone,MessageCircle,MapPin,Clock,Mail,CalendarCheck} from 'lucide-react';
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
export function PublicPage({onLogin,error}:{onLogin:()=>void;error:string}){
 const [data,setData]=useState<Row|null>(null),[loadError,setLoadError]=useState('');
 useEffect(()=>{let active=true;api<Row>('/publico').then(r=>{if(active)setData(r);}).catch(e=>{if(active)setLoadError(e.message);});return()=>{active=false;};},[]);
 const sections:Row[]=data?.sections||[],promotions:Row[]=data?.promotions||[],c:Record<string,string>=data?.contact||{};
 const get=(key:string,field='titulo')=>sections.find(s=>s.seccion_key===key)?.[field]||'';
 // Los datos reales salen de «Configuración de la clínica»; si faltan, se usan los textos del contenido público. Lo que no exista no se muestra.
 const name=c.razon_social||'Dentino',phone=c.telefono||get('contacto_telefono'),address=c.direccion||get('contacto_direccion'),email=c.correo||get('contacto_email'),hours=c.horario||get('contacto_horario'),whatsapp=c.whatsapp||'';
 const tel=phone?'tel:'+phone.replace(/[^\d+]/g,''):'',wa=whatsapp?'https://wa.me/'+whatsapp:'',route=address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address):'';
 const services=[1,2,3].filter(n=>get('servicio_'+n+'_titulo'));
 const hasInfo=Boolean(hours||address||phone||whatsapp||email),hasMap=Boolean(data?.map);
 useEffect(()=>{document.title=name+' · Clínica odontológica';},[name]);
 return <div className="pub">
  <a className="pub-skip" href="#contenido" onClick={jump('contenido')}>Saltar al contenido</a>
  <header className="pub-nav"><a className="brand" href="#inicio" aria-label={name+', inicio'}><span className="brand-mark"><Smile size={25}/></span>Dentino<span className="brand-dot">.</span></a>
   <nav aria-label="Secciones de la página">{services.length>0&&<a href="#servicios" onClick={jump('servicios')}>Servicios</a>}{promotions.length>0&&<a href="#promociones" onClick={jump('promociones')}>Promociones</a>}<a href="#contacto" onClick={jump('contacto')}>Contacto</a><button type="button" className="button" onClick={onLogin}>Acceso al equipo<ArrowUpRight size={16}/></button></nav></header>
  {(error||loadError)&&<div className="notice" role="alert">{error||loadError}</div>}
  <main id="contenido" className="pub-bento">
   <section className="pub-tile pub-hero"><span className="eyebrow">{name.toUpperCase()}</span><h1>{get('hero_titulo')||'Tu sonrisa en manos de expertos.'}</h1>{get('hero_titulo','contenido')&&<p>{get('hero_titulo','contenido')}</p>}
    <div className="pub-cta"><a className="button dark" href="#contacto" onClick={jump('contacto')}><CalendarCheck size={17}/>Solicitar una cita</a>{tel&&<a className="button" href={tel}><Phone size={16}/>Llamar</a>}{wa&&<a className="button" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>WhatsApp</a>}</div></section>
   <section className="pub-tile pub-logo" aria-label="Logotipo"><img src="/images/logo_sin_fondo.png" alt={'Logotipo de '+name} width="220" height="220"/><span>Cuidamos lo que te hace sonreír.</span></section>
   {hasInfo&&<div className="pub-info-row">
    {hours&&<InfoTile icon={<Clock size={20}/>} label="Horario de atención">{hours}</InfoTile>}
    {address&&<InfoTile icon={<MapPin size={20}/>} label="Dirección" href={route} external>{address}<small>Cómo llegar ↗</small></InfoTile>}
    {phone&&<InfoTile icon={<Phone size={20}/>} label="Teléfono" href={tel}>{phone}</InfoTile>}
    {wa&&<InfoTile icon={<MessageCircle size={20}/>} label="WhatsApp" href={wa} external>Escríbenos por WhatsApp</InfoTile>}
    {email&&<InfoTile icon={<Mail size={20}/>} label="Correo" href={'mailto:'+email}>{email}</InfoTile>}
   </div>}
   {services.length>0&&<><div className="pub-head" id="servicios"><span className="eyebrow">QUÉ HACEMOS</span><h2>Nuestros servicios</h2></div>{services.map((n,i)=>{const Icon=serviceIcons[i%serviceIcons.length];return <article className="pub-tile pub-service" key={n}><span className="pub-icon" aria-hidden="true"><Icon size={22}/></span><h3>{get('servicio_'+n+'_titulo')}</h3><p>{get('servicio_'+n+'_titulo','contenido')}</p></article>;})}</>}
   {promotions.length>0&&<><div className="pub-head" id="promociones"><span className="eyebrow">OFERTAS</span><h2>Promociones vigentes</h2></div>{promotions.map((p:Row,i:number)=><article className="pub-tile pub-promo" key={i}>{p.badge_texto&&<span className="eyebrow">{p.badge_texto}</span>}<h3>{p.titulo}</h3><p>{p.descripcion}</p></article>)}</>}
   <div className="pub-head"><span className="eyebrow">TU PRIMERA VISITA</span><h2>Así de simple</h2></div>
   {[['Escríbenos','Déjanos tus datos en el formulario'+(tel||wa?', llámanos o escríbenos por WhatsApp.':'.')],['Coordinamos contigo','Nos pondremos en contacto para acordar el día y la hora de tu cita.'],['Te atendemos','Llegas a tu cita y empezamos a cuidar tu sonrisa.']].map(([title,text],i)=><article className="pub-tile pub-step" key={title}><span className="pub-num" aria-hidden="true">{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}
   <section className={hasMap||hasInfo?'pub-tile pub-form':'pub-tile pub-form pub-wide'} id="contacto"><span className="eyebrow">CONTACTO</span><h2>{get('contacto_titulo')||'Solicita tu cita'}</h2><p>Cuéntanos qué necesitas y te responderemos lo antes posible.</p><ContactForm/></section>
   {(hasMap||hasInfo)&&<section className="pub-tile pub-where"><span className="eyebrow">ESTAMOS CERCA DE TI</span><h2>Ubicación</h2>{address&&<p>{address}</p>}{data?.map&&<iframe title="Ubicación de la clínica" src={data.map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>}{route&&<a className="button" href={route} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>Cómo llegar</a>}</section>}
  </main>
  <footer className="pub-footer"><span>{name}{c.ruc?' · RUC '+c.ruc:''}{address?' · '+address:''}</span><span>Dentino · Salud y bienestar para tu sonrisa</span><button type="button" className="pub-link" onClick={onLogin}>Acceso al equipo</button></footer>
  <div className="pub-actions" role="group" aria-label="Acciones rápidas">{tel&&<a href={tel}><Phone size={20}/><span>Llamar</span></a>}{wa&&<a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={20}/><span>WhatsApp</span></a>}{route&&<a href={route} target="_blank" rel="noopener noreferrer"><MapPin size={20}/><span>Cómo llegar</span></a>}<a href="#contacto" onClick={jump('contacto')}><CalendarCheck size={20}/><span>Cita</span></a></div>
 </div>;
}
