# Informe de auditoría — Dentino 2.0.0

Fecha: 2026-11-04 · Alcance de esta pasada: Fase 1 (diagnóstico por lectura de código) y Fase 2 (seguridad, solo cambios que no alteran reglas de negocio).

## 1. Qué se pudo y qué no se pudo verificar

El entorno de trabajo de esta sesión no alcanza MySQL (3307) ni descarga paquetes npm con velocidad útil, y `node_modules` del proyecto es de Windows. Por eso **no se ejecutaron** `npm run typecheck`, `npm test`, `npm run build` ni `npm audit`. Lo único comprobado fue la **sintaxis** de los archivos `server/` y `shared/` con `tsc` (0 errores, antes y después de los cambios).

Ejecútalos tú antes de usar los cambios:

```powershell
cd C:\xampp\htdocs\Dentino
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run db:migrate   # dos veces: debe terminar sin error ambas veces
```

Copia de seguridad del código previo a los cambios: `work/backup-20261104/` (carpeta ignorada por `.gitignore`; no es un respaldo de la base de datos).

## 2. Hallazgos

| # | Sev. | Hallazgo | Estado |
|---|------|----------|--------|
| 1 | Alta | **Comprobantes sin restricción de rol.** El módulo `comprobantes` no es `admin`: cualquier usuario autenticado (incluido «Doctor externo») puede crear y eliminar comprobantes por el CRUD genérico y leer `/api/comprobantes/:id/detalle` (monto, DNI y dirección del paciente). | **Corregido** (2ª pasada): módulo `comprobantes` y `/api/comprobantes/:id/detalle` solo Administrador |
| 2 | Alta | **Sin control de propiedad sobre datos clínicos.** Cualquier rol autenticado lee y edita historia clínica, diagnósticos, planes y citas de todos los pacientes (`/api/clinica/pacientes/:id/historial`, `/api/recursos/*`). | **Corregido** (2ª pasada): permisos por rol y por paciente (ver matriz abajo) |
| 3 | Media | **PIN de autorización guardado en texto plano** (`clean()` solo aplica bcrypt a `contrasena`). No se cambió porque se desconoce el largo de la columna (un hash bcrypt mide 60 caracteres) y ningún flujo verifica el PIN todavía. | **Corregido** (2ª pasada): migración `20261104_pin_hash` y validación de 4–8 dígitos |
| 4 | Media | Login: el tiempo de respuesta delataba si el correo existía, y el límite era solo por IP. | **Corregido** |
| 5 | Media | Sin límite global en `/api`; `/api/auth/me` crea una sesión en BD por cada visitante anónimo. | **Mitigado** (límite 300/min/IP) |
| 6 | Media | `SESSION_SECRET` se validaba después de migrar y no se validaban otras variables. | **Corregido** |
| 7 | Baja | JSON mal formado devolvía 500 en vez de 400/413. | **Corregido** |
| 8 | Baja | Filtros repetidos en la URL (`?estado=a&estado=b`) provocaban error 500; `size` permitía 1000 filas. | **Corregido** (400 y máximo 200) |
| 9 | Baja | La auditoría no guardaba la IP y no registra inicios/cierres de sesión ni accesos denegados. | IP **corregida**; el resto pendiente |
| 10 | Baja | Exportación Excel: el prefijo anti-fórmula no cubría celdas que empiezan con tabulador o retorno. | **Corregido** |
| 11 | Baja | Sin `Referrer-Policy` restrictiva ni `Permissions-Policy`; sin soporte de `trust proxy` (las cookies `Secure` fallan tras un proxy HTTPS). | **Corregido** |
| 12 | Info | `GET /api/caja` crea una caja si no hay abierta (efecto secundario en un GET; solo Administrador). Es el comportamiento documentado. | Sin cambios |
| 13 | Info | `style-src 'unsafe-inline'` se mantiene por los estilos en línea de React. | Evaluar después |
| 14 | A verificar | **Zona horaria.** El pool usa `timezone:'+00:00'`; `antecedentes.ultima_actualizacion` se escribe con `new Date()` (UTC) mientras que `CURRENT_TIMESTAMP`/`CURRENT_DATE` usan la zona del servidor MySQL. Si MySQL corre en hora de Lima habrá 5 h de diferencia. Comprueba con `SELECT @@global.time_zone, @@session.time_zone, NOW(), UTC_TIMESTAMP();` | **Corregido** (2ª pasada): `ultima_actualizacion` usa `NOW()` de MySQL en vez de la hora UTC de Node |

Revisado y **sin problema encontrado**: consultas parametrizadas (los identificadores salen de `shared/modules.ts`, no de la entrada), sin `dangerouslySetInnerHTML`/`innerHTML`/`eval` en el cliente, CSRF y comprobación de origen en métodos no seguros, regeneración y destrucción de sesión, firma de archivos subidos y ruta `ruta_archivo` restringida, `/uploads` con sesión activa y `dotfiles:'deny'`, cálculo de horarios de citas (tolera `HH:mm:ss`), serialización de caja con bloqueo (`FOR UPDATE`) y pagos idempotentes con `clave_pago`.

## 3. Cambios aplicados (Fase 2)

Ver `CHANGELOG.md`. Ningún cambio elimina ni modifica datos; la única migración nueva (`20261104_audit_ip`) agrega la columna `ip` a `dentino_audit`.

