ESPECIFICACIÓN DE REQUERIMIENTOS FUNCIONALES - DENTINO

================================================================================



1\. GESTIÓN DE PACIENTES

\--------------------------------------------------------------------------------

RF-01 Registrar Paciente

El sistema deberá permitir registrar pacientes con los siguientes datos:

\- Nombres

\- Apellidos

\- DNI

\- Fecha de nacimiento

\- Edad

\- Dirección

\- Teléfono

\- Correo electrónico (opcional)

\- Fecha de registro



RF-02 Buscar Paciente

Permitir búsqueda por:

\- Nombre

\- Apellido

\- DNI

\- Teléfono



RF-03 Editar Paciente

Modificar la información registrada.



RF-04 Eliminar Paciente

Realizar eliminación lógica manteniendo el historial en la base de datos.



RF-05 Historial Clínico

Visualizar todos los tratamientos, diagnósticos, exámenes, citas y la 

evolución cronológica del odontograma del paciente.





2\. GESTIÓN DE USUARIOS

\--------------------------------------------------------------------------------

RF-06 Registrar Usuario

Datos:

\- Nombre

\- Apellido

\- DNI

\- Dirección

\- Teléfono

\- Correo

\- Contraseña



RF-07 Roles

Asignar roles:

\- Administrador

\- Recepcionista

\- Doctor

\- Doctor externo



RF-08 Especialidades

Para usuarios con rol Doctor:

\- Ortodoncia

\- Endodoncia

\- Cirugía

\- Odontopediatría

\- Periodoncia

\- Otras (configurables)



RF-09 Turnos

Asignar:

\- Mañana

\- Tarde

\- Noche



RF-10 Estado

\- Activo

\- Inactivo



RF-11 Gestión de Usuarios

Buscar, editar y desactivar usuarios (eliminación lógica).





3\. GESTIÓN DE CITAS

\--------------------------------------------------------------------------------

RF-12 Registrar Cita

Datos:

\- Paciente

\- Doctor

\- Recepcionista

\- Fecha

\- Hora

\- Motivo



RF-13 Editar Cita

Modificar información de la cita.



RF-14 Cancelar Cita

Permitir cancelación registrando motivo.



RF-15 Estados de Cita

\- Pendiente

\- Confirmada

\- Atendida

\- Cancelada

\- Reprogramada



RF-16 Agenda Médica

Visualizar citas por:

\- Día

\- Semana

\- Mes

\- Doctor





4\. ANTECEDENTES MÉDICOS

\--------------------------------------------------------------------------------

RF-17 Registrar Antecedentes

Registrar:

\- Enfermedades previas

\- Alergias

\- Tratamientos anteriores

\- Medicamentos actuales

\- Intervenciones médicas



RF-18 Editar Antecedentes

Solo Doctor o Administrador mediante PIN de autorización.





5\. DIAGNÓSTICOS Y ODONTOGRAMA INICIAL

\--------------------------------------------------------------------------------

RF-19 Registrar Diagnóstico y Odontograma Inicial

El sistema deberá permitir registrar un diagnóstico de texto asociado a la 

apertura de un Odontograma Gráfico Inicial.

\- Representación Visual: Mostrar el esquema dental estructurado por cuadrantes, 

&#x20; permitiendo alternar entre dentición adulta (32 piezas) y dentición 

&#x20; decidua/infantil (20 piezas).

\- Selección por Diente y Cara: Permitir seleccionar un diente específico y 

&#x20; detallar la afección por cada una de sus 5 caras (vestibular, palatina/lingual, 

&#x20; oclusal/incisal, mesial y distal) o la pieza completa.

\- Estados Iniciales Patológicos: Registrar de forma gráfica estados como: Caries, 

&#x20; Ausente, Fracturado, Endodonciado previamente, Remanente radicular o 

&#x20; Corona/Puente en mal estado.



RF-20 Consultar Diagnósticos

Filtros por: Paciente, Doctor, Fecha.



RF-21 Editar Diagnóstico y Odontograma Inicial

Con autorización mediante PIN del doctor responsable.





6\. PLAN DE TRATAMIENTO

\--------------------------------------------------------------------------------

RF-22 Catálogo de Tratamientos

Registrar y configurar: Nombre, Descripción y Precio de los tratamientos 

(ej. Resina, Endodoncia, Instalación de Brackets Metálicos, Control de Ortodoncia).



RF-23 Crear Plan de Tratamiento desde el Odontograma

Permitir estructurar el plan de tratamiento de forma interactiva seleccionando 

las piezas dentales afectadas en el odontograma.

\- Automatización: Al hacer clic en una pieza o cara y seleccionar un tratamiento 

&#x20; del catálogo, este se añadirá automáticamente a la lista de detalles del plan 

&#x20; con su precio respectivo (ej. "Tratamiento: Resina - Pieza 14 (Mesial)").

\- Datos generales: Paciente, Doctor, Fecha, Hora, Lista de tratamientos 

&#x20; consolidados y presupuesto total.



RF-24 Historial de Planes

Visualizar planes anteriores (activos, rechazados o finalizados).



RF-25 Modificar Plan

Con autorización del doctor responsable.





7\. EVOLUCIÓN Y ODONTOGRAMA DE SEGUIMIENTO

\--------------------------------------------------------------------------------

RF-26 Registrar Evolución y Progreso Dental

El sistema registrará el avance de los tratamientos en cada cita del paciente 

actualizando el estado gráfico del odontograma.

