export function serviceBalances(details:any[],payments:any[],discount:number){
 details=[...details].sort((a,b)=>a.id_detalle_plan-b.id_detalle_plan);
 const cents=(v:any)=>Math.round(Number(v)*100);
 const costs=details.map(d=>Math.max(0,cents(d.costo_unitario)));
 const total=costs.reduce((a,b)=>a+b,0),net=Math.max(0,total-cents(discount));
 const shares=costs.map(cost=>total?Number(BigInt(cost)*BigInt(net)/BigInt(total)):0);
 let remaining=net-shares.reduce((a,b)=>a+b,0);
 const order=costs.map((cost,i)=>({i,remainder:total?(BigInt(cost)*BigInt(net))%BigInt(total):0n})).sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);
 for(const {i} of order){if(remaining--<=0)break;shares[i]++;}
 return details.map((d,i)=>{const paid=payments.filter(p=>p.id_detalle_plan===d.id_detalle_plan).reduce((s,p)=>s+cents(p.monto),0);return {...d,total_servicio:shares[i]/100,pagado_servicio:paid/100,saldo_servicio:Math.max(0,shares[i]-paid)/100};});
}
