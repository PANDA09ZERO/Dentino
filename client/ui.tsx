import {useEffect,useState,useRef,type FormEvent} from 'react';
import {ClipboardList,X,AlertCircle} from 'lucide-react';
import {api} from './api';
import {Tile,TileGrid} from './Tiles';
import {label,type Row} from '../shared/modules';
export type User={nombre:string;apellido:string;rol:string;correo:string};
export type Option={id:number;label:string};
export const money=(n:unknown)=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(n||0));
export const date=(n:unknown)=>n?String(n).slice(0,10).split('-').reverse().join('/'): '—';
export const go=(to:string)=>{window.location.hash=to;};
export const title=(row:Row)=>row.nombre_categoria||row.nombre_especialidad||row.nombre_tratamiento||row.nombre_insumo||row.nombre_empresa||row.titulo||[row.nombre,row.apellido].filter(Boolean).join(' ')||row.descripcion_procedimiento||row.observaciones_generales||Object.values(row).slice(0,3).join(' · ');
export function useLoad<T=any>(url:string,deps:unknown[]=[]){const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);useEffect(()=>{if(!url){setData(null);setLoading(false);return;}let active=true;setLoading(true);setError('');api<T>(url).then(r=>{if(active)setData(r);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[url,...deps]);return{data,error,loading};}
export function Notice({error}:{error:string}){return error?<div className="notice" role="alert"><AlertCircle size={18}/>{error}</div>:null;}
export function Empty({children='Aún no hay registros. Crea el primero para comenzar.'}:{children?:React.ReactNode}){return <div className="empty"><ClipboardList size={32}/><p>{children}</p></div>;}
export function Loading(){return <div className="loading" role="status">Cargando información…</div>;}
export function clinicalLink(module:string,patient:string,params:Record<string,string>,tab='resumen'){return '#'+module+'?'+new URLSearchParams({...params,volver:'historial?id='+patient+'&tab='+tab});}
export const backToFile=/^historial\?id=\d+(&tab=[a-z]+)?$/;
export function Header({eyebrow='DENTINO / CLÍNICA',heading,description,children,compact}:{eyebrow?:string;heading:string;description:string;children?:React.ReactNode;compact?:boolean}){if(compact)return <div className="section-head"><div><h2>{heading}</h2><p className="muted">{description}</p></div><div className="header-actions">{children}</div></div>;return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{heading}</h1><p>{description}</p></div><div className="header-actions">{children}</div></header>;}
export function Badge({value}:{value:unknown}){const str=String(value??'');return <span className={'badge '+(/Activo|Sano|Atendida|Finalizado|Realizado|Confirmada/.test(str)?'good':/Cancel|Inactivo|Abandonado|Caries/.test(str)?'bad':'')}>{str||'—'}</span>;}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal();return()=>{dialog.current?.close();};},[]);return <dialog ref={dialog} onCancel={e=>{e.preventDefault();onClose();}} className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></div>{children}</dialog>;}
// Diálogo de confirmación uniforme para acciones que archivan, cancelan o eliminan.
export function ConfirmDialog({title,message,confirmText,danger,onClose,onConfirm}:{title:string;message:React.ReactNode;confirmText:string;danger?:boolean;onClose:()=>void;onConfirm:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Modal title={title} onClose={onClose}><p>{message}</p><Notice error={error}/><div className="form-footer"><button type="button" className="button" onClick={onClose} disabled={busy}>Volver</button><button type="button" className={'button '+(danger?'danger':'primary')} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onConfirm();}catch(e){setError((e as Error).message);setBusy(false);}}}>{busy?'Procesando…':confirmText}</button></div></Modal>;
}
export function SimpleTable({rows,omit=[],renderActions}:{rows:Row[];omit?:string[];renderActions?:(row:Row)=>React.ReactNode}){if(!rows.length)return <Empty/>;const [first,...rest]=Object.keys(rows[0]).filter(k=>!omit.includes(k));if(!first)return <Empty/>;return <TileGrid>{rows.map((r,i)=><Tile key={i} title={label(first)+' '+String(r[first]??'—')} fields={rest.map(k=>[label(k),String(r[k]??'—')] as [string,string])} actions={renderActions?renderActions(r):undefined}/>)}</TileGrid>;}
export function SignDialog({path,onClose,onSigned}:{path:string;onClose:()=>void;onSigned:()=>void}){
 const [pin,setPin]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api(path,'POST',{pin});onSigned();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 return <Modal title="Firmar registro" onClose={onClose}><form onSubmit={submit}><p>Al firmar, el registro queda protegido: no podrá modificarse ni eliminarse. Ingresa tu PIN personal de firma.</p><Notice error={error}/><label>PIN de firma<input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={e=>setPin(e.target.value)} minLength={4} maxLength={8} required/></label><div className="form-footer"><button type="button" className="button" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy?'Firmando…':'Firmar'}</button></div></form><p><small><a href="#pin" onClick={onClose}>¿Aún no tienes PIN? Configúralo en «Mi PIN de firma».</a></small></p></Modal>;
}
