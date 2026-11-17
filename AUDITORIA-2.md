# Auditoría 2 — Dentino 2.0.0

Fecha: 2026-11-17 · Tipo: auditoría de solo lectura (no se modificó código ni datos). Método: lectura completa de `server/`, `shared/` y partes relevantes de `client/`, grafo con graphify, agente `security-auditor` (OWASP) y agente `code-reviewer` (lógica de negocio). Cada hallazgo de los agentes se contrastó con el código antes de incluirlo.

## 1. Resumen ejecutivo

1. Los chequeos automáticos pasan: typecheck, 2/2 pruebas, `npm audit` sin vulnerabilidades y build correcto.
2. No hay inyección SQL, XSS ni filtración de contraseñas o PIN. Las correcciones de la auditoría anterior siguen en pie.
3. Lo más grave es de control de acceso: un **Doctor puede darse acceso a la historia clínica de cualquier paciente** creando una cita a su nombre (H-01). Además puede **apropiarse de diagnósticos y evoluciones ajenos y firmarlos** (H-02).
4. En la lógica de negocio hay huecos de integridad en comprobantes (se pueden editar y su número se reutiliza), en citas (vuelven a ocupar un horario sin validarlo), en planes que pasan a otro paciente y en registros que cuelgan de otros ya firmados.
5. No pude consultar el esquema real de MySQL (permiso denegado). Las FK, los índices únicos y la zona horaria quedan en «A verificar», con la consulta para comprobarlos.

## 2. Chequeos automáticos (salida real)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | `tsc --noEmit && tsc -p tsconfig.server.json --noEmit` → **EXIT 0**, sin errores |
| `npm test` | `✔ Reparto de descuentos estable y exacto hasta el centavo` · `✔ Flujos de Dentino sobre una base aislada: auth, permisos, clínica, caja, inventario y reportes (9032 ms)` → **tests 2, pass 2, fail 0** |
| `npm audit --omit=dev` | **found 0 vulnerabilities** |
| `npm run build` | typecheck OK · `vite v8.3.4 ✓ 1930 modules transformed ✓ built in 1.04s` · `tsc` del servidor OK → **EXIT 0** |
| `npm outdated` | Solo versiones menores o de parche: vite 8.3.8, nodemailer 10.6.0, express-rate-limit 8.7.4, mysql2 3.24.6, react 19.3.1, dotenv 18.0.10, lucide-react 1.74.0 |

**graphify:** 464 nodos, 1322 aristas y 28 comunidades en `graphify-out/` (`graph.html`, `GRAPH_REPORT.md`). Encontró ciclos de importación entre `access.ts`, `resources.ts`, `clinical.ts` y `signatures.ts`. Funcionan porque el uso es diferido, pero conviene sacar `fail`/`HttpError` a un módulo propio.

## 3. Mapa de endpoints

Middleware común en orden: helmet, límite de 300/min por IP en `/api`, JSON de 1 MB, sesión, CSRF y comprobación de origen en métodos que no son GET, y desde `index.ts:47` sesión obligatoria con revalidación de estado y rol.