## 4. Decisiones que necesito de ti

1. **Permisos por rol** (hallazgos 1 y 2): ¿qué puede hacer cada rol? Propuesta: Comprobantes solo Administrador; Recepcionista ve y gestiona pacientes y citas pero no la historia clínica; Doctor solo pacientes con citas o diagnósticos propios; Doctor externo solo lectura de sus pacientes.
2. **PIN**: ¿se hashea con bcrypt (requiere ampliar la columna) o se deja como está hasta que exista la firma clínica?
3. **Funcionalidades de la Fase 3**: orden sugerido por valor y riesgo — (a) anulación de pagos con motivo y auditoría, (b) configuración de la clínica (razón social, RUC, dirección) para los comprobantes simulados, (c) solicitudes desde el formulario público con límite y *honeypot*, (d) correo con SMTP (necesita tus credenciales), (e) firma con PIN. Emisión electrónica SUNAT y pasarela de pagos requieren proveedor externo.

## 5. Riesgos pendientes

- Sin ejecutar `typecheck`/`test`/`build`, no hay garantía de que los cambios compilen en tu máquina; el respaldo permite revertirlos.
- Los límites de intentos por cuenta (8 fallos/15 min) permiten que un tercero bloquee temporalmente a un usuario conocido; es el costo habitual de esta defensa.
- En producción: HTTPS, `NODE_ENV=production`, usuario MySQL sin permisos de administración, respaldos cifrados fuera del repositorio y `TRUST_PROXY=1` si hay un proxy.

## 6. Segunda pasada (2026-11-04): permisos por rol

Matriz aplicada en el servidor (`server/access.ts`, `server/resources.ts`, `server/clinical.ts`, `server/index.ts`, `server/reports.ts`):

| Recurso | Administrador | Recepcionista | Doctor | Doctor externo |
|---|---|---|---|---|
| Inventario, usuarios, catálogo, distribuidores y laboratorios | Sí | No | No | No |
| Caja: caja del día, pagos de pacientes, estado de cuenta, ingresos y egresos manuales | Sí | **Sí** (desde 2026-11-17) | No | No |
| Caja: anular pagos, historial y detalle de cajas anteriores | Sí | No | No | No |
| Comprobantes: emitir, listar, ver e imprimir | Sí | **Sí** (desde 2026-11-17) | No | No |
| Comprobantes: eliminar y enviar por correo | Sí | No | No | No |
| Pacientes | Todos | Todos | Solo con cita o diagnóstico propio | Igual, solo lectura |
| Historia clínica (diagnósticos, antecedentes, exámenes, planes, tratamientos, evoluciones, arcos, odontograma, historial) | Todo | **No** | Solo de sus pacientes; los diagnósticos y evoluciones que crea van a su nombre y no puede cambiar el autor | Igual, solo lectura |
| Archivos clínicos (`/uploads`) | Todos | No | Solo de exámenes de sus pacientes; puede subir | Igual, sin subir |
| Citas: ver | Todas | Todas | Todas (necesario para agendar) | **Solo las suyas** |
| Citas: crear o cambiar paciente o doctor | Sí | Sí | Solo a su nombre, para pacientes suyos o sin historia clínica | No |
| Reportes | Todos | Pacientes, citas, tratamientos | Citas, tratamientos | Citas (solo las suyas), tratamientos |

Matriz actualizada el 2026-11-17 con los cambios de `AUDITORIA-2.md` (H-01, H-02, M-05, B-01, B-07) y el permiso de cobro de la Recepcionista; el detalle está en `CHANGELOG.md`. Si el paciente ya tiene historia con otro doctor, la primera cita con un Doctor nuevo la crea Recepción o el Administrador.

Notas: el Doctor necesita que el paciente tenga una cita con él antes de registrarle un diagnóstico. Las listas desplegables de pacientes (`/api/opciones/pacientes`) siguen mostrando solo nombres a todos los roles para poder agendar. La interfaz aún muestra botones como «Ver ficha clínica» a Recepcionista; el servidor responde 403 y se debe ocultar en el cliente.

Migración con datos: `20261104_pin_hash` amplía `usuarios.pin_autorizacion` a `VARCHAR(255)` y sustituye los PIN en texto plano por su hash bcrypt. **Respalda MySQL antes de ejecutarla.**

## 7. Tercera pasada: Fase 3, anulación de pagos (6.2 punto 6)

Implementada con la opción «el movimiento sigue visible y marcado como Anulado en su caja original». Pendientes de la Fase 3: configuración de la clínica, solicitudes del formulario público, correo (SMTP), firma con PIN, mapa, reportes por doctor y emisión electrónica/pasarela (requieren proveedor externo).

## 8. Cuarta pasada: Fase 3 (puntos 1, 4 y 5)

Hecho: configuración de la clínica para los comprobantes simulados (sigue siendo simulación sin validez fiscal), mapa configurable y recepción de solicitudes desde el formulario público. Pendiente: aviso por correo al administrador (SMTP), envío de comprobantes por correo, firma con PIN (el PIN ya se guarda con hash), reportes por doctor y exportación PDF en el servidor, ocultar en el cliente los botones que el rol no puede usar, y emisión electrónica/pasarela (requieren proveedor).
