import {Router} from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {rows} from './db.js';
import {fail} from './resources.js';
import {loadSettings} from './settings.js';
export const reportsRouter=Router();
const titles:Record<string,string>={pacientes:'Reporte de pacientes',citas:'Reporte de citas',ingresos:'Ingresos y egresos',planes:'Planes de tratamiento',tratamientos:'Tratamientos más solicitados',inventario:'Inventario',doctores:'Rendimiento por doctor'};
// Rango en citas, evoluciones e ingresos atribuidos al doctor del diagnóstico del plan.
const inRange='BETWEEN ? AND ?';
const doctorsSql=`SELECT CONCAT(u.nombre,' ',u.apellido) doctor,u.rol,
 (SELECT COUNT(*) FROM citas c WHERE c.id_doctor=u.id_usuario AND DATE(c.fecha) ${inRange}) citas,
 (SELECT COUNT(*) FROM citas c WHERE c.id_doctor=u.id_usuario AND c.estado='Atendida' AND DATE(c.fecha) ${inRange}) atendidas,
 (SELECT COUNT(*) FROM citas c WHERE c.id_doctor=u.id_usuario AND c.estado IN ('Cancelada','No asistió') AND DATE(c.fecha) ${inRange}) canceladas_o_ausentes,
 (SELECT COUNT(DISTINCT c.id_paciente) FROM citas c WHERE c.id_doctor=u.id_usuario AND DATE(c.fecha) ${inRange}) pacientes,
 (SELECT COUNT(*) FROM evoluciones e WHERE e.id_doctor=u.id_usuario AND DATE(e.fecha_evolucion) ${inRange}) evoluciones,
 (SELECT COALESCE(SUM(m.monto),0) FROM caja_movimientos m JOIN planes_tratamiento p ON p.id_plan=m.id_plan JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico WHERE d.id_doctor=u.id_usuario AND m.tipo_movimiento='Ingreso' AND m.anulado=0 AND DATE(m.fecha_movimiento) ${inRange}) ingresos
 FROM usuarios u WHERE u.rol IN ('Doctor','Doctor externo') AND u.estado='Activo'`;
const money=/monto|importe|costo|ingresos|pagado|descuento|precio/;
const cell=(key:string,value:unknown)=>{if(value===null||value===undefined||value==='')return '—';if(typeof value==='number'&&money.test(key))return 'S/ '+value.toFixed(2);const text=String(value).replace('T',' ').replace(/\.\d{3}Z?$/,'');const d=/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2})(?::\d{2})?)?$/.exec(text);return d?`${d[3]}/${d[2]}/${d[1]}${d[4]&&d[4]!=='00:00'?' '+d[4]:''}`:text;};

reportsRouter.get('/:kind',async(req,res)=>{const kind=String(req.params.kind),start=String(req.query.inicio||'1900-01-01'),end=String(req.query.fin||'2100-12-31');if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)fail(400,'Rango de fechas inválido');if(['ingresos','inventario','planes','doctores'].includes(kind)&&req.session.user!.rol!=='Administrador')fail(403,'Necesitas el rol Administrador');if(kind==='pacientes'&&!['Administrador','Recepcionista'].includes(req.session.user!.rol))fail(403,'Tu rol no tiene acceso a este reporte');const definitions:Record<string,string>={pacientes:'SELECT nombre,apellido,dni,telefono,sexo,fecha_registro FROM pacientes WHERE DATE(fecha_registro) BETWEEN ? AND ?',citas:'SELECT c.fecha,c.hora,c.estado,c.motivo,CONCAT(p.nombre," ",p.apellido) paciente,CONCAT(u.nombre," ",u.apellido) doctor FROM citas c JOIN pacientes p ON p.id_paciente=c.id_paciente JOIN usuarios u ON u.id_usuario=c.id_doctor WHERE DATE(c.fecha) BETWEEN ? AND ?',ingresos:'SELECT fecha_movimiento,tipo_movimiento,monto,descuento,metodo_pago,descripcion FROM caja_movimientos WHERE anulado=0 AND DATE(fecha_movimiento) BETWEEN ? AND ?',planes:'SELECT p.id_plan,CONCAT(pac.nombre," ",pac.apellido) paciente,p.costo_total,p.monto_pagado,p.estado_plan,p.estado_pago,p.fecha_creacion FROM planes_tratamiento p JOIN diagnosticos d ON d.id_diagnostico=p.id_diagnostico JOIN pacientes pac ON pac.id_paciente=d.id_paciente WHERE DATE(p.fecha_creacion) BETWEEN ? AND ?',tratamientos:'SELECT t.nombre_tratamiento,COUNT(*) procedimientos,SUM(dt.costo_unitario) importe FROM planes_tratamiento_detalle dt JOIN catalogo_tratamientos t ON t.id_tratamiento=dt.id_tratamiento JOIN planes_tratamiento p ON p.id_plan=dt.id_plan WHERE DATE(p.fecha_creacion) BETWEEN ? AND ? GROUP BY t.id_tratamiento,t.nombre_tratamiento ORDER BY procedimientos DESC',inventario:'SELECT nombre_insumo,stock_actual,stock_minimo,unidad_medida,ubicacion,fecha_vencimiento_proxima FROM inventario_insumos',doctores:doctorsSql};
 let sql=definitions[kind]||fail(404,'Reporte no encontrado');const params:any[]=kind==='inventario'?[]:kind==='doctores'?Array.from({length:6},()=>[start,end]).flat():[start,end];const filters:Record<string,string>={sexo:'sexo',doctor:kind==='doctores'?'u.id_usuario':'c.id_doctor',estado:kind==='planes'?'p.estado_plan':'c.estado',metodo_pago:'metodo_pago'};for(const [key,column] of Object.entries(filters)){if(req.query[key]&&((kind==='pacientes'&&key==='sexo')||(['citas','doctores'].includes(kind)&&key==='doctor')||(kind==='citas'&&key==='estado')||(kind==='planes'&&key==='estado')||(kind==='ingresos'&&key==='metodo_pago'))){if(typeof req.query[key]!=='string')fail(400,'Filtro inválido');sql+=' AND '+column+'=?';params.push(String(req.query[key]));}}
 if(kind==='citas'&&req.session.user!.rol==='Doctor externo'){sql+=' AND c.id_doctor=?';params.push(req.session.user!.id_usuario);}
 if(kind==='doctores')sql+=' ORDER BY atendidas DESC,citas DESC';
 const data=await rows(sql,params);
 if(req.query.format==='xlsx'){const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Dentino');const keys=Object.keys(data[0]||{});sheet.columns=keys.map(key=>({header:key.replaceAll('_',' '),key,width:24}));for(const row of data)sheet.addRow(Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='string'&&/^[=+@\t\r-]/.test(v)?"'"+v:v])));sheet.getRow(1).font={bold:true};res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="dentino-${kind}.xlsx"`);await workbook.xlsx.write(res);res.end();}
 else if(req.query.format==='pdf')await writePdf(res,kind,start,end,data);
 else res.json(data);
});