| Método y ruta | Rol requerido | Validaciones o alcance |
|---|---|---|
| GET `/api/health`, `/api/publico`, `/api/auth/me` | Público | — |
| POST `/api/publico/solicitud` | Público + CSRF | 5/h por IP, campo trampa, longitudes |
| POST `/api/auth/login` · `/logout` | Público + CSRF | 20/15 min por IP, 8/15 min por cuenta, bcrypt, `regenerate` |
| GET `/api/opciones/:module` | Autenticado; Recepcionista sin módulos clínicos; módulos admin salvo lista blanca | Alcance por doctor salvo `pacientes` |
| GET `/api/comprobantes/:id/detalle` | Administrador | — |
| GET `/api/modulos`, `/api/dashboard` | Autenticado | El Doctor ve solo sus citas del día |
| POST `/api/archivos` | **Cualquier rol** | Extensión, MIME, firma del contenido, 15 MB, 40/10 min |
| GET `/uploads/*` | **Cualquier sesión activa** | `dotfiles:deny`, `nosniff` |
| `/api/configuracion` GET y PUT, `/api/correo/*` | Administrador | Expresiones regulares por campo |
| POST `/api/firma/pin` | Autenticado | Contraseña de la cuenta y 8 intentos/15 min |
| POST y GET `/api/firma/:module/:id` | Firma: Doctor autor del registro; lectura: `assertAccess` | PIN bcrypt |
| POST `/api/clinica/citas/:id/estado` | Todos menos Doctor externo | Sin alcance por doctor |
| GET `/api/clinica/agenda` | Autenticado | El Doctor ve solo sus citas; rango de 62 días |
| GET `/api/clinica/citas/horarios` | Autenticado | — |
| GET `/api/clinica/diagnosticos/:id/odontograma`, `/pacientes/:id/historial` | `patientAccess` | Recepcionista: 403 |
| GET `/api/clinica/catalogo` | Todos menos Recepcionista | — |
| POST `/api/clinica/planes/completo` y `/diagnosticos/:id/odontograma/version` | Administrador o Doctor | `assertAccess` sobre el diagnóstico |
| POST `/api/clinica/inventario/:id/movimiento` | Administrador | `FOR UPDATE`, sin stock negativo |
| `/api/caja/*` (GET, detalle, movimiento, pagos y anulación de pacientes) | Administrador | Centavos, `clave_pago`, `FOR UPDATE` |
| GET `/api/reportes/:kind` | ingresos, inventario, planes y doctores: Administrador; pacientes: Administrador y Recepcionista; citas y tratamientos: todos | 60/min, rango de fechas |
| `/api/recursos/:module[/:id]` (GET, meta, POST, PUT, DELETE) | `checkModule`: admin, clínico y solo lectura del Doctor externo | `clean()`, `assertAccess`, `assertUnsigned` |

## 4. Hallazgos

