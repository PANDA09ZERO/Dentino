# Dentino · React + TypeScript

Aplicación odontológica con React, Vite, API Express sobre Node.js y MySQL. La interfaz está en español y utiliza tarjetas Bento adaptables a escritorio y móvil.

## Ejecutar en esta computadora

Requisitos: Node.js 24 o superior, npm y el servicio MySQL 8 de la conexión de Workbench **Local instance MySQL80**. Workbench administra el servidor; no necesita estar abierto para que la aplicación funcione.

```powershell
cd C:\xampp\htdocs\Dentino
npm install
npm run dev
```

Abre **http://127.0.0.1:5173**. La API usa **http://127.0.0.1:3001**. Mantén la terminal abierta. Para detener ambos procesos, pulsa Ctrl+C.

Para usar la versión compilada:

```powershell
npm run build
npm start
```

Abre **http://127.0.0.1:3001**. Estar dentro de `htdocs` no ejecuta Node.js: la dirección anterior de Apache no inicia esta aplicación. La nueva aplicación no requiere PHP, Composer ni phpMyAdmin.

**Versión PHP retirada:** se eliminaron `index.php` y las carpetas exclusivas de la aplicación anterior (`controller`, `model`, `views`, `config`, `database` y `assets`). Se conservan íntegramente en el respaldo externo. La aplicación activa utiliza únicamente React, Node.js y TypeScript; conserva `images`, `uploads` y `document`.

## Configuración de MySQL

La configuración local está en `.env`, excluido de Git. La contraseña y el secreto de sesión nunca deben incluirse en el README, commits o logs. En otra computadora, copia `.env.example` a `.env` y completa los valores localmente.

| Variable | Configuración local |
| --- | --- |
| DB_HOST | 127.0.0.1 |
| DB_PORT | 3307 |
| DB_NAME | dentino_db |
| DB_USER | root, únicamente para esta instalación local |
| DB_PASSWORD | Completar localmente |
| SESSION_SECRET | Secreto aleatorio de al menos 32 caracteres |
| PORT | 3001 |
| APP_ORIGIN | http://127.0.0.1:5173 |

El usuario confirmó que la base del puerto 3307 es la fuente definitiva. No se importaron los SQL de ejemplo ni se sobrescribieron datos con los archivos dañados de XAMPP. Los usuarios anteriores conservan sus hashes bcrypt `$2y$`; el servidor los verifica sin cambiar sus contraseñas.

Para arrancar MySQL, abre Servicios de Windows y busca el servicio cuya ruta ejecutable corresponde a MySQL Server 8.0 y cuya configuración usa el puerto 3307. El nombre del servicio puede variar. Inícialo desde allí si está detenido. Workbench permite comprobar la conexión con `SELECT @@version, @@port, DATABASE();`. No arranques la instancia de MariaDB de XAMPP sobre el mismo puerto.

## Migraciones y protección de datos

`npm run db:migrate` ejecuta la migración aditiva e idempotente de `server/migrate.ts`; también se comprueba al arrancar la API. Conserva las tablas y agrega:

- Campo de descuento de movimientos de caja y archivo lógico de pacientes.
- Campos faltantes del formulario de antecedentes, conservando los campos antiguos.
- Tabla de contenido público y textos editoriales iniciales, sin datos ficticios de pacientes o operaciones.
- Sesiones persistentes, registro de cambios y control de migraciones.

La eliminación de pacientes es lógica. Las citas se cancelan. Usuarios, tratamientos, distribuidores y laboratorios se desactivan. Los registros clínicos y comprobantes con opción Eliminar requieren confirmación en la interfaz; MySQL mantiene las restricciones de relaciones. Los archivos clínicos se conservan incluso cuando se retira su registro para evitar pérdida accidental.

Las imágenes originales están en `images/`; los archivos clínicos siguen en `uploads/`, accesibles solamente con una sesión activa. No publiques esa carpeta directamente en Apache. Los documentos originales de requisitos se conservan en `document/`.

## Respaldo previo

Respaldo íntegro del proyecto y volcado consistente de MySQL antes de la migración:

Se guarda fuera del repositorio, en una carpeta privada de la computadora local (no se publica la ruta). Contiene:

- `Dentino/`: código original, configuración, imágenes, documentos y archivos subidos.
- `mysql3307.sql`: base MySQL previa al cambio.

