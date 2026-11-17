export type Module = {key:string; title:string; table:string; pk:string; subtitle:string; admin?:boolean; remove?:'delete'|'estado'|'archive'|'cancel'; readonly?:boolean; noEdit?:boolean; cashier?:boolean};
/** Módulos de Administrador que la Recepcionista también usa para cobrar (consultar y crear; no eliminar). */
export const cashierCan=(mod:Module,rol:string|undefined,method='GET')=>Boolean(mod.cashier&&rol==='Recepcionista'&&method!=='DELETE');
export const modules:Module[] = [
 {key:'pacientes',title:'Pacientes',table:'pacientes',pk:'id_paciente',subtitle:'Personas, contacto e historia clínica',remove:'archive'},
 {key:'citas',title:'Citas',table:'citas',pk:'id_cita',subtitle:'Organiza la atención y los horarios de tus doctores',remove:'cancel'},
 {key:'diagnosticos',title:'Diagnósticos',table:'diagnosticos',pk:'id_diagnostico',subtitle:'Evaluación clínica y odontograma por paciente',remove:'delete'},
 {key:'antecedentes',title:'Antecedentes médicos',table:'antecedentes_medicos',pk:'id_antecedente',subtitle:'Enfermedades, alergias y cuidados previos'},
 {key:'examenes',title:'Exámenes auxiliares',table:'examenes_auxiliares',pk:'id_examen',subtitle:'Radiografías, fotografías y documentos clínicos',remove:'delete'},
 {key:'planes',title:'Planes de tratamiento',table:'planes_tratamiento',pk:'id_plan',subtitle:'Presupuestos, procedimientos y progreso'},
 {key:'detalles',title:'Tratamientos del plan',table:'planes_tratamiento_detalle',pk:'id_detalle_plan',subtitle:'Procedimientos y piezas dentales',remove:'delete'},
 {key:'evoluciones',title:'Evoluciones',table:'evoluciones',pk:'id_evolucion',subtitle:'Seguimiento del tratamiento y próxima atención'},
 {key:'arcos',title:'Arcos de ortodoncia',table:'ortodoncia_arcos',pk:'id_arco',subtitle:'Aparatología, higiene y cooperación'},
 {key:'tratamientos',title:'Catálogo de tratamientos',table:'catalogo_tratamientos',pk:'id_tratamiento',subtitle:'Procedimientos, precios y duración',admin:true,remove:'estado'},
 {key:'inventario',title:'Inventario',table:'inventario_insumos',pk:'id_insumo',subtitle:'Insumos, existencias y vencimientos',admin:true},
 {key:'movimientos-inventario',title:'Movimientos de almacén',table:'inventario_movimientos',pk:'id_inventario_mov',subtitle:'Entradas y salidas con trazabilidad',admin:true,readonly:true},
 {key:'usuarios',title:'Usuarios',table:'usuarios',pk:'id_usuario',subtitle:'Equipo, roles y turnos',admin:true,remove:'estado'},
 {key:'distribuidores',title:'Distribuidores',table:'distribuidores',pk:'id_distribuidor',subtitle:'Proveedores y contactos',admin:true,remove:'estado'},
 {key:'laboratorios',title:'Laboratorios',table:'laboratorios',pk:'id_laboratorio',subtitle:'Colaboradores para trabajos externos',admin:true,remove:'estado'},
 {key:'comprobantes',title:'Comprobantes',table:'comprobantes',pk:'id_comprobante',subtitle:'Boletas, facturas y reimpresión',admin:true,remove:'delete',noEdit:true,cashier:true},
 {key:'promociones',title:'Promociones',table:'promociones',pk:'id_promocion',subtitle:'Campañas y descuentos vigentes',admin:true,remove:'estado'},
 ...['pacientes','citas','tratamientos','insumos','movimientos'].map(x=>({key:'categorias-'+x,title:'Categorías de '+x,table:'categorias_'+x,pk:'id_categoria',subtitle:'Clasificación y configuración',admin:true,remove:'estado' as const})),
 {key:'auditoria',title:'Registro de auditoría',table:'dentino_audit',pk:'id',subtitle:'Inicios de sesión, cambios y accesos denegados',admin:true,readonly:true},
 {key:'solicitudes',title:'Solicitudes de contacto',table:'solicitudes_contacto',pk:'id_solicitud',subtitle:'Consultas recibidas desde la página pública',admin:true},
 {key:'especialidades',title:'Especialidades',table:'especialidades',pk:'id_especialidad',subtitle:'Especialidades del equipo',admin:true,remove:'estado'}
];
export const labels:Record<string,string>={descuento_tipo:'Tipo de descuento',descuento_default:'Descuento predeterminado',id_paciente:'Paciente',id_doctor:'Doctor',id_diagnostico:'Diagnóstico',id_plan:'Plan de tratamiento',id_tratamiento:'Tratamiento',id_detalle_plan:'Tratamiento del plan',id_evolucion:'Evolución',id_movimiento:'Movimiento de caja',id_categoria:'Categoría',id_categoria_cita:'Categoría de cita',id_especialidad:'Especialidad',dni:'DNI',correo:'Correo electrónico',contrasena:'Contraseña',pin_autorizacion:'PIN de autorización',ruta_archivo:'Archivo clínico',numero_pieza:'Pieza FDI',id_usuario:'Usuario',id_insumo:'Insumo',direccion:'Dirección',telefono:'Teléfono',fecha_nacimiento:'Fecha de nacimiento',fecha_registro:'Fecha de registro',descripcion:'Descripción',metodo_pago:'Método de pago'};
export const label=(key:string)=>labels[key]||key.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
export type Field={name:string;label:string;type:string;required:boolean;default:unknown;options?:string[];ref?:{module:string;pk:string};readonly?:boolean;max?:number};
export type Row=Record<string,any>;
export const enumValues:Record<string,string[]>={rol:['Administrador','Recepcionista','Doctor','Doctor externo'],turno:['Mañana','Tarde','Noche'],sexo:['Masculino','Femenino','Otro'],estado_plan:['Propuesto','En progreso','Finalizado','Abandonado'],estado_pago:['Pendiente','Parcial','Cancelado'],estado_tratamiento:['Pendiente','Realizado'],tipo_cambio:['Entrada','Salida'],tipo_movimiento:['Ingreso','Egreso'],metodo_pago:['Efectivo','Tarjeta','Transferencia','Yape','Plin'],tipo_comprobante:['Boleta','Factura'],tipo_examen:['Radiografía Panorámica','Radiografía Periapical','Tomografía','Modelos de estudio','Fotografías'],arcada:['Superior','Inferior','Ambas'],higiene_paciente:['Buena','Regular','Mala'],cooperacion:['Excelente','Aceptable','Pobre']};