| ID | Sev. | Título | Archivo:línea | Cómo reproducirlo | Impacto | Corrección propuesta | Esfuerzo |
|---|---|---|---|---|---|---|---|
| H-01 | **Alta** · **Corregido** (`assertCanSchedule`, regla: «solo pacientes suyos o nuevos, a su nombre») | Un Doctor se da acceso a cualquier paciente creando o reasignando una cita | `server/access.ts:8`, `:18`; `server/resources.ts:64`, `:71-74`; `server/clinical.ts:15` | Como Doctor (id 7): `POST /api/recursos/citas {"id_paciente":42,"id_doctor":7,"fecha":"2020-01-01","hora":"08:00","estado":"Cancelada"}` devuelve 201 (al estar `Cancelada` no se valida el horario). Después `GET /api/clinica/pacientes/42/historial` devuelve 200 con toda la historia. Otra vía: `PUT /api/recursos/citas/:id` sobre una cita ajena cambiando `id_doctor`. | Anula el aislamiento por paciente (hallazgo 2 de la auditoría anterior): lectura, edición y borrado de datos clínicos de cualquier paciente | Para el rol Doctor: en POST y PUT de `citas`, `id_doctor` debe ser el propio usuario y no se puede cambiar en citas ajenas. En `own`, excluir citas `Cancelada`, `No asistió` y `Reprogramada` | Bajo |
| H-02 | **Alta** · **Corregido** (`assertAuthor`, regla: «autor fijo, edición compartida») | Un Doctor puede apropiarse de diagnósticos y evoluciones ajenos y firmarlos | `server/resources.ts:20` (`id_doctor` no es de solo lectura), `:72`, `:80`; `server/access.ts:38-45`; `server/signatures.ts:110` | Doctor A, con acceso al paciente: `PUT /api/recursos/diagnosticos/15 {"id_doctor":A,...}` sobre un diagnóstico sin firmar del Doctor B, y luego `POST /api/firma/diagnosticos/15 {"pin":...}` devuelve 200. También puede hacer `DELETE` o `POST /api/recursos/evoluciones` con el `id_doctor` de otro doctor. | Suplantación del autor clínico y de la firma; edición y borrado de trabajo ajeno | En `diagnosticos` y `evoluciones`, para el Doctor: fijar `id_doctor` al usuario al crear e impedir que cambie al editar. Editar o borrar solo si `old.id_doctor` es el usuario (salvo Administrador) | Bajo |
| M-01 | Media · **Corregido** | Una cita «No asistió» o «Reprogramada» vuelve a ocupar su horario sin validarlo | `server/clinical.ts:25-26` | Marcar la cita A de las 09:00 como `No asistió`, agendar B a las 09:00 con el mismo doctor y luego `POST /api/clinica/citas/A/estado {"estado":"Confirmada"}`: A y B quedan solapadas. Tampoco se impide marcar `Atendida` una cita futura ni se exige que la cita sea del doctor que hace el cambio. | Solapamientos en la agenda | Si el estado de origen libera el horario, llamar a `validateAppointment`. Definir una tabla de transiciones válidas | Bajo |
| M-02 | Media · **Corregido** (PUT 405) | Los comprobantes se pueden editar por el CRUD genérico | `server/resources.ts:71-78` (las validaciones de `:67` solo corren en el POST) | Administrador: `PUT /api/recursos/comprobantes/:id {"serie":"F001","tipo_comprobante":"Factura"}` duplica un correlativo existente. `{"id_movimiento":<pago anulado o que ya tiene comprobante>}` también se acepta. | Numeración duplicada, comprobante de un pago anulado, dos comprobantes para un mismo pago | Devolver 405 en el PUT de `comprobantes` (o permitir solo campos no fiscales) y ocultar «Editar». Índices `UNIQUE(tipo_comprobante,serie,correlativo)` y `UNIQUE(id_movimiento)` (ver V-03) | Bajo |
| M-03 | Media · **Corregido** | Un plan, o un diagnóstico, con pagos se puede pasar a otro paciente | `server/resources.ts:20`, `:72-73` | `PUT /api/recursos/planes/:id {"id_diagnostico":<diagnóstico de otro paciente>}` o `PUT /api/recursos/diagnosticos/:id {"id_paciente":...}` | `caja_movimientos.id_paciente` queda apuntando al paciente anterior. El estado de cuenta muestra «pagado anterior» y la anulación responde 400 | Hacer `id_diagnostico` (en planes) e `id_paciente` (en diagnósticos) de solo lectura al editar, o permitir el cambio solo si no hay pagos | Bajo |
| M-04 | Media · **Corregido** (se pueden agregar, no editar ni borrar) | Los registros que cuelgan de uno firmado siguen siendo editables; la integridad de la firma puede dar un falso negativo | `server/resources.ts:72`, `:80` (solo se mira la firma del propio registro); `server/signatures.ts:83-85`; `server/clinical.ts:76` | (a) Crear, editar o borrar `examenes` de un diagnóstico firmado y `arcos` de una evolución firmada: no hay 409. (b) Firmar un diagnóstico sin odontograma (sin versiones) y luego `POST .../odontograma/version`: `GET /api/firma/diagnosticos/:id` devuelve `integro:false`. Agregar versiones a un diagnóstico firmado está permitido por diseño (README). | El contenido clínico ligado a una firma cambia sin quedar bloqueado; alarma de integridad falsa | En el CRUD, comprobar la firma del padre en `examenes` y `arcos`. Al firmar sin versión, crear antes la versión base (`ensureBaseline`) | Bajo-medio |
| M-05 | Media · **Corregido** (Doctor externo: solo sus citas) | El Doctor externo, y el Doctor, ven todas las citas de la clínica con su motivo (regla a confirmar) | `server/resources.ts:53-61` (sin alcance para `citas`); `server/reports.ts:22` | Como Doctor externo: `GET /api/recursos/citas?size=200` o `GET /api/reportes/citas?format=xlsx`. La agenda (`clinical.ts:36`) y el panel (`index.ts:59`) sí limitan a sus citas. | Exposición de pacientes y motivos de consulta a un tercero; criterio distinto entre pantallas | Decidir la regla. Si se limita, aplicar `id_doctor = usuario` en listado, `GET :id` y reporte | Bajo |
| M-06 | Media · **Corregido** (reproducido en la prueba) | Carrera entre anular un pago y emitir su comprobante | `server/payments.ts:50`, `:56` | Emitir el comprobante y anular el mismo movimiento a la vez. La lectura sin bloqueo de `:50` fija la instantánea (REPEATABLE READ) y `:56` no ve el comprobante confirmado, así que el pago queda anulado con comprobante. **Plausible**: deducido del código, no reproducido. | Pago anulado con comprobante vigente | `SELECT ... FOR SHARE` en `:56`, o tomar el mismo candado que el POST de comprobantes | Bajo |
| M-07 | Media · **Corregido** (sin duplicados; anular movimientos manuales sigue pendiente) | Los movimientos manuales de caja no tienen idempotencia ni anulación | `server/finance.ts:90`; `client/Cash.tsx:5` (sin guard con `useRef`); `server/payments.ts:51` | Un doble clic o un reintento de red en «Registrar movimiento» crea dos ingresos o egresos. Solo se pueden anular pagos vinculados a un plan. | Saldo de caja incorrecto que solo se corrige tocando la base | Clave de idempotencia, guard con `useRef` y anulación con motivo para los movimientos manuales | Medio |
| M-08 | Media · **Corregido** (script movido a work/retirados/) | Script que vuelca la base entera sin cifrar | `server/backup-payments.ts:3-4` | `npx tsx server/backup-payments.ts` escribe en una ruta personal fija un JSON con `SELECT *` de todas las tablas, incluidos hashes de contraseña y PIN, y `dentino_sessions` con sesiones vivas | Copia de credenciales y sesiones fuera de la base | Retirar el script o excluir esas tablas y cifrar el archivo; borrar las copias antiguas | Bajo |
| B-01 | Baja · **Corregido** (archivos por examen; subida solo Administrador y Doctor; los archivos sin enlazar no se limpian) | `/uploads` no comprueba rol ni paciente, y cualquier rol puede subir archivos | `server/index.ts:67`, `:70`; `server/resources.ts:40` | Cualquier sesión activa (también Recepcionista) abre `/uploads/examenes/<uuid>.pdf` si conoce la ruta. El Doctor externo puede subir 40 archivos de 15 MB cada 10 minutos; los archivos nunca se borran. Los nombres son UUID, así que no se pueden adivinar. | Defensa en profundidad incompleta; posible llenado del disco | Servir por `/api/examenes/:id/archivo` con `assertAccess`, bloquear la subida a Doctor externo y Recepcionista, y limpiar los archivos que no se enlacen | Medio |
| B-02 | Baja · **Corregido** | Cambiar la contraseña no cierra sesiones; `/api/auth/me` devuelve un usuario obsoleto | `server/resources.ts:41`, `:78`; `server/index.ts:40` | Una sesión robada sigue funcionando hasta 8 h tras el cambio de contraseña. `/auth/me` devuelve el usuario de la sesión aunque esté desactivado (las rutas de datos sí devuelven 401). | Ventana de uso de una sesión comprometida | Guardar en la sesión una versión de la contraseña y compararla en el middleware; revalidar en `/auth/me` | Bajo |
| B-03 | Baja · **Corregido** | La agenda acepta fechas imposibles y se salta el límite de 62 días | `server/clinical.ts:33-34` | `GET /api/clinica/agenda?inicio=2000-01-01&fin=2099-13-01`: `Date.parse` devuelve NaN y `NaN>62` es falso. El resultado depende de cómo MySQL compare la cadena (A verificar). | Consulta sin límite de tamaño | Rechazar las fechas que dan `NaN`, igual que `clean()` | Bajo |
| B-04 | Baja · **Corregido** (contador que no retrocede) | Borrar el último comprobante reutiliza su número | `server/resources.ts:67`, `:81`; `server/payments.ts:56` (pide borrar para anular) | Borrar B001-5 y emitir otro: vuelve a salir B001-5 | Numeración no correlativa (hoy es una simulación) | Anulación lógica del comprobante en vez de DELETE | Medio |
| B-05 | **Reclasificado a Info, sin cambios**: `automaticCash` solo se alcanza desde rutas que exigen Administrador, así que siempre existe la fila que se bloquea, y el temporizador de cierre no se ejecuta dos veces a la vez | El candado de caja y comprobantes depende de la fila del primer Administrador | `server/automatic-cash.ts:10`; `server/resources.ts:67` | Si no hay ningún usuario Administrador, el `FOR UPDATE` no bloquea nada y dos peticiones pueden abrir dos cajas o repetir un correlativo | Cajas duplicadas o correlativo repetido en un caso límite | `GET_LOCK('dentino_caja')` o una tabla de candado de una sola fila | Bajo |
| B-06 | **Descartado (falso positivo)**: el servidor ya devolvía 409; se agregó una prueba de regresión | Se puede poner un descuento del plan mayor que su costo | `server/resources.ts:73`; `server/clinical.ts:16` | `PUT /api/recursos/planes/:id {"descuento_aplicado":9999}` en un plan sin pagos: se acepta y `estado_pago` pasa a «Cancelado» con 0 pagado (`planes/completo` sí lo impide) | Estado de pago incoherente | Validar `0 ≤ descuento ≤ costo_total` | Bajo |
| B-07 | Baja · **Corregido** (solo Administrador) | Distribuidores y laboratorios los pueden editar Recepcionista y Doctor (regla a confirmar) | `shared/modules.ts:16-17` (sin `admin`) | Como Doctor: `PUT /api/recursos/distribuidores/1` | El requisito (`document/DENTINO.md`) dice «editar solo con PIN de admin» | Marcar `admin:true` o pedir el PIN del administrador | Bajo |
| B-08 | Baja · **Corregido** | El cobro se queda bloqueado si la app se sirve por HTTP fuera de localhost | `client/PatientPayments.tsx:22` | `crypto.randomUUID()` no existe en un contexto no seguro: lanza una excepción fuera del `try`, después de `inFlight.current=true`, y el botón queda bloqueado sin mensaje (A verificar) | Cobro imposible y sin aviso | Generar la clave dentro del `try` (y servir siempre por HTTPS) | Bajo |
| I-01 | Info | Los límites de intentos se guardan en memoria | `server/index.ts:35`, `:43-44`; `server/signatures.ts:91` | Se reinician con cada arranque y no se comparten entre procesos | — | Store en MySQL si hay varias instancias | Bajo |
| I-02 | Info | La CSP permite `img-src https:` | `server/index.ts:34` | Se pueden cargar imágenes de cualquier dominio | — | Limitar a los dominios que se usen de verdad | Bajo |
| I-03 | Info | Los índices de fecha no se usan porque las consultas filtran con `DATE(c.fecha)` | `server/index-migration.ts:5`; `server/clinical.ts:38`; `server/reports.ts:22` | — | Rendimiento | Filtrar con `c.fecha >= ? AND c.fecha < ?` | Bajo |
| I-04 | Info | El contador `plans` del panel cuenta los planes de toda la clínica | `server/index.ts:60` | — | Revela poca información | Aplicar el alcance por doctor | Bajo |
| I-05 | Info | Ciclos de importación en el servidor | `access.ts`, `resources.ts`, `clinical.ts`, `signatures.ts` | — | Riesgo de errores de inicialización | Mover `fail`/`HttpError` a `server/errors.ts` | Bajo |