La copia aislada de los archivos antiguos de XAMPP está en el directorio hermano `mariadb-clone/data`. Sus definiciones `.frm` tienen solamente 1 byte y su InnoDB falla en recuperación normal. Esa copia se conservó para una recuperación especializada; nunca se alteró la instancia original.

Estos respaldos contienen información privada y deben conservarse fuera de repositorios públicos. Para restaurar, detén Node.js, copia el proyecto original desde el respaldo y restaura el SQL primero en una base separada. Verifica los datos antes de sustituir la base de trabajo; la restauración de un respaldo anterior podría perder cambios posteriores.

## Flujos disponibles

- Acceso, cierre de sesión, usuarios, roles, especialidades y turnos. En **Usuarios → Ver detalle** se consulta la ficha personal y laboral de cualquier usuario, incluso inactivo, con edición e impresión/PDF. Solo Administrador puede verla; la API excluye contraseñas y PIN.
- Pacientes, búsqueda, edición, archivo e historia clínica consolidada.
- Agenda por día, periodo semanal o mensual y doctor; creación, edición y cancelación de citas. Los horarios se validan por turno y duración, impidiendo solapamientos.
- Diagnósticos y odontograma adulto e infantil por pieza y cara; exámenes con PDF e imágenes.
- Planes de tratamiento, detalles, presupuesto recalculado, pagos y estados; evoluciones y arcos de ortodoncia.
- Catálogo de tratamientos, proveedores, laboratorios y categorías.
- Inventario y movimientos transaccionales: las salidas no pueden dejar stock negativo. El stock inicial se registra mediante una entrada después de crear el insumo.
- Caja: pagos, ingresos, egresos, descuentos y saldo calculado, con registro automático. En **Historial de cajas → Ver detalle** se consultan los movimientos de cualquier caja del listado, incluidas las cerradas, con responsable, fechas, resumen financiero, métodos de pago, categorías y descuentos. El detalle es de consulta y mantiene el permiso de Administrador.
- Comprobantes vinculados a ingresos, correlativos y reimpresión.
- Reportes con filtros y exportación Excel. Para PDF se utiliza **Imprimir / PDF → Guardar como PDF** del navegador.
- Página pública y promociones vigentes según sus fechas. Se retiró la sección administrativa «Contenido público»; sus datos se conservan.
- Un único enlace **Categorías** permite elegir pacientes, citas, tratamientos, insumos o movimientos y administrar cada grupo desde su contenido.

Inventario, proveedores, usuarios, catálogo y configuración están reservados a Administrador. En caja, la **Recepcionista** también cobra: ve la caja del día, registra pagos de pacientes y movimientos manuales (ingresos y egresos) y emite, consulta e imprime comprobantes. Anular pagos, eliminar comprobantes, enviarlos por correo y consultar el historial y el detalle de cajas anteriores siguen siendo solo del Administrador. El backend valida los permisos independientemente de lo que muestre la interfaz. Se usan consultas parametrizadas, cookies HttpOnly, protección CSRF, límites de acceso y comprobación del contenido de archivos subidos.

## Funciones que eran especificaciones o ejemplos

Los documentos originales contienen requisitos que el PHP no implementaba: emisión electrónica o envío a SUNAT, envío de comprobantes por correo, firma digital o validación clínica mediante PIN, mapa integrado y recepción de solicitudes desde el formulario público. No se presentan como integraciones operativas en esta versión. El PIN existente puede configurarse en usuarios, pero no sustituye una firma digital. La página pública muestra únicamente los contactos configurados; no publica profesionales ficticios ni promete enviar formularios sin una integración.

## Pagos de pacientes y tratamientos

En **Caja → Pagos del paciente**, busca por nombre, apellido o DNI, selecciona el paciente, su plan y el servicio que paga. Se muestran procedimientos, presupuesto, descuento, total efectivo, pagado y pendiente. También puedes entrar desde **Ficha clínica → Plan → Registrar pago / ver saldo**.

Para registrar un cobro, entra directamente en Caja, indica el importe recibido y el método de pago, y pulsa **Registrar pago recibido**. Puedes registrar un abono o todo el saldo. La caja se prepara automáticamente cuando hace falta y se reutiliza durante 24 horas desde su creación; ya no hay apertura ni cierre manual. Los cierres históricos conservan sus detalles. Este botón registra un pago ya recibido por la clínica: no procesa cargos bancarios ni una pasarela de tarjetas.

