# Cambios

## 2026-11-17 — Instalar Dentino en el teléfono (PWA)

- **Login:** botón «Descargar en el teléfono». Si el navegador lo permite (Chrome o Edge en Android y escritorio), abre su diálogo de instalación; si no (iPhone o Safari), muestra los pasos («Compartir → Agregar a pantalla de inicio» o «menú → Instalar aplicación»). No aparece si ya se abrió como app instalada.
- **App instalable:** `public/manifest.webmanifest` (nombre, colores e inicio en el panel), iconos de 192 y 512 px (incluido el adaptable de Android) y el icono para iPhone, generados desde `images/logo_sin_fondo.png`.
- `public/sw.js`: *service worker* mínimo **sin caché**, para que los datos clínicos y de caja nunca queden guardados en el teléfono. Si no hay conexión al abrir la app, muestra un aviso con «Reintentar».
- `client/App.tsx`: abierta como app instalada y sin sesión, va directo al inicio de sesión en lugar de la página pública.
- **Requisito:** la instalación en el teléfono necesita que la app se sirva por **HTTPS** desde una dirección que el teléfono alcance. En esta computadora la API escucha solo en `127.0.0.1` (ver «Despliegue fuera de esta computadora» en el README).

## 2026-11-17 — Página pública renovada

- **Portada:** el lado derecho ahora es la tarjeta «Pide tu cita en 3 pasos» con su botón (antes era el logo, que ya aparece en la barra superior). Si no hay teléfono ni WhatsApp configurados, el segundo botón lleva a los servicios. La barra superior tiene «Pedir cita» fijo.
- **Tratamientos:** sección nueva «Lo que podemos hacer por ti» con los nombres de los tratamientos activos del catálogo, sin precios ni registros de demostración (`/api/publico` → `treatments`). Si no hay ninguno, no se muestra.
- **Formulario de cita** (`client/PublicContact.tsx`): campos «Servicio de interés» (del catálogo o de los servicios destacados) y «Turno preferido» (Mañana, Tarde o Noche), que se agregan al mensaje que ve Recepción en Solicitudes. El mensaje pasa a ser opcional si se elige un servicio. Se valida en el navegador antes de enviar, se usan los autocompletados del teléfono y aparece un aviso de uso de datos. Al enviar, se muestra una confirmación con acceso a llamada o WhatsApp si están configurados.
- **Ubicación** muestra también el horario. El **pie** incluye enlaces, contacto y el año.
- **Móvil:** botones de la portada a todo el ancho, servicios compactos (icono al lado), pie en columna y «Pedir cita» en la barra inferior. Sin desbordamiento horizontal a 375 px.
- No se inventan datos: lo que no está en Configuración de la clínica, el contenido público, las promociones o el catálogo, no aparece.

## 2026-11-17 — Sin rutas personales en el repositorio público

- `server/seed-demo.ts` y `server/complete-demo-history.ts`: la carpeta del manifiesto de la demo ya no está fija en una ruta personal. Se configura con `DEMO_OUTPUT_DIR` y por defecto es `work/demo`, excluida de git. Está documentada en `.env.example`.
- `README.md`: se quitó la ruta local de los respaldos previos.

## 2026-11-17 — La Recepcionista cobra en caja