### A verificar (no confirmado; no se cuenta como hallazgo)

| ID | Qué | Por qué no se pudo confirmar | Cómo verificarlo |
|---|---|---|---|
| V-01 | Editar una cita desde la interfaz sin cambiar la hora daría 400 «Hora inválida» | El formulario (`client/Resources.tsx`, `RecordForm`) carga `hora` sin recortar. Si la columna es `TIME`, llega `'08:00:00'`, y `clean()` exige `HH:mm` (`resources.ts:37`). Ninguna prueba hace un PUT de citas. | Editar el motivo de una cita en la interfaz, o `SHOW CREATE TABLE citas` |
| V-02 | Borrar un detalle o un diagnóstico sin firmar arrastraría evoluciones firmadas si las FK son `CASCADE` | No tuve permiso para leer el esquema | `SELECT TABLE_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_NAME,DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='dentino_db';` |
| V-03 | Índices únicos en `comprobantes` (serie y correlativo, `id_movimiento`) | Igual que V-02 | `SHOW CREATE TABLE comprobantes;` |
| V-04 | Zona horaria de MySQL: `CURRENT_DATE` en el panel y las citas «de hoy» | Si MySQL está en UTC, a partir de las 19:00 de Lima ya es el día siguiente. Las comparaciones de caja se hacen enteras en MySQL y son coherentes. | `SELECT @@global.time_zone, @@session.time_zone, NOW(), UTC_TIMESTAMP();` |