// PDF tabular generado en el servidor (A4; horizontal si hay muchas columnas).
export async function writePdf(res:import('express').Response,kind:string,start:string,end:string,data:Record<string,any>[]){
 const company=await loadSettings().catch(()=>({} as Record<string,any>));
 const keys=Object.keys(data[0]||{});const landscape=keys.length>5;
 const doc=new PDFDocument({size:'A4',layout:landscape?'landscape':'portrait',margin:36,bufferPages:true,info:{Title:'Dentino · '+(titles[kind]||kind),Author:'Dentino'}});
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="dentino-${kind}.pdf"`);doc.pipe(res);
 const left=doc.page.margins.left,width=doc.page.width-left-doc.page.margins.right,bottom=()=>doc.page.height-doc.page.margins.bottom-20;
 doc.fillColor('#174e42').font('Helvetica-Bold').fontSize(16).text(titles[kind]||kind,left,36);
 doc.fillColor('#555').font('Helvetica').fontSize(9).text([company.razon_social||'Dentino · Clínica odontológica',kind==='inventario'?'Estado actual':'Del '+start.split('-').reverse().join('/')+' al '+end.split('-').reverse().join('/'),'Generado: '+new Date().toLocaleString('es-PE',{timeZone:'America/Lima'}),data.length+' registros'].join('   ·   '));
 doc.moveDown(1);
 if(!keys.length){doc.fillColor('#333').fontSize(11).text('No hay datos para este periodo.');doc.end();return;}
 const col=width/keys.length,pad=4;
 const header=()=>{const y=doc.y;doc.rect(left,y,width,18).fill('#e7f2df');doc.fillColor('#174e42').font('Helvetica-Bold').fontSize(8);keys.forEach((k,i)=>doc.text(k.replaceAll('_',' ').toUpperCase(),left+i*col+pad,y+5,{width:col-pad*2,lineBreak:false,ellipsis:true}));doc.y=y+20;};
 header();
 data.forEach((row,index)=>{
  doc.font('Helvetica').fontSize(8);
  const texts=keys.map(k=>cell(k,row[k]));const h=Math.max(...texts.map(t=>doc.heightOfString(t,{width:col-pad*2})))+8;
  if(doc.y+h>bottom()){doc.addPage();doc.y=doc.page.margins.top;header();doc.font('Helvetica').fontSize(8);}
  const y=doc.y;if(index%2)doc.rect(left,y,width,h).fill('#f7f9f6');doc.fillColor('#222');
  texts.forEach((t,i)=>doc.text(t,left+i*col+pad,y+4,{width:col-pad*2}));doc.y=y+h;
 });
 const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.fillColor('#888').fontSize(7).text(`Dentino · página ${i+1} de ${range.count}`,left,doc.page.height-doc.page.margins.bottom-8,{width,align:'right',lineBreak:false});}
 doc.end();
}