- **Servidor** (`server/finance.ts`, `server/resources.ts`, `server/index.ts`, `shared/modules.ts`, con el nuevo indicador `cashier` y la función `cashierCan`): la Recepcionista puede ver la caja del día (sin el historial), registrar movimientos manuales y pagos de pacientes, ver el estado de cuenta, y emitir, listar y ver el detalle de comprobantes. Siguen siendo solo del Administrador: anular pagos, eliminar comprobantes, enviarlos por correo y el historial y detalle de cajas. El Doctor y el Doctor externo siguen sin acceso a caja.
- **Inicio:** la Recepcionista ve «Cobrar» / «Pagado» en las citas atendidas y el acceso rápido «Abrir caja». El enlace la lleva a **Caja → Pagos del paciente**, porque no puede abrir la ficha clínica.
- **Cliente** (`App.tsx`, `Navigation.tsx`, `Cash.tsx`, `PatientPayments.tsx`, `ReceiptPreview.tsx`, `Resources.tsx`): se muestra la sección «Caja y comprobantes» a la Recepcionista, sin los botones de anular, eliminar, enviar por correo ni el historial de cajas.
- `server/index.ts`: el límite global de `/api` se puede configurar con `API_RATE_LIMIT` (por defecto 300/min, como antes). La prueba lo sube a 5000 en su servidor aislado, porque ya superaba 300 peticiones por minuto.
- `tests/migration.test.ts`: las aserciones antiguas que esperaban 403 para la Recepcionista en caja ahora esperan el permiso nuevo. Se añadió un bloque con lo que sí puede hacer (cobrar, emitir comprobantes, movimientos y ver «Pagado») y lo que no (anular, borrar comprobantes, detalle de cajas), y se comprueba que el Doctor sigue sin acceso.

## 2026-11-17 — Inicio: «Pagado» en lugar de «Cobrar»

- `server/index.ts` (`/api/dashboard`): cada cita del día trae `pagado` = 1 si el paciente tiene un pago vigente (no anulado) registrado ese mismo día. Solo se calcula para Administrador; los demás roles reciben 0.
- `client/Dashboard.tsx` y `client/style.css`: en una cita atendida y pagada se muestra la etiqueta verde «Pagado» en vez de «Cobrar». Sigue enlazando a los pagos del paciente, por si hay que cobrar otro servicio.
- `tests/migration.test.ts`: cita pagada (1), cita sin pago del día (0) y Doctor (siempre 0).

## 2026-11-17 — Auditoría 2: permisos del rol Doctor (H-01 y H-02)

- `server/access.ts` (`assertCanSchedule`) y `server/resources.ts`: con el rol Doctor, crear una cita o cambiarle el paciente o el doctor solo se permite a su propio nombre y para pacientes que ya son suyos o que aún no tienen historia clínica (sin diagnósticos ni antecedentes). Así se cierra la vía para acceder a la historia de cualquier paciente agendándose una cita (H-01). Para un paciente con historia de otro doctor, la primera cita la crea Recepción o el Administrador. Los demás roles no cambian.
- `server/access.ts` (`assertAuthor`) y `server/resources.ts`: con el rol Doctor, los diagnósticos y evoluciones se registran a su propio nombre y no se puede cambiar el doctor responsable de un registro existente (H-02). Sigue pudiendo corregir registros sin firmar de otros doctores de sus pacientes. El Administrador no cambia.
- `tests/migration.test.ts`: segundo Doctor de prueba y casos para H-01 y H-02.

## 2026-11-17 — Auditoría 2: hallazgos de severidad media (M-01 a M-08)

- **M-01** `server/clinical.ts`: al sacar una cita de «No asistió» (que libera el horario) se revalida que el horario siga libre; si no, 409. `validateAppointment` compara la hora normalizada a `HH:mm`, porque la base la devuelve como `HH:mm:ss`.
- **M-02** `shared/modules.ts` (`noEdit`), `server/resources.ts` y `client/Resources.tsx`: los comprobantes ya no se editan (PUT 405) y se oculta «Editar». Crear y eliminar no cambian.
- **M-03** `server/resources.ts`: un plan no puede pasar a un diagnóstico de otro paciente, y un diagnóstico con planes no puede cambiar de paciente (409). Dentro del mismo paciente sigue permitido.
- **M-04** `server/signatures.ts` y `server/resources.ts`: los exámenes de un diagnóstico firmado y los arcos de una evolución firmada se pueden agregar, pero no editar ni borrar (409). Al firmar un diagnóstico sin versiones del odontograma se crea su versión base, aunque esté vacía, para que las versiones posteriores no den una falsa alarma de integridad.
- **M-05** `server/access.ts` y `server/reports.ts`: el Doctor externo ve solo sus citas en el listado, el detalle, las opciones y el reporte de citas. El Doctor sigue viendo todas.
- **M-06** `server/payments.ts`: la anulación comprueba el comprobante con una lectura con bloqueo (`FOR SHARE`), así que ya no anula un pago cuyo comprobante se confirmó a la vez.
- **M-07** `server/finance.ts` y `client/Cash.tsx`: los movimientos manuales exigen una clave de operación (`clave_pago`). Un reintento idéntico devuelve 200 sin duplicar, y la misma clave con otros datos devuelve 409. El formulario evita el doble envío y conserva la clave si falla la red.
- **M-08**: `server/backup-payments.ts` se movió a `work/retirados/`. Volcaba la base completa sin cifrar, con hashes y sesiones. No se borró nada, y los respaldos ya generados siguen en su carpeta original.
- `tests/migration.test.ts`: un caso por hallazgo (M-01 a M-07).