## 5. Revisado y correcto

- **Correcciones de la auditoría anterior:** siguen bien los puntos 1 (comprobantes solo Administrador), 3 (PIN con bcrypt), 4 (tiempo de login constante con `dummyHash` y límite por cuenta), 6 (variables de entorno), 7 y 8 (400/413 y filtros repetidos), 9 (eventos de sesión y 403 en la auditoría), 10 (prefijo anti-fórmula en Excel), 11 (cabeceras y `trust proxy`) y 14 (`ultima_actualizacion` con `NOW()`). El punto 2 está bien implementado, pero H-01 lo salta.
- **SQL:** todas las consultas usan parámetros. Los identificadores salen de `shared/modules.ts` o de `information_schema`, y `quote()` escapa los acentos graves. `ORDER BY` usa solo la clave primaria. `LIMIT` y `OFFSET` van como parámetros, con un máximo de 200. Los filtros solo aceptan nombres de `safeFields` y valores de tipo string. Los filtros de reportes y las columnas del odontograma salen de listas fijas.
- **Sesión:** `regenerate` al iniciar sesión y `destroy` al cerrarla. Cookie `httpOnly`, `sameSite=lax`, `secure` y prefijo `__Host-` en producción. CSRF y comprobación de origen en métodos que no son GET. En cada petición se revalida el estado y el rol, así que un usuario desactivado recibe 401 de inmediato.
- **Contraseñas y PIN:** bcrypt con coste 12 y 10 y compatibilidad con `$2y$`. Nunca se devuelven: `safeFields` los excluye de listados, filtros y búsqueda, y el login borra `contrasena`. El PIN se cambia solo confirmando la contraseña, con límite de intentos. `reset-password.ts` oculta lo que se escribe y guarda solo el hash, con auditoría.
- **Subida de archivos:** nombre UUID; extensión, MIME y firma del contenido; 15 MB y un solo archivo. `express.static` evita el path traversal. `ruta_archivo` se valida con una expresión regular estricta. `/uploads` exige sesión.
- **XSS:** no hay `dangerouslySetInnerHTML` ni `innerHTML`. La URL del mapa se limita a Google Maps embed y `frame-src` lo restringe. ExcelJS escribe texto y pdfkit solo dibuja texto.
- **Pagos:** montos en centavos con hasta dos decimales; `FOR UPDATE` sobre el plan (dos pagos simultáneos no sobrepagan); `clave_pago` con índice único y 409 si se reutiliza con otros datos; rechazo de planes abandonados; reparto exacto del descuento con BigInt y mayores restos; `recalculatePlan` y `validateServicePayments` impiden quedar por debajo de lo pagado; anulación lógica con motivo y recálculo de la caja cerrada. El cliente evita el doble envío del cobro con `useRef` y reutiliza la clave al reintentar.
- **Caja:** el cierre automático y su comparación de fechas se hacen enteros en MySQL; el temporizador no se ejecuta dos veces a la vez.
- **Citas:** el `FOR UPDATE` sobre el doctor serializa la validación de solapamientos; los turnos y la duración por categoría se respetan.
- **Inventario:** `FOR UPDATE`, sin stock negativo, `stock_actual` de solo lectura y movimientos solo de Administrador.
- **Firmas:** PUT y DELETE de diagnósticos y evoluciones firmados devuelven 409; firma solo del doctor autor; hash SHA-256 con detección de alteraciones directas en la base.
- **Migraciones:** cada una tiene su marcador en `dentino_migrations` y comprueba antes de alterar. Son aditivas y no borran datos. `pinHash` no vuelve a hashear (`NOT LIKE '$2%'`).
- **Errores:** los 500 devuelven un mensaje genérico y en el log queda solo el código. No hay secretos en el código; el servidor escucha solo en `127.0.0.1`.
- **Dependencias:** `npm audit` limpio. exceljs 4.4.0 no publica versiones desde 2024-12, pero `uuid` está forzado con un override.