El servidor valida el saldo y crea un ingreso vinculado al paciente, plan, caja y usuario, junto con la actualización del importe pagado del plan, en una sola transacción. Rechaza sobrepagos, importes inválidos, planes abandonados y relaciones incorrectas. Una clave única evita duplicar el mismo pago al reintentar. Pueden cobrar el Administrador y la Recepcionista; esta última entra por **Caja → Pagos del paciente**, porque no tiene acceso a la ficha clínica.

El estado de cuenta incluye pagos vinculados, método, fecha, caja, responsable y acceso a **Crear comprobante**. El detalle de una caja muestra el paciente y plan correspondiente. Los importes pagados anteriores a esta función se conservan y se indican como pagados anteriores sin movimiento vinculado; no se reconstruye una caja histórica ficticia.

Los importes pagados se actualizan mediante Caja; el formulario de plan ya no permite modificarlos directamente. Tampoco se puede reducir el presupuesto o aumentar el descuento dejando el total por debajo de lo ya pagado. **Anulación de pagos (solo Administrador):** en el historial de pagos del paciente, el botón **Anular** pide un motivo (5 a 500 caracteres) y una confirmación. El movimiento no se borra: queda en su caja marcado como anulado, con motivo, usuario y fecha, y se excluye de saldos, cierres, reportes de ingresos y del pagado del plan (que vuelve a Pendiente o Parcial). No se puede anular un pago con comprobante emitido (elimina primero el comprobante) ni reutilizar la clave de un pago anulado. Las devoluciones de dinero a través de bancos o pasarelas y los cobros externos siguen sin implementarse.

La migración `20261010_patient_payments` agrega relaciones e identificador de pago a `caja_movimientos`, sin eliminar datos. El respaldo previo se conserva de forma privada en `work/payments-backup` del espacio de trabajo de esta conversación.

## Servicios y cierre diario automático

Cada nuevo pago exige elegir un servicio (detalle del plan). Se guarda su identificador y una copia del nombre y pieza en el movimiento de caja. El estado de cuenta muestra total, pagos vinculados y saldo por servicio. Los descuentos del plan se prorratean por precio, con reparto determinista de centavos, conservando el total. Se valida tanto el saldo del servicio como el del plan. Los pagos antiguos sin servicio asociado se conservan; no se les asigna un tratamiento por suposición.

Cada caja vence a las 24 horas desde `fecha_apertura`, no a medianoche. El servidor verifica vencimientos cada minuto, al iniciar y antes de crear nuevos movimientos. La caja vencida pasa a Cerrada y conserva movimientos y saldo calculado; `fecha_cierre` refleja su vencimiento. Se marca como cierre automático y no se inventan un importe físico contado ni una diferencia de arqueo. El siguiente movimiento usa una nueva caja, sin apertura manual.

La comprobación periódica requiere Node.js ejecutándose. Si el servidor estuvo apagado, al iniciar procesa los vencimientos pendientes. La interfaz de Caja se actualiza cada minuto. Las migraciones agregan únicamente columnas y relaciones; los registros anteriores permanecen intactos.

## Simulación de impresión de boletas y facturas

En **Comprobantes → Simular boleta / factura**, elige el tipo y revisa el ejemplo ficticio. En cada comprobante guardado, **Vista previa / Imprimir** usa su numeración, fecha, paciente, servicio, pago y método reales. Pulsa **Imprimir / guardar PDF** para abrir el diálogo del navegador.

El diseño se adapta a A4 y muestra logo, empresa, cliente, descripción, importe y observaciones. Por decisión del usuario, razón social, RUC, dirección y teléfono empresariales quedan **Por configurar**. La factura también indica los datos fiscales del cliente pendientes. No se añaden impuestos sin configuración. Todos los documentos llevan **SIMULACIÓN · SIN VALIDEZ FISCAL**; el ejemplo no crea registros ni realiza una emisión electrónica.

## Datos de demostración

Se añadieron registros ficticios marcados como **Demo** o **[DEMO]**: seis pacientes, tres miembros del equipo, seis citas, categorías, tratamientos, insumos, proveedor, laboratorio y una caja de ejemplo cerrada con movimientos y comprobante de serie DEMO. Se completó el historial de los seis pacientes: cada uno tiene antecedentes, diagnóstico, odontograma, plan con detalles y evolución. Las direcciones, teléfonos y correos son ficticios. Los registros financieros de demostración aparecen en reportes y no tienen valor contable.