## 2026-11-17 — Auditoría 2: hallazgos de severidad baja (B-01 a B-08)

- **B-01** `server/index.ts`: solo Administrador y Doctor suben archivos clínicos (`/api/archivos`). En `/uploads`, el Administrador ve todos; los demás roles, solo los archivos de un examen al que tienen acceso (403 si no; 404 si el archivo no está ligado a ningún examen).
- **B-02** `server/session.ts`, `server/index.ts` y `server/resources.ts`: la sesión guarda una huella del hash de la contraseña. Si la contraseña cambia, las sesiones abiertas de esa cuenta dejan de valer, salvo la de quien cambia la suya propia. `/api/auth/me` devuelve `user:null` si la cuenta está desactivada o la sesión ya no es válida. Las sesiones abiertas antes de esta versión adoptan la huella en su siguiente petición, sin cerrar la sesión.
- **B-03** `server/clinical.ts`: la agenda rechaza fechas imposibles (`2026-13-01`, `2026-02-30`) que antes saltaban el límite de dos meses.
- **B-04** `server/security-migration.ts` y `server/resources.ts`: migración aditiva `20261117_receipt_counters` (tabla `comprobantes_correlativos`, inicializada con el máximo actual por tipo y serie). Borrar el último comprobante ya no hace que su número se reutilice.
- **B-06**: no hubo cambio. Al verificarlo, el servidor ya rechazaba (409) un descuento mayor que el presupuesto; se añadió una prueba de regresión.
- **B-07** `shared/modules.ts` y `server/index.ts`: distribuidores y laboratorios pasan a ser módulos de Administrador. Los demás roles siguen viendo sus nombres en las listas desplegables.
- **B-08** `client/PatientPayments.tsx`: la clave del cobro se genera dentro del `try`.
- `tests/migration.test.ts`: casos para B-01, B-02, B-03, B-04 y B-07, que fallaron antes de su corrección y pasan después, más la regresión de B-06. Cada uno falló antes de su corrección y pasa después. El caso de M-06 reproduce la carrera con una transacción directa en la base temporal. Fallaban antes de la corrección (201/200 en lugar de 403) y pasan después.

## 2026-11-04 — Endurecimiento de seguridad (sin cambios de reglas de negocio)

- `server/index.ts`: valida `DB_USER`, `DB_NAME`, `APP_ORIGIN` y `SESSION_SECRET` antes de migrar; en producción exige `APP_ORIGIN` con HTTPS y avisa si se usa `root`.
- `server/index.ts`: límite global de 300 solicitudes/min por IP en `/api`; 40 subidas/10 min; 60 reportes/min; login limitado también por cuenta (8 fallos/15 min).
- `server/index.ts`: el login compara siempre contra un hash (tiempo uniforme) para no revelar si el correo existe.
- `server/index.ts`: cabeceras `Referrer-Policy: same-origin` y `Permissions-Policy`; soporte opcional `TRUST_PROXY` (número de saltos); cookie `__Host-dentino.sid` en producción; archivos clínicos con `Cache-Control: private, no-store`.
- `server/index.ts`: JSON mal formado responde 400 y cuerpo excesivo 413 (antes 500).
- `server/resources.ts`: filtros de lista deben ser texto simple (400 si se repiten); tamaño máximo de página 200; la auditoría guarda la IP.
- `server/security-migration.ts` (nuevo) y `server/migrate.ts`: migración aditiva `20261104_audit_ip` (columna `ip` en `dentino_audit`).
- `server/reports.ts`: el prefijo anti-fórmula de Excel también cubre tabulador y retorno de carro.