## 6. Qué no pude verificar y por qué

- **Esquema real de MySQL** (FK, índices, tipos y zona horaria): el modo automático denegó incluso un SELECT de solo lectura sobre `dentino_db`. Ver V-01 a V-04.
- **Reproducción dinámica de H-01, H-02, M-01 a M-06:** están demostrados por lectura de código, no ejecutados. Para ejecutarlos habría que agregar pruebas a `tests/`, y eso queda para la fase de corrección (una prueba que falle antes y pase después).
- **Interfaz en el navegador:** no se probó visualmente; el cliente se revisó leyendo el código.
- **Migración desde el esquema PHP original:** la prueba clona el esquema ya migrado, así que no lo cubre.

## 7. Despliegue a producción (pendiente)

- HTTPS delante de Node, con `TRUST_PROXY=1` y `NODE_ENV=production`: activa la cookie `__Host-` con `secure` y exige `APP_ORIGIN` con https. B-08 también lo requiere.
- Usuario MySQL dedicado sin privilegios de administración (hoy es `root`). La prueba necesita un usuario aparte con permiso para crear bases `dentino_validation_*`.
- Respaldos cifrados y programados de MySQL y de `uploads/`, fuera del servidor. Retirar `backup-payments.ts` (M-08).
- Rotar `SESSION_SECRET`, usar un gestor de procesos (pm2 o servicio de Windows) y llevar los logs a un archivo.
- Si hay más de una instancia: límites de intentos en un almacén compartido (I-01) y una sola instancia para el temporizador de caja y la cola de correo.