En **Pacientes**, pulsa el nombre o **Ver ficha clínica** para abrir el historial completo. Sus botones permiten ir a planes, evoluciones, antecedentes y odontogramas. La dentición infantil se selecciona automáticamente cuando el diagnóstico contiene únicamente piezas infantiles.

Para volver a ejecutar la carga sin duplicar registros:

```powershell
node --import tsx server/seed-demo.ts
```

La carga es transaccional y deja el marcador `demo_20261010_v1` en `dentino_migrations`. El manifiesto con los registros creados se guarda en `DEMO_OUTPUT_DIR` (por defecto `work/demo`, fuera de git) y lo usa `server/complete-demo-history.ts`. No cambia las cuentas existentes. Los miembros del equipo ficticio tienen contraseñas aleatorias no publicadas; entra con tu cuenta habitual y consulta sus fichas desde Usuarios.

## Verificación

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

La prueba de integración crea una base temporal `dentino_validation_*` copiando únicamente el esquema, añade registros de prueba, arranca una API aislada en el puerto 3101 y elimina esa base al terminar. No utiliza datos reales en sus fixtures ni cambia los usuarios de la base principal. Requiere permisos para crear y eliminar exclusivamente la base temporal de validación. Si la prueba se interrumpe, revisa esas bases antes de limpiar cualquier resto.

Se verificaron acceso bcrypt compatible con PHP, permisos, pacientes, citas y solapamientos, odontograma, planes y recálculo, evoluciones, antecedentes, carga y acceso protegido a archivos, inventario, caja, correlativos, comprobantes, Excel y cierre de sesión. El compilador verifica frontend y backend.

El navegador conectado a esta sesión no pudo alcanzar los puertos locales; por ello queda pendiente la inspección visual interactiva en el navegador del usuario. Las verificaciones de API sí se ejecutaron sobre el servidor real de Node.js en la base aislada.

## Despliegue fuera de esta computadora

La configuración entregada es local. Un despliegue requiere HTTPS, un usuario MySQL con permisos limitados a Dentino, un secreto nuevo, `NODE_ENV=production`, el origen definitivo en `APP_ORIGIN` y configuración del proxy HTTPS. No expongas el `.env`, respaldos ni archivos médicos como recursos públicos.

### Variables y seguridad añadidas (2026-11-04)

- `TRUST_PROXY` (opcional): número de proxies de confianza (por ejemplo `1`) cuando la API corre detrás de un proxy HTTPS; necesario para que la cookie `Secure` y el límite por IP funcionen.
- En producción `APP_ORIGIN` debe comenzar con `https://` y la cookie de sesión pasa a llamarse `__Host-dentino.sid`.
- La API arranca solo si existen `DB_USER`, `DB_NAME`, `APP_ORIGIN` y un `SESSION_SECRET` de al menos 32 caracteres.
- Límites: 300 solicitudes/min por IP en `/api`, 40 subidas/10 min, 60 reportes/min y 8 intentos fallidos/15 min por cuenta. Detalles en `AUDIT_REPORT.md` y `CHANGELOG.md`.

### Configuración de la clínica y solicitudes públicas (2026-11-04)

- **Administración → Configuración de la clínica** (solo Administrador): razón social, RUC (11 dígitos), dirección, teléfono, correo, horario y URL del mapa de Google Maps. Los comprobantes simulados usan estos datos y muestran «Por configurar» en lo que quede vacío; el contacto de la página pública se actualiza con el mismo formulario. El mapa acepta únicamente URL `https://www.google.com/maps/embed?...` (el valor del atributo `src` del iframe que ofrece Google Maps), sin claves.
- **Formulario público «Escríbenos»**: guarda cada consulta en `solicitudes_contacto` (nombre, teléfono o correo, mensaje). Protecciones: token CSRF, límite de 5 envíos por hora por IP, campo trampa invisible y validación de longitud. Se revisan en **Administración → Solicitudes de contacto** (solo Administrador), donde puedes marcarlas como Atendida. **No envía correos**: eso requiere configurar SMTP y sigue pendiente.
- Migración aditiva `20261104_clinic_settings` (tablas `configuracion_clinica` y `solicitudes_contacto`).