## 2026-11-04 (2ª pasada) — Permisos por rol y datos sensibles

- `server/access.ts` (nuevo): permisos por rol y por paciente. Recepcionista sin acceso clínico; Doctor limitado a pacientes con cita o diagnóstico propio; Doctor externo solo lectura. Se aplica a listados, lectura, alta, edición, baja, `/api/opciones`, historial y odontograma.
- `shared/modules.ts`, `server/index.ts`: comprobantes (módulo y detalle) solo Administrador; `/api/modulos` oculta módulos clínicos a Recepcionista.
- `server/reports.ts`: reporte `planes` solo Administrador; reporte `pacientes` solo Administrador y Recepcionista.
- `server/resources.ts`, `server/security-migration.ts`: el PIN se guarda con bcrypt (4–8 dígitos); migración `20261104_pin_hash`.
- `server/resources.ts`: `ultima_actualizacion` de antecedentes toma la hora de MySQL (`NOW()`), corrigiendo un posible desfase de 5 horas.
- `tests/migration.test.ts`: pruebas de regresión de los permisos por rol y por paciente.

## 2026-11-04 (3ª pasada) — Anulación de pagos

- `server/payments.ts`: `POST /api/caja/pacientes/:id/pagos/:movimiento/anular` (solo Administrador). Requiere motivo, bloquea pagos con comprobante, restaura `monto_pagado` y `estado_pago` del plan, recalcula el cierre de cajas ya cerradas y registra auditoría.
- `server/security-migration.ts`: migración aditiva `20261104_payment_void` (columnas `anulado`, `motivo_anulacion`, `anulado_por`, `fecha_anulacion` en `caja_movimientos`).
- Los pagos anulados se excluyen de saldos de caja, cierre automático, saldo por servicio, validación de planes, reporte de ingresos y comprobantes (`finance.ts`, `automatic-cash.ts`, `clinical.ts`, `reports.ts`, `resources.ts`).
- `client/PatientPayments.tsx`, `client/App.tsx`: botón Anular, estado «Anulado» con motivo y totales de caja que ignoran anulados.
- `tests/migration.test.ts`: pruebas de anulación (motivo inválido, rol, doble anulación, saldo restaurado, reutilización de clave, comprobante bloqueado).

## 2026-11-04 (4ª pasada) — Configuración de la clínica, mapa y solicitudes públicas

- `server/settings.ts` (nuevo): `GET/PUT /api/configuracion` (solo Administrador, con validación de RUC, teléfono, correo y URL de mapa) y `POST /api/publico/solicitud` (CSRF, 5/hora por IP, campo trampa).
- `server/security-migration.ts`: migración aditiva `20261104_clinic_settings` (tablas `configuracion_clinica` y `solicitudes_contacto`).
- `server/index.ts`: `/api/publico` devuelve la URL del mapa; el detalle de comprobante incluye los datos de la empresa; la CSP permite incrustar solo Google Maps (`frame-src`).
- `shared/modules.ts`: módulo administrativo «Solicitudes de contacto».
- `client/ClinicSettings.tsx`, `client/PublicContact.tsx`, `client/App.tsx`, `client/ReceiptPreview.tsx`: pantalla de configuración, formulario y mapa en la página pública, y datos reales de la empresa en la vista previa de comprobantes.
- `tests/migration.test.ts`: pruebas de configuración (rol, validación, uso en comprobantes), mapa público, solicitud válida, campo trampa y validación.

## 2026-11-04 (5ª pasada) — Interfaz según el rol