\- Datos: Paciente, Doctor, Fecha, Hora, Estado actual, Avances y Observaciones.

\- Codificación Visual por Colores (Estándar Odontológico):

&#x20; \* Rojo: Trabajo o patología pendiente por realizar/tratar.

&#x20; \* Azul / Verde: Trabajo ya realizado de forma conforme (ya sea curado en la 

&#x20;   clínica o registrado previamente como sano).



RF-27 Control de Aparatología y Ortodoncia (Brackets)

Específicamente para tratamientos de ortodoncia, el sistema permitirá registrar 

sobre el odontograma gráfico las piezas de brackets y aditamentos utilizados.

\- Marcación de Aparatología: Permitir seleccionar pieza por pieza e indicar 

&#x20; visualmente si posee: Bracket metálico, Bracket estético (zafiro/cerámico), 

&#x20; Tubo molar, Banda o Botón.

\- Estado de la Pieza de Ortodoncia: Indicar gráficamente si el bracket está 

&#x20; instalado, cementado, si se desprendió (caído) o si fue retirado.

\- Registro de Arcos y Elásticos: Permitir registrar de manera global o por arcada 

&#x20; (superior/inferior) el tipo de arco actual (ej. NiTi .014, Acero .018) y el uso 

&#x20; de elásticos intermaxilares.



RF-28 Notas Específicas por Pieza

Permitir agregar texto libre u observaciones microscópicas asociadas a un diente 

o bracket específico (ej. "Pieza 21 con movilidad grado I", "Bracket de pieza 

12 caído por segunda vez").



RF-29 Validación de Evolución

Validar el cierre de la evolución médica mediante: PIN de confirmación del doctor 

o Firma digital.





8\. EXÁMENES AUXILIARES

\--------------------------------------------------------------------------------

RF-30 Registrar Examen

Subir y asociar archivos al historial del paciente. Ejemplos: Radiografías 

(periapicales, panorámicas), Tomografías, Fotografías clínicas de avance.



RF-31 Consultar Exámenes

Búsqueda y filtros por paciente o fecha.



RF-32 Editar Exámenes

Con autorización y registro de cambios.





9\. FACTURACIÓN

\--------------------------------------------------------------------------------

RF-33 Generar Comprobante

\- Tipos: Boleta, Factura.

\- Datos: Cliente, Recepcionista, Fecha, Hora, Tratamientos realizados (jalados 

&#x20; automáticamente del Plan de Tratamiento ejecutado), Total.



RF-34 Consultar Comprobantes

Filtros: Cliente, Fecha, Número de comprobante.



RF-35 Integración SUNAT

Permitir marcar si un comprobante: Se envía a SUNAT / No se envía a SUNAT.



RF-36 Reimpresión

Permitir reimprimir comprobantes físicos o enviarlos por correo.





10\. GESTIÓN DE CAJA

\--------------------------------------------------------------------------------

RF-37 Registrar Ingresos

Pagos de pacientes (efectivo, tarjeta, transferencia), iniciales de 

tratamientos u otros ingresos.



RF-38 Registrar Egresos

Pago a empleados, SUNAT, servicios básicos, laboratorios (RF-49), 

proveedores/distribuidores.



RF-39 Reporte de Caja

Mostrar en tiempo real: Ingresos, Egresos y Saldo actual.



RF-40 Modificar Movimientos

Solo con código de autorización (PIN) de administrador.



RF-41 Cierre de Caja

Registrar la apertura con saldo inicial y el cierre diario obligatorio.





11\. GESTIÓN DE DISTRIBUIDORES

\--------------------------------------------------------------------------------

RF-42 Registrar Distribuidor

Datos: Empresa, Dirección, Teléfono, Correo.



RF-43 Editar Distribuidor

Solo permitido al rol Administrador.



RF-44 Eliminar Distribuidor

Eliminación lógica para preservar el histórico de compras.





12\. GESTIÓN DE INVENTARIO

\--------------------------------------------------------------------------------

RF-45 Registrar Insumos

Datos: Nombre, Categoría, Tipo, Cantidad, Precio unitario, Distribuidor, Fecha 

de ingreso, Fecha de vencimiento. (Nota: Aquí se pueden incluir los kits de 

brackets, tubos y arcos como insumos).



RF-46 Estados del Inventario

\- Disponible

\- Por agotarse

\- Agotado

\- Por vencer

\- Vencido



RF-47 Movimientos de Almacén

Registrar: Entradas (compras), Salidas (por uso en consulta de materiales) y 

Ajustes manuales.



RF-48 Alertas Automáticas

Notificar al administrador cuando: El stock sea bajo o un producto esté próximo 

a vencer.





13\. GESTIÓN DE LABORATORIOS

\--------------------------------------------------------------------------------

RF-49 Registrar Laboratorio

Para trabajos externos (prótesis, coronas, retenedores de ortodoncia). Datos: 

Nombre, Dirección, Teléfono, Correo, Servicio prestado, Costo.



RF-50 Editar Laboratorio

Solo rol Administrador.



RF-51 Consultar Laboratorios

Búsqueda por nombre o tipo de servicio.





14\. REPORTES

\--------------------------------------------------------------------------------

RF-52 Reporte de Pacientes

RF-53 Reporte de Citas

RF-54 Reporte de Ingresos y Egresos (Flujo de Caja)

RF-55 Reporte de Tratamientos Más Solicitados

RF-56 Reporte de Inventario

RF-57 Exportar Reportes

Formatos disponibles: PDF y Excel.

================================================================================