### Correo saliente (2026-11-04)

Instalación de la dependencia (una sola vez): `npm install nodemailer` y `npm install -D @types/nodemailer`.

El correo está **desactivado** hasta que definas en `.env` (nunca en el repositorio ni en el chat): `SMTP_HOST`, `SMTP_PORT` (587 o 465), `SMTP_SECURE` (`true` solo con 465), `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`; opcionalmente `NOTIFY_EMAIL`. Usa una cuenta dedicada con contraseña de aplicación. Tras editar `.env`, reinicia la API.

- **Aviso de solicitudes nuevas**: cada consulta del formulario público envía un aviso al correo de **Configuración de la clínica** (o `NOTIFY_EMAIL`), con un máximo de 30 avisos por hora.
- **Comprobantes por correo**: en la vista previa de un comprobante (solo Administrador) hay un campo con el correo del paciente y el botón **Enviar por correo**. Se envía un texto simple marcado como simulación sin validez fiscal.
- **Cola con reintentos**: los correos se guardan en `cola_correos` y se envían en segundo plano; si falla el servidor SMTP se reintenta a los 5, 15, 60 y 240 minutos y después queda como Fallido. Solo se guarda un código corto del error, nunca contraseñas. El estado (enviados, pendientes, fallidos) se ve en **Configuración de la clínica**.
- Migración aditiva `20261104_mail_queue`.

### Firma clínica con PIN (2026-11-04)

- **Mi PIN de firma** (menú Administración, todos los roles): cada usuario define su propio PIN de 4 a 8 dígitos confirmando con la contraseña de su cuenta. El PIN se guarda con bcrypt; el administrador no puede verlo ni fijarlo en nombre de otro (el campo es de solo lectura en Usuarios).
- **Firmar**: en **Diagnósticos** y **Evoluciones**, el doctor responsable del registro (rol Doctor) ve el botón **Firmar** y confirma con su PIN. Un registro firmado ya no puede editarse ni eliminarse (409), ni siquiera por el administrador. Recepcionista, Doctor externo y Administrador no firman.
- **Integridad**: al firmar se guarda una copia del contenido (incluido el odontograma) y un hash SHA-256 con el firmante y el instante. `GET /api/firma/:modulo/:id` indica si el registro sigue idéntico a lo firmado; si alguien lo altera directamente en la base de datos, `integro` pasa a `false`.
- **Límite**: 8 intentos fallidos cada 15 minutos por usuario.
- Es una firma interna de la aplicación; **no es una firma digital certificada** ni sustituye requisitos legales de firma. Migración aditiva `20261104_signatures` (tabla `firmas_clinicas`).

### Auditoría de seguridad (2026-11-04)

**Administración → Registro de auditoría** (solo Administrador, solo lectura) muestra, además de los cambios sobre datos, estos eventos de seguridad con fecha, IP y usuario:

- `login` y `logout`: inicios y cierres de sesión.
- `login_fallido`: credenciales incorrectas o cuenta inactiva. Se guarda una **huella** corta del correo (`correo#…`), nunca el texto, para correlacionar intentos sin registrar contraseñas escritas por error en ese campo.
- `login_bloqueado`: se alcanzó el límite de intentos (por IP o por cuenta).
- `acceso_denegado`: respuestas 403 (rol sin permiso, token CSRF o origen inválidos, PIN incorrecto), con el método y la ruta, sin parámetros de consulta.

El registro no se puede editar ni eliminar desde la aplicación. La columna Usuario muestra el identificador; consúltalo en **Usuarios**. Para depurar la tabla con el tiempo, hazlo desde MySQL con un respaldo previo. Migración aditiva `20261104_audit_events`.

### Historia clínica: versiones del odontograma (2026-11-05)

- En cada diagnóstico hay dos formas de cambiar el odontograma:
  - **Editar diagnóstico y odontograma**: corrige el registro actual (la última versión se mantiene igual). Úsalo para corregir errores.
  - **Actualizar odontograma (nueva versión)**: guarda el nuevo estado como una versión nueva con fecha, usuario y nota, y conserva las anteriores. Se rechaza si no hay cambios.