- `client/App.tsx`: Recepcionista ya no ve «Ver ficha clínica» ni «Nuevo diagnóstico»; Doctor externo no ve Nuevo registro, Editar ni Archivar/Eliminar (solo lectura); la lista de reportes depende del rol (Administrador todos; Recepcionista pacientes, citas y tratamientos; Doctor y Doctor externo citas y tratamientos). Antes esos botones respondían 403.

## 2026-11-04 (6ª pasada) — Correo saliente

- `server/mailer.ts` (nuevo, usa `nodemailer`): cola persistente `cola_correos`, envío en segundo plano, reintentos con retardo creciente y estadísticas. Desactivado si faltan `SMTP_HOST` o `SMTP_FROM`.
- `server/mail-routes.ts` (nuevo): `GET /api/correo/estado` y `POST /api/correo/comprobantes/:id` (solo Administrador, con auditoría).
- `server/settings.ts`: aviso por correo de cada solicitud del formulario público (límite de 30 por hora).
- `server/security-migration.ts`: migración aditiva `20261104_mail_queue`.
- `client/ReceiptPreview.tsx`, `client/ClinicSettings.tsx`: botón Enviar por correo y estado del correo saliente.
- `.env.example`: variables `SMTP_*` y `NOTIFY_EMAIL` (vacías).
- `tests/migration.test.ts`: pruebas de cola, permisos y validación (el servidor de pruebas usa un SMTP inexistente, sin enviar nada).

## 2026-11-04 (7ª pasada) — Firma clínica con PIN

- `server/signatures.ts` (nuevo): `POST /api/firma/pin`, `POST /api/firma/:modulo/:id` y `GET /api/firma/:modulo/:id` (estado e integridad). Firma de diagnósticos y evoluciones solo por el doctor responsable; hash SHA-256 y copia del contenido; límite de 8 intentos fallidos/15 min.
- `server/resources.ts`: los registros firmados no se pueden editar ni eliminar; los listados indican `firmado`, `firmante` y `puede_firmar`; `pin_autorizacion` pasa a solo lectura en el CRUD genérico.
- `server/security-migration.ts`: migración aditiva `20261104_signatures`.
- `client/PinSettings.tsx` (nuevo), `client/App.tsx`: pantalla «Mi PIN de firma», botón Firmar con diálogo de PIN enmascarado y estado «Firmado» en las listas.
- `tests/migration.test.ts`: pruebas de PIN, permisos de firma, bloqueo de edición, integridad y detección de alteración.

## 2026-11-04 (8ª pasada) — Auditoría de eventos de seguridad

- `server/audit.ts` (nuevo): registro de eventos que nunca interrumpe la respuesta y huella del correo.
- `server/index.ts`: auditoría de `login`, `logout`, `login_fallido`, `login_bloqueado` y `acceso_denegado` (todo 403).
- `server/security-migration.ts`: migración aditiva `20261104_audit_events` (columna `detalle` en `dentino_audit`).
- `shared/modules.ts`: módulo administrativo de solo lectura «Registro de auditoría».
- `tests/migration.test.ts`: pruebas de eventos, privacidad del correo y permisos del visor.

## 2026-11-04 (9ª pasada) — División del JavaScript del cliente

- `vite.config.ts`: React (con `react-dom` y `scheduler`) y los iconos de `lucide-react` pasan a archivos propios (`react-*.js`, `iconos-*.js`); el código de la aplicación queda aparte. Las librerías se guardan en caché entre versiones y el aviso de tamaño del `build` desaparece si ninguna pieza supera 500 kB.
- `client/App.tsx`: UserDetail, ReceiptPreview, PatientPayments, ClinicSettings y PinSettings se cargan bajo demanda (`React.lazy` con `Suspense`), solo al abrir esas pantallas.

## 2026-11-04 (10ª pasada) — Interfaz Bento sin tablas y barra inferior móvil

