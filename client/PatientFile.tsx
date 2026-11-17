import {lazy,useEffect,useState,type FormEvent} from 'react';
import {CalendarDays,Plus,Wallet,X,Printer,Check,AlertCircle} from 'lucide-react';
import {api,asset} from './api';
import {Tile,TileGrid} from './Tiles';
import {label,type Module,type Field,type Row} from '../shared/modules';
import {revealTab} from './Navigation';
import {OdontogramVersions,OdontogramUpdate} from './Odontogram';
import {Resources} from './Resources';
import {money,date,go,title,useLoad,Notice,Empty,Loading,clinicalLink,Header,Badge,Modal,SignDialog} from './ui';
const PatientPayments=lazy(()=>import('./PatientPayments').then(m=>({default:m.PatientPayments})));
// Avisos clínicos importantes (alergias, medicación, enfermedades) a partir de los antecedentes; ignora respuestas negativas.
export const negative=/^(no\b|no aplica|ningun[oa]?s?\b|ninguno|sin\b|niega|n\/a|-+|0)$|^(no|sin|ningun[oa]?|niega)\b/i;
export function clinicalWarnings(a?:Row){
 if(!a)return [] as string[];
 const has=(v:unknown)=>v!==null&&v!==undefined&&String(v).trim()!==''&&!negative.test(String(v).trim());
 const yes=(v:unknown)=>v===1||v==='1'||/^s[ií]$/i.test(String(v??'').trim());
 const list:string[]=[];
 const allergy=[a.alergias,a.alergico_cuales].filter(has).join(' · ');
 if(allergy)list.push('Alergias: '+allergy);else if(yes(a.alergico_medicamentos_comida))list.push('Alérgico a medicamentos o comida');
 const meds=[a.medicacion_actual,a.medicacion_cuales].filter(has).join(' · ');
 if(meds)list.push('Medicación: '+meds);else if(yes(a.toma_medicacion_actualmente))list.push('Toma medicación actualmente');
 if(yes(a.diabetes))list.push('Diabetes');
 if(yes(a.hipertension))list.push('Hipertensión');
 if(yes(a.embarazada))list.push('Embarazada');
 if(has(a.otras_enfermedades))list.push('Otras enfermedades: '+a.otras_enfermedades);
 return list;
}
// Pasos de la atención guiada: cita atendida → evolución → pago → comprobante (se abre desde «Atender» en el inicio).
export function FlowSteps({canPay,evolved,paid,active,show,exit}:{canPay:boolean;evolved:boolean;paid:boolean;active:string;show:(k:string)=>void;exit:()=>void}){
 const steps:[string,boolean,string|null,string][]=[['Cita atendida',true,null,''],['Registrar evolución',evolved,'planes','En «Planes», pulsa «Registrar evolución» en el tratamiento realizado.'],...(canPay?[['Registrar pago',paid,'pagos','Elige el servicio y registra el monto recibido.'] as [string,boolean,string,string],['Emitir comprobante',false,'pagos','Tras el pago, elige «Emitir boleta» o «Emitir factura».'] as [string,boolean,string,string]]:[])];
 const current=steps.findIndex(([,done])=>!done);
 return <section className="flow-steps" aria-label="Atención guiada"><ol>{steps.map(([text,done,tab],i)=><li key={text} className={done?'done':i===current?'current':''}>{tab&&!done?<button type="button" onClick={()=>show(tab)} aria-current={tab===active&&i===current?'step':undefined}><span>{i+1}</span>{text}</button>:<span className="flow-step"><span>{done?<Check size={12}/>:i+1}</span>{text}</span>}</li>)}</ol>
  <p className="muted">{current>=0?steps[current][3]:'Atención completa.'}{!canPay&&current<0?' El cobro lo registra Administración.':''}</p><button type="button" className="button small" onClick={exit}>Salir de la atención guiada</button></section>;
}
// Ficha del paciente: centro de trabajo clínico organizado en pestañas. Al imprimir se incluyen todas las secciones de la historia.
export const fileTabs:[string,string][]=[['resumen','Resumen'],['antecedentes','Antecedentes'],['diagnosticos','Odontograma y diagnósticos'],['planes','Planes'],['evoluciones','Evoluciones'],['examenes','Exámenes'],['citas','Citas'],['pagos','Pagos']];
export function History({id,tab,flow=false,modules,canPay,canEdit,canSchedule,userId,role}:{id:string;tab:string;flow?:boolean;modules:Module[];canPay:boolean;canEdit:boolean;canSchedule:boolean;userId:number;role:string}){
 const [evolved,setEvolved]=useState(false),[paid,setPaid]=useState(false);
 const [reload,setReload]=useState(0),[updating,setUpdating]=useState<Row|null>(null),[signingDiagnosis,setSigningDiagnosis]=useState<Row|null>(null);
 const {data,error,loading}=useLoad('/clinica/pacientes/'+id+'/historial',[reload]);
 const citas=modules.find(m=>m.key==='citas');
 const tabs=fileTabs.filter(([k])=>(k!=='pagos'||canPay)&&(k!=='citas'||citas));
 const active=tabs.some(([k])=>k===tab)?tab:'resumen';
 const panel=(k:string)=>'tab-panel'+(active===k?'':' print-only');
 const show=(k:string)=>go('historial?'+new URLSearchParams({id,tab:k,...(flow?{flujo:'1'}:{})}));
 if(loading&&!data)return <Loading/>;
 if(!data)return <><Header heading="Ficha clínica" description="No se pudo abrir la ficha del paciente."/><Notice error={error}/></>;
 const p=data.paciente,diagnoses:Row[]=data.diagnosticos,plans:Row[]=data.planes,history:Row|undefined=data.antecedentes[0];
 const net=(x:Row)=>Math.max(0,Number(x.costo_total)-Number(x.descuento_aplicado));
 const openPlans=plans.filter(x=>!/Finalizado|Abandonado/.test(String(x.estado_plan)));
 const pending=plans.filter(x=>x.estado_plan!=='Abandonado').reduce((s,x)=>s+Math.max(0,net(x)-Number(x.monto_pagado)),0);
 const lastEvolution:Row|undefined=data.evoluciones[0];
 const nextVisit=data.evoluciones.map((e:Row)=>e.proxima_cita_sugerida).filter(Boolean).sort().reverse()[0];
 const warnings=clinicalWarnings(history);
 const exams:Row[]=diagnoses.flatMap(d=>d.examenes.map((x:Row)=>({...x,diagnostico:d})));
 const count:Record<string,number>={antecedentes:data.antecedentes.length,diagnosticos:diagnoses.length,planes:plans.length,evoluciones:data.evoluciones.length,examenes:exams.length};
 return <>
  <Header eyebrow="FICHA CLÍNICA" heading={title(p)} description={['DNI '+(p.dni||'—'),p.telefono,p.edad?p.edad+' años':''].filter(Boolean).join(' · ')}>
   {canSchedule&&<a className="button" href={clinicalLink('citas',id,{crear:'1',id_paciente:id},'citas')}><CalendarDays size={16}/>Nueva cita</a>}
   <button className="button" onClick={()=>window.print()}><Printer size={16}/>Imprimir historia</button>
  </Header>
  <Notice error={error}/>
  {warnings.length>0&&<div className="notice" role="note"><AlertCircle size={18}/>{warnings.join(' · ')}</div>}
  {flow&&<FlowSteps canPay={canPay} evolved={evolved} paid={paid} active={active} show={show} exit={()=>go('historial?'+new URLSearchParams({id,tab:active}))}/>}
  <nav className="section-tabs patient-tabs" aria-label="Secciones de la ficha">{tabs.map(([k,text])=><button type="button" key={k} ref={active===k?revealTab:undefined} className={active===k?'active':''} aria-current={active===k?'page':undefined} onClick={()=>show(k)}>{text}{count[k]?<span className="tab-count">{count[k]}</span>:null}</button>)}</nav>

  <div className={panel('resumen')}><div className="history-grid">
   <section className="card"><div className="section-head"><h2>Datos del paciente</h2>{canSchedule&&<a className="button small" href={clinicalLink('pacientes',id,{editar:id},'resumen')}>Editar datos</a>}</div>
    <dl className="clinical-facts">{[['DNI',p.dni],['Teléfono',p.telefono],['Correo',p.correo],['Dirección',p.direccion],['Fecha de nacimiento',p.fecha_nacimiento?date(p.fecha_nacimiento):''],['Edad',p.edad]].filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></section>
   <section className="card"><h2>Situación actual</h2>
    <div className="summary-tiles">
     <button type="button" onClick={()=>show('planes')}><small>Planes activos</small><strong>{openPlans.length}</strong></button>
     <button type="button" onClick={()=>show(canPay?'pagos':'planes')}><small>Saldo pendiente</small><strong>{money(pending)}</strong></button>
     <button type="button" onClick={()=>show('diagnosticos')}><small>Diagnósticos</small><strong>{diagnoses.length}</strong></button>
     <button type="button" onClick={()=>show('evoluciones')}><small>Última evolución</small><strong>{lastEvolution?date(lastEvolution.fecha_evolucion):'—'}</strong></button>
    </div>
    {nextVisit&&<p className="muted">Próxima cita sugerida: <strong>{date(nextVisit)}</strong></p>}
    <div className="header-actions">{canEdit&&<a className="button primary" href={clinicalLink('diagnosticos',id,{crear:'1',id_paciente:id},'diagnosticos')}><Plus size={16}/>Nuevo diagnóstico</a>}{canEdit&&plans.length>0&&<button type="button" className="button" onClick={()=>show('planes')}>Registrar evolución</button>}{canPay&&<button type="button" className="button" onClick={()=>show('pagos')}><Wallet size={16}/>Registrar pago</button>}</div>
   </section>
  </div></div>

  <div className={panel('antecedentes')}><section className="card"><div className="section-head"><h2 id="clinical-antecedentes">Antecedentes médicos</h2>{canEdit&&<a className="button primary" href={clinicalLink('antecedentes',id,history?{editar:String(history.id_antecedente)}:{crear:'1',id_paciente:id},'antecedentes')}>{history?'Editar antecedentes':'Registrar antecedentes'}</a>}</div>{data.antecedentes.length?data.antecedentes.map((a:Row)=><dl className="clinical-facts" key={a.id_antecedente}>{Object.entries(a).filter(([k,v])=>!k.startsWith('id_')&&v!==null&&v!==''&&v!=='No'&&v!==0).map(([k,v])=><div key={k}><dt>{label(k)}</dt><dd>{String(v)}</dd></div>)}</dl>):<Empty>No hay antecedentes registrados.</Empty>}</section></div>

  <div className={panel('diagnosticos')}>
   <section className="card"><div className="section-head"><h2 id="clinical-odontogramas">Odontograma y diagnósticos</h2>{canEdit&&<a className="button primary" href={clinicalLink('diagnosticos',id,{crear:'1',id_paciente:id},'diagnosticos')}><Plus size={16}/>Nuevo diagnóstico</a>}</div>{!diagnoses.length&&<Empty>No hay diagnósticos registrados para este paciente.</Empty>}</section>
   {diagnoses.map((d:Row)=><section className="card" key={d.id_diagnostico}><div className="section-head"><div><span className="eyebrow">DIAGNÓSTICO · {date(d.fecha_diagnostico)} · {d.doctor}</span><h2>{d.observaciones_generales}</h2></div>{d.firmado?<span className="badge good" title={'Firmado el '+d.fecha_firma}>Firmado · {d.firmante}</span>:null}</div>
    <div className="header-actions">{canEdit&&!d.firmado&&<a className="button" href={clinicalLink('diagnosticos',id,{editar:String(d.id_diagnostico)},'diagnosticos')}>Editar</a>}{canEdit&&<button type="button" className="button" onClick={()=>setUpdating(d)}>Nueva versión del odontograma</button>}{d.puede_firmar?<button type="button" className="button" onClick={()=>setSigningDiagnosis(d)}>Firmar</button>:null}</div>
    <OdontogramVersions diagnosis={d}/></section>)}
  </div>

  <div className={panel('planes')}><PlansSection data={data} patient={id} canPay={canPay} canEdit={canEdit} userId={userId} role={role} onChanged={()=>setReload(r=>r+1)} onPay={()=>show('pagos')} onEvolution={()=>{setEvolved(true);if(flow&&canPay)show('pagos');}}/></div>

  <div className={panel('evoluciones')}><EvolutionsTimeline data={data}/></div>

  <div className={panel('examenes')}><section className="card"><div className="section-head"><h2>Exámenes auxiliares</h2>{canEdit&&diagnoses.length>0&&<a className="button primary" href={clinicalLink('examenes',id,{crear:'1',id_diagnostico:String(diagnoses[0].id_diagnostico)},'examenes')}><Plus size={16}/>Añadir examen</a>}</div>
   {!diagnoses.length?<Empty>Registra un diagnóstico para poder asociar exámenes.</Empty>:!exams.length?<Empty>No hay exámenes registrados.</Empty>:<TileGrid>{exams.map((x:Row)=>{const when=Object.entries(x).find(([k,v])=>k.startsWith('fecha')&&v)?.[1];return <Tile key={x.id_examen} title={x.tipo_examen||'Examen #'+x.id_examen} subtitle={when?date(when):undefined} fields={[['Diagnóstico',date(x.diagnostico.fecha_diagnostico)],['Notas',x.notas]]} actions={<div className="row-actions">{x.ruta_archivo&&<a href={asset(x.ruta_archivo)} target="_blank" rel="noreferrer">Abrir archivo</a>}{canEdit&&<a href={clinicalLink('examenes',id,{editar:String(x.id_examen)},'examenes')}>Editar</a>}</div>}/>;})}</TileGrid>}
  </section></div>

  {active==='citas'&&citas&&<div className="tab-panel"><Resources key={'citas-'+id} mod={citas} filter={new URLSearchParams({id_paciente:id})} canWrite={canSchedule} embedded/></div>}
  {active==='pagos'&&canPay&&<div className="tab-panel"><PatientPayments initialPatient={id} embedded onPaid={()=>{setPaid(true);setReload(r=>r+1);}}/></div>}

  {updating&&<OdontogramUpdate diagnosis={updating} onClose={()=>setUpdating(null)} onSaved={()=>{setUpdating(null);setReload(r=>r+1);}}/>}
  {signingDiagnosis&&<SignDialog path={'/firma/diagnosticos/'+signingDiagnosis.id_diagnostico} onClose={()=>setSigningDiagnosis(null)} onSigned={()=>{setSigningDiagnosis(null);setReload(r=>r+1);}}/>}
 </>;
}
export const treatmentDone=(state:unknown)=>/Realizado|Finalizado|Completado/i.test(String(state??''));
export const toothOk=(value:string)=>{if(!value)return true;const n=Number(value);return Number.isInteger(n)&&[1,2,3,4,5,6,7,8].includes(Math.floor(n/10))&&n%10>=1&&n%10<=(n<50?8:5);};
// Planes de tratamiento del paciente: cada plan con sus tratamientos y las evoluciones de cada uno.
export function PlansSection({data,patient,canPay,canEdit,userId,role,onChanged,onPay,onEvolution}:{data:Row;patient:string;canPay:boolean;canEdit:boolean;userId:number;role:string;onChanged:()=>void;onPay?:()=>void;onEvolution?:()=>void}){
 const [wizard,setWizard]=useState<number|null>(null),[evolving,setEvolving]=useState<Row|null>(null);
 const diagnoses:Row[]=data.diagnosticos,plans:Row[]=data.planes,evolutions:Row[]=data.evoluciones;
 return <section className="card"><div className="section-head"><h2 id="clinical-planes">Planes de tratamiento</h2>{canEdit&&diagnoses.length>0&&<button type="button" className="button primary" onClick={()=>setWizard(diagnoses[0].id_diagnostico)}><Plus size={16}/>Nuevo plan</button>}</div>
  {!diagnoses.length&&<p>Registra un diagnóstico para poder crear un plan de tratamiento.</p>}
  {diagnoses.length>0&&!plans.length&&<Empty>Este paciente aún no tiene planes. Crea el primero con «Nuevo plan»: eliges los tratamientos y sus piezas en un solo paso.</Empty>}
  <div className="plan-list">{plans.map(p=>{
   const dx=diagnoses.find(d=>d.id_diagnostico===p.id_diagnostico),net=Math.max(0,Number(p.costo_total)-Number(p.descuento_aplicado)),done=p.detalles.filter((d:Row)=>treatmentDone(d.estado_tratamiento)).length;
   return <article className="plan-card" key={p.id_plan}>
    <div className="plan-head"><div><h3>Plan #{p.id_plan}</h3><small>{dx?'Diagnóstico del '+date(dx.fecha_diagnostico):'Diagnóstico #'+p.id_diagnostico}</small></div><Badge value={p.estado_plan}/></div>
    <div className="plan-figures"><div><small>Total a pagar</small><strong>{money(net)}</strong></div><div><small>Pagado</small><strong>{money(p.monto_pagado)}</strong></div><div><small>Pendiente</small><strong>{money(Math.max(0,net-Number(p.monto_pagado)))}</strong></div>{Number(p.descuento_aplicado)>0&&<div><small>Descuento</small><strong>{money(p.descuento_aplicado)}</strong></div>}</div>
    {p.detalles.length>0&&<small>{done} de {p.detalles.length} tratamientos realizados</small>}
    {!p.detalles.length?<div className="notice-soft">Este plan aún no tiene tratamientos. Añade el primero para calcular el presupuesto.</div>:<ul className="plan-treatments">{p.detalles.map((d:Row)=>{const list=evolutions.filter(e=>e.id_detalle_plan===d.id_detalle_plan);return <li key={d.id_detalle_plan}>
     <div className="plan-treatment-head"><span><strong>{d.nombre_tratamiento}</strong> · Pieza {d.diente||'—'} · {money(d.costo_unitario)}</span><Badge value={d.estado_tratamiento}/></div>
     {list.length?<ol className="evolution-line">{list.map(e=><li key={e.id_evolucion}><small>{date(e.fecha_evolucion)}</small> {e.descripcion_procedimiento}{e.proxima_cita_sugerida?<small> · Próxima cita sugerida: {date(e.proxima_cita_sugerida)}</small>:null}</li>)}</ol>:<small>Sin evoluciones registradas.</small>}
     {canEdit&&<button type="button" className="button small" onClick={()=>setEvolving({...d,id_plan:p.id_plan,id_doctor:dx?.id_doctor})}>Registrar evolución</button>}
    </li>;})}</ul>}
    <div className="header-actions">{canEdit&&<a className="button" href={clinicalLink('planes',patient,{editar:String(p.id_plan)},'planes')}>Editar plan</a>}{canEdit&&<a className="button" href={clinicalLink('detalles',patient,{crear:'1',id_plan:String(p.id_plan)},'planes')}>Añadir tratamiento</a>}{canPay&&(onPay?<button type="button" className="button primary" onClick={onPay}><Wallet size={16}/>Registrar pago / ver saldo</button>:<a className="button primary" href={'#caja?'+new URLSearchParams({id_paciente:patient,id_plan:String(p.id_plan)})}><Wallet size={16}/>Registrar pago / ver saldo</a>)}</div>
   </article>;})}</div>
  {wizard!==null&&<PlanWizard diagnoses={diagnoses} initial={wizard} onClose={()=>setWizard(null)} onSaved={()=>{setWizard(null);onChanged();}}/>}
  {evolving&&<EvolutionDialog detail={evolving} doctorId={role==='Doctor'?userId:Number(evolving.id_doctor||userId)} onClose={()=>setEvolving(null)} onSaved={()=>{setEvolving(null);onChanged();onEvolution?.();}}/>}
 </section>;
}
// Cronología de todas las evoluciones del paciente, con el plan y el tratamiento al que pertenece cada una.
export function EvolutionsTimeline({data}:{data:Row}){
 const details=new Map<number,Row>();for(const p of data.planes)for(const d of p.detalles)details.set(d.id_detalle_plan,{...d,id_plan:p.id_plan});
 return <section className="card"><h2 id="clinical-evoluciones">Evoluciones</h2>{!data.evoluciones.length?<Empty>Aún no hay evoluciones. Se registran desde cada tratamiento, en «Planes de tratamiento».</Empty>:<ol className="timeline">{data.evoluciones.map((e:Row)=>{const d=details.get(e.id_detalle_plan);return <li key={e.id_evolucion}><span className="timeline-dot"/><div><small>{date(e.fecha_evolucion)}{d?' · Plan #'+d.id_plan+' · '+d.nombre_tratamiento+' · Pieza '+(d.diente||'—'):''}</small><p>{e.descripcion_procedimiento}</p>{e.proxima_cita_sugerida&&<small>Próxima cita sugerida: {date(e.proxima_cita_sugerida)}</small>}</div></li>;})}</ol>}</section>;
}
// Crea un plan con varios tratamientos de una vez.
export function PlanWizard({diagnoses,initial,onClose,onSaved}:{diagnoses:Row[];initial:number;onClose:()=>void;onSaved:()=>void}){
 const [catalog,setCatalog]=useState<Row[]>([]),[states,setStates]=useState<string[]>(['Propuesto']),[diagnosis,setDiagnosis]=useState(initial),[state,setState]=useState('Propuesto'),[discount,setDiscount]=useState('0'),[lines,setLines]=useState<Row[]>([{id:'',tooth:'',cost:''}]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{api<Row[]>('/clinica/catalogo').then(setCatalog).catch(e=>setError(e.message));api<{fields:Field[]}>('/recursos/planes/meta').then(m=>{const options=m.fields.find(f=>f.name==='estado_plan')?.options;if(options?.length)setStates(options);}).catch(()=>{});},[]);
 const setLine=(index:number,patch:Row)=>setLines(list=>list.map((l,i)=>i===index?{...l,...patch}:l));
 const choose=(index:number,id:string)=>{const item=catalog.find(c=>String(c.id)===id);setLine(index,{id,cost:item?String(item.precio??''):''});};
 const total=lines.reduce((sum,l)=>sum+(Number(l.cost)||0),0),discountValue=Number(discount)||0,net=Math.max(0,total-discountValue);
 const valid=lines.length>0&&lines.every(l=>l.id&&l.cost!==''&&Number(l.cost)>=0&&toothOk(l.tooth))&&discountValue>=0&&discountValue<=total;
 async function submit(e:FormEvent){e.preventDefault();if(busy||!valid)return;setBusy(true);setError('');try{await api('/clinica/planes/completo','POST',{id_diagnostico:diagnosis,estado_plan:state,descuento_aplicado:discountValue,tratamientos:lines.map(l=>({id_tratamiento:Number(l.id),diente:l.tooth?Number(l.tooth):null,costo_unitario:Number(l.cost)}))});onSaved();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 return <Modal title="Nuevo plan de tratamiento" onClose={onClose}><form onSubmit={submit}>
  <Notice error={error}/>
  <div className="form-grid">
   {diagnoses.length>1&&<label className="full">Diagnóstico<select value={diagnosis} onChange={e=>setDiagnosis(Number(e.target.value))}>{diagnoses.map(d=><option key={d.id_diagnostico} value={d.id_diagnostico}>{date(d.fecha_diagnostico)} · {String(d.observaciones_generales||'').slice(0,60)}</option>)}</select></label>}
   <label>Estado del plan<select value={state} onChange={e=>setState(e.target.value)}>{states.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <label>Descuento (S/)<input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
  </div>
  <h4>Tratamientos</h4>
  <div className="plan-lines">{lines.map((l,i)=><div className="plan-line" key={i}>
   <label>Tratamiento<select value={l.id} onChange={e=>choose(i,e.target.value)} required><option value="">Elige un tratamiento…</option>{catalog.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.precio!==null&&c.precio!==undefined?' · '+money(c.precio):''}</option>)}</select></label>
   <label>Pieza<input inputMode="numeric" maxLength={2} placeholder="11" value={l.tooth} onChange={e=>setLine(i,{tooth:e.target.value.replace(/\D/g,'')})} aria-invalid={!toothOk(l.tooth)}/></label>
   <label>Costo (S/)<input type="number" min="0" step="0.01" value={l.cost} onChange={e=>setLine(i,{cost:e.target.value})} required/></label>
   {lines.length>1&&<button type="button" className="icon-btn" aria-label="Quitar tratamiento" onClick={()=>setLines(list=>list.filter((_,k)=>k!==i))}><X size={18}/></button>}
  </div>)}</div>
  <button type="button" className="button small" onClick={()=>setLines(list=>[...list,{id:'',tooth:'',cost:''}])}><Plus size={14}/>Añadir otro tratamiento</button>
  <div className="plan-total"><span>Total <strong>{money(total)}</strong></span>{discountValue>0&&<span>Descuento <strong>−{money(discountValue)}</strong></span>}<span>A pagar <strong>{money(net)}</strong></span></div>
  {discountValue>total&&<small>El descuento no puede ser mayor que el total.</small>}
  <div className="form-footer"><button type="button" className="button" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||!valid}>{busy?'Guardando…':'Crear plan'}</button></div>
 </form></Modal>;
}
// Registra una evolución desde el propio tratamiento y, si se desea, actualiza su estado.
export function EvolutionDialog({detail,doctorId,onClose,onSaved}:{detail:Row;doctorId:number;onClose:()=>void;onSaved:()=>void}){
 const [text,setText]=useState(''),[next,setNext]=useState(''),[status,setStatus]=useState(String(detail.estado_tratamiento||'')),[states,setStates]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{api<{fields:Field[]}>('/recursos/detalles/meta').then(m=>{const options=m.fields.find(f=>f.name==='estado_tratamiento')?.options;if(options?.length)setStates(options);}).catch(()=>{});},[]);
 async function submit(e:FormEvent){e.preventDefault();if(busy||saved)return;if(text.trim().length<3){setError('Describe el procedimiento realizado.');return;}setBusy(true);setError('');
  try{await api('/recursos/evoluciones','POST',{id_detalle_plan:detail.id_detalle_plan,id_doctor:doctorId,descripcion_procedimiento:text.trim(),proxima_cita_sugerida:next||null});setSaved(true);
   if(status&&status!==detail.estado_tratamiento)await api('/recursos/detalles/'+detail.id_detalle_plan,'PUT',{estado_tratamiento:status});onSaved();}
  catch(err){setError((saved?'La evolución se guardó, pero no se pudo cambiar el estado: ':'')+(err as Error).message);}finally{setBusy(false);}}
 return <Modal title="Registrar evolución" onClose={saved?onSaved:onClose}><form onSubmit={submit}>
  <p className="muted">{detail.nombre_tratamiento} · Pieza {detail.diente||'—'} · Plan #{detail.id_plan}</p><Notice error={error}/>
  <div className="form-grid">
   <label className="full">Procedimiento realizado<span className="required"> *</span><textarea value={text} onChange={e=>setText(e.target.value)} rows={4} maxLength={1000} required placeholder="Describe lo que se hizo en esta sesión"/></label>
   {states.length>0&&<label>Estado del tratamiento<select value={status} onChange={e=>setStatus(e.target.value)}>{states.map(s=><option key={s} value={s}>{s}</option>)}</select></label>}
   <label>Próxima cita sugerida<input type="date" value={next} onChange={e=>setNext(e.target.value)}/></label>
  </div>
  <div className="form-footer"><button type="button" className="button" onClick={saved?onSaved:onClose}>{saved?'Cerrar':'Cancelar'}</button><button className="button primary" disabled={busy||saved}>{busy?'Guardando…':'Guardar evolución'}</button></div>
 </form></Modal>;
}