- La historia clínica muestra la versión actual con su fecha y autor, las piezas que cambiaron respecto a la anterior y un selector **Ver otra versión** para consultar las anteriores.
- Un diagnóstico firmado ya no puede editarse, pero sí recibir nuevas versiones del odontograma; la firma queda ligada a la versión vigente al firmar.
- Los selectores de diagnóstico, plan, tratamiento y evolución muestran ahora el paciente y la fecha, para no enlazar un registro a otro paciente por error.
- Migración aditiva `20261105_odontogram_versions`: crea las tablas de versiones y la versión 1 de cada odontograma existente; no modifica `odontograma_piezas`.
- Herramienta de diagnóstico de solo lectura: `npx tsx server/diagnose-clinical.ts [id_paciente]` revisa planes, tratamientos y evoluciones sin mostrar datos personales.

### Historia clínica: planes con tratamientos y evoluciones (2026-11-05)

- **Nuevo plan** (historia clínica → Planes de tratamiento): un asistente crea el plan con varios tratamientos de una vez. Eliges tratamientos del catálogo (el costo se rellena solo y se puede ajustar), la pieza dental y el descuento; ves el total en vivo. El plan y sus tratamientos se guardan juntos o no se guarda nada, así que ya no quedan planes vacíos.
- Cada plan muestra su diagnóstico, importes, avance de tratamientos y, bajo cada tratamiento, sus evoluciones. Si un plan no tiene tratamientos, lo avisa.
- **Registrar evolución** desde el propio tratamiento: describe el procedimiento, la próxima cita sugerida y, si quieres, cambia el estado del tratamiento en el mismo paso.
- La sección Evoluciones es ahora una cronología que indica a qué plan, tratamiento y pieza pertenece cada una.
- Servicios nuevos: `GET /api/clinica/catalogo` y `POST /api/clinica/planes/completo` (no se permiten a Recepcionista; Doctor externo es solo lectura).

### Interfaz simplificada y flujo guiado (2026-11-17)

- **Menú por rol** con un máximo de 7 secciones (Inicio, Agenda, Pacientes, Caja y comprobantes, Inventario o Proveedores, Reportes, Configuración); cada sección agrupa sus pantallas en pestañas. Las rutas anteriores (`#diagnosticos`, `#planes`, etc.) siguen funcionando.
- **Búsqueda global** de pacientes por nombre o DNI en la barra superior.
- **Ficha del paciente** en pestañas: Resumen, Antecedentes, Odontograma y diagnósticos, Planes, Evoluciones, Exámenes, Citas y Pagos. «Imprimir historia» incluye todas las secciones.
- **Inicio por rol**: citas del día con *Confirmar* y *Atender*; Administrador ve además saldos por cobrar y alertas de inventario (Vencido, Agotado, Por vencer, Por agotarse). Los doctores ven solo sus citas.
- **Atención guiada**: *Atender* marca la cita como atendida y abre la ficha con los pasos evolución → pago → comprobante. Tras un pago, *Emitir boleta* / *Emitir factura* crea el comprobante con la última serie usada de ese tipo (o B001/F001).
- El comprobante muestra los tratamientos del plan, el total, lo pagado a la fecha y el saldo.
- **Agenda en calendario** (día, semana y mes) filtrable por doctor: `GET /api/clinica/agenda`.
- **Reportes**: nuevo *Rendimiento por doctor* (solo Administrador), filtro por doctor y exportación **PDF generada en el servidor** (`&format=pdf`, dependencia `pdfkit`).
- `POST /api/clinica/citas/:id/estado` cambia solo el estado (Confirmada, Atendida, No asistió) y queda en auditoría.
- Migración aditiva `20261117_indexes`: índices por fecha de cita, doctor y fecha, fecha de movimientos, planes y evoluciones, y apellido y nombre de pacientes.
- El cliente está dividido por pantallas (`client/Dashboard.tsx`, `PatientFile.tsx`, `Agenda.tsx`, `Reports.tsx`, `Cash.tsx`, `Resources.tsx`, `Odontogram.tsx`, `Navigation.tsx`, `ui.tsx`); ficha, agenda, caja y reportes se cargan al abrirse.

**Restablecer una contraseña olvidada** (en la computadora del servidor): `npm run user:reset-password`. Muestra las cuentas, pide el número y la nueva contraseña (no se ve al escribir) y la guarda con bcrypt, con registro en auditoría.
