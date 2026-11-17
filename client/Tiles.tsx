import type {ReactNode} from 'react';
// Tarjetas estilo Bento que reemplazan a las tablas de datos: una tarjeta por registro, con sus datos en pares etiqueta/valor.
export type TileField=[string,ReactNode];
export function TileGrid({children}:{children:ReactNode}){return <div className="tile-grid">{children}</div>;}
export function Tile({title,subtitle,badge,amount,fields,actions,dim}:{title:ReactNode;subtitle?:ReactNode;badge?:ReactNode;amount?:ReactNode;fields:TileField[];actions?:ReactNode;dim?:boolean}){
 return <article className={dim?'tile dim':'tile'}>
  <header className="tile-head"><div><h3 className="tile-title">{title}</h3>{subtitle?<small className="tile-sub">{subtitle}</small>:null}</div>{badge}</header>
  {amount!==undefined&&<div className="tile-amount">{amount}</div>}
  {fields.length>0&&<dl>{fields.map(([name,value],i)=><div key={i}><dt>{name}</dt><dd>{value===null||value===undefined||value===''?'—':value}</dd></div>)}</dl>}
  {actions?<footer className="tile-actions">{actions}</footer>:null}
 </article>;
}
