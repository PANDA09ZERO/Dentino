// Icono de marca de la clínica (diente con corazón). Se usa en la barra lateral, la pantalla de acceso, la página pública y el panel.
export function BrandMark({size=40,large=false,className=''}:{size?:number;large?:boolean;className?:string}){
 return <img src={large?'/images/diente-grande.png':'/images/diente-icono.png'} width={size} height={size} alt="" aria-hidden="true" decoding="async" className={'brand-img '+className}/>;
}