- `client/Tiles.tsx` (nuevo): componentes `TileGrid` y `Tile` (tarjeta Bento con título, insignia, importe, datos etiqueta/valor y acciones).
- `client/App.tsx`, `client/PatientPayments.tsx`: las tablas de datos (listas de registros de todos los módulos, movimientos de caja, historial de pagos, reportes y tablas simples) pasan a tarjetas. La vista previa del comprobante conserva su tabla porque es un documento imprimible.
- `client/App.tsx`: barra de navegación inferior en móvil (Inicio, Pacientes, Agenda, Caja o Citas, y «Más»); «Más» abre un menú con todo el contenido del menú lateral y el cierre de sesión. El menú lateral y el botón de hamburguesa se ocultan en pantallas de hasta 760 px.
- `client/style.css`: estilos de las tarjetas (colores alternos suaves, 1 columna en móvil, 2 columnas al imprimir) y de la barra inferior (respeta el área segura de iPhone).

## 2026-11-04 (11ª pasada) — Nueva página pública de inicio

- `client/PublicPage.tsx` y `client/public.css` (nuevos): la página que ven los visitantes en `#inicio` se rehace con diseño Bento. Cabecera fija, portada con botones **Solicitar una cita**, **Llamar** y **WhatsApp**, tarjetas de horario, dirección (con enlace «Cómo llegar»), teléfono, WhatsApp y correo, servicios, promociones, pasos de la primera visita, formulario, mapa y pie con razón social y RUC. En móvil aparece una barra inferior de acciones rápidas. Solo se muestra lo que está configurado; no se inventa contenido.
- `client/App.tsx`: la página pública se carga bajo demanda y sale del archivo principal.
- `server/settings.ts`, `server/index.ts`, `client/ClinicSettings.tsx`: nuevo dato **WhatsApp** (solo dígitos con código de país) y `/api/publico` devuelve los datos de contacto de la clínica.
- `index.html`: descripción, color de tema y título más adecuados para visitantes.
- `tests/migration.test.ts`: pruebas del WhatsApp y de los datos públicos.

## 2026-11-05 — Versiones del odontograma y selectores claros

- `server/odontogram.ts` (nuevo), `server/clinical.ts`, `server/resources.ts`: `POST /api/clinica/diagnosticos/:id/odontograma/version` crea una versión nueva (con nota) y rechaza si no hay cambios; editar el diagnóstico mantiene la última versión sincronizada; la historia devuelve las versiones de cada diagnóstico y su estado de firma.
- `server/security-migration.ts`: migración aditiva `20261105_odontogram_versions` (tablas `odontograma_versiones` y `odontograma_versiones_piezas`, con la versión 1 de los odontogramas existentes).
- `server/signatures.ts`: la integridad de la firma se calcula sobre la versión del odontograma firmada.
- `server/index.ts`: `/api/opciones` de diagnósticos, planes, tratamientos y evoluciones muestra paciente y fecha.
- `server/diagnose-clinical.ts` (nuevo): diagnóstico de solo lectura de planes y evoluciones.
- `client/App.tsx`: botón «Actualizar odontograma (nueva versión)», visor de versiones con cambios, y firma del diagnóstico desde la historia clínica.
- `tests/migration.test.ts`: pruebas de versiones, edición en el mismo registro y etiquetas de los selectores.

## 2026-11-05 (2ª pasada) — Planes completos, evoluciones visibles

- Diagnóstico con tus datos: los planes y evoluciones estaban bien enlazados; el problema era que los planes se creaban vacíos (5 de 11 sin tratamientos) y se mostraban en listas sueltas.
- `server/clinical.ts`: `GET /api/clinica/catalogo` y `POST /api/clinica/planes/completo` (plan y tratamientos en una transacción, con validación de piezas, descuento y permisos por paciente).
- `client/App.tsx`: asistente «Nuevo plan», planes con tratamientos y evoluciones anidadas, diálogo «Registrar evolución» con cambio de estado y cronología de evoluciones. Se elimina el selector rápido anterior.
- `client/style.css`: estilos de planes, líneas de tratamiento y cronología.
- `tests/migration.test.ts`: pruebas del plan completo (validaciones, permisos, totales y ausencia de planes vacíos).
