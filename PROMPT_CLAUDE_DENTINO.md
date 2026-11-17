# Prompt para Claude Code — Arreglar, terminar, mejorar y proteger Dentino

> Copia y pega este documento completo como primera instrucción a Claude Code (o cualquier agente de código) trabajando sobre el repositorio `C:\xampp\htdocs\Dentino`. El agente debe leer primero este archivo y luego el código.

---

## 0. Contexto del proyecto

- **Nombre:** Dentino 2.0.0 (sistema de gestión odontológica).
- **Stack:** React 19 + Vite 8 (frontend), Express 5 + TypeScript (backend), MySQL 8 (puerto 3307), Node.js 24+.
- **Idioma de interfaz:** español.
- **Monorepo simple:** `client/`, `server/`, `shared/`, `tests/`, `document/`, `uploads/`, `images/`.
- **Entry points:** `npm run dev` (API 3001 + Vite 5173), `npm run build`, `npm start`.
- **Base de datos:** MySQL local en `127.0.0.1:3307`, base `dentino_db`. Credenciales en `.env` (no versionado).
- **Migraciones:** aditivas e idempotentes en `server/migrate.ts` y módulos `payment-migration.ts`, `service-migration.ts`. Se ejecutan al arrancar la API.
- **Pruebas:** `npm test` ejecuta `tests/migration.test.ts` sobre una base temporal `dentino_validation_*` (requiere MySQL con permisos de CREATE/DROP solo para esa base).
- **Documentación de requisitos:** `document/DENTINO.md` y `document/ESPECIFICACIÓN DE REQUERIMIENTOS FU.md`.
- **README:** `README.md` describe flujos, migraciones, seguridad y verificación.

**No es un proyecto PHP.** La versión PHP fue retirada; no crees archivos PHP ni dependas de Apache para ejecutar Node.

---

## 1. Objetivo

Arreglar las funcionalidades existentes, terminar las que están incompletas o son solo especificaciones, mejorar calidad/UX/performance y reforzar la protección ante ataques (OWASP Top 10) **sin romper los flujos que ya funcionan ni perder datos**.

Prioridad absoluta: **no perder datos de pacientes, historias clínicas, pagos ni archivos médicos**. Toda migración debe ser aditiva e idempotente.

---

## 2. Reglas inmutables (no negociables)

1. **No elimines ni sobrescribas datos reales.** Las eliminaciones de pacientes son lógicas (`archivado=1`); usuarios/tratamientos/distribuidores/laboratorios se desactivan; registros clínicos y comprobantes requieren confirmación.
2. **Migraciones solo aditivas:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` (vía `add()`), `INSERT IGNORE`. Nunca `DROP`, `TRUNCATE` ni `DELETE` masivo en tablas de negocio. Registra la versión en `dentino_migrations`.
3. **Compatibilidad bcrypt PHP:** los hashes `$2y$` se verifican convirtiendo a `$2b$`. No cambies contraseñas existentes ni fuerces re-hash masivo.
4. **Permisos backend independientes del frontend.** Caja, inventario, usuarios, catálogo y configuración solo Administrador. Valida siempre en el servidor.
5. **Consultas parametrizadas.** Prohibido interpolar valores de usuario en SQL (solo identificadores entre backticks con escape de backticks).
6. **Archivos clínicos protegidos:** `/uploads` requiere sesión activa y usuario activo; nunca exponer la carpeta en Apache.
7. **Cookies HttpOnly, SameSite, Secure en producción.**
8. **CSRF obligatorio** en métodos no seguros.
9. **No exponer secretos** (`.env`, backups, dumps SQL, `work/`) en el repositorio ni en logs.
10. **Mantener `npm run typecheck`, `npm test`, `npm run build` y `npm audit --omit=dev` pasando.** Si un test falla por un cambio intencional, actualiza el test solo si el comportamiento nuevo es correcto y documenta la razón.

---

## 3. Cómo arrancar y verificar (comandos exactos)

```powershell
cd C:\xampp\htdocs\Dentino
npm install
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run dev
```

- API: `http://127.0.0.1:3001`, Web: `http://127.0.0.1:5173`.
- MySQL debe estar en puerto 3307 y la base `dentino_db` creada.
- Si MySQL no está disponible, no inventes datos; deja el código listo y documenta cómo levantar MySQL.

---

## 4. Fase 1 — Diagnóstico (haz esto primero)

1. Lee `README.md`, `document/DENTINO.md` y `document/ESPECIFICACIÓN DE REQUERIMIENTOS FU.md`.
2. Ejecuta `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev` y guarda los resultados.
3. Revisa `git status` (si hay git) y no borres cambios del usuario.
4. Identifica:
   - Errores de compilación o tipos.
   - Tests fallidos.
   - Vulnerabilidades de dependencias.
   - Endpoints sin validación o sin permisos.
   - Funcionalidades marcadas como “pendiente”, “por configurar” o “no implementadas”.
5. Produce un informe corto en `AUDIT_REPORT.md` con: hallazgos, severidad, plan.

---

## 5. Fase 2 — Seguridad (OWASP Top 10 + hardening)

Revisa y corrige al menos estos puntos. Marca cada uno como hecho en el informe.

### A. Autenticación y sesiones
- Login con rate limit (ya existe, 20/15min). Considera rate limit por IP+correo y bloqueo temporal progresivo.
- Regeneración de sesión en login (ya existe). Verifica que logout destruya sesión y cookie.
- `SESSION_SECRET` mínimo 32 chars (ya validado). En producción exigir `NODE_ENV=production`.
- Cookies: `httpOnly`, `sameSite`, `secure` en prod (ya). Añadir `__Host-` prefix si es posible.
- Expiración de sesión y limpieza de sesiones expiradas (ya hay cleanup). Verifica que no haya fugas.
- No loguear contraseñas ni tokens.

### B. Autorización
- Revisa cada endpoint en `server/index.ts`, `resources.ts`, `clinical.ts`, `finance.ts`, `reports.ts`, `payments.ts`.
- Asegura que `checkModule` y los routers validen rol en backend (no solo frontend).
- Evita IDOR: un Doctor/Recepcionista no debe poder ver/editar registros de otros (pacientes, citas, planes) si no corresponde. Hoy el CRUD genérico permite a cualquier autenticado leer/escribir módulos no admin. Revisa si eso es deseable; si no, agrega ownership checks.
- `/api/opciones/:module` expone hasta 1000 filas: limita y filtra por rol.

### C. Inyección (SQLi)
- Verifica que todo SQL use parámetros. Revisa `quote()` y concatenaciones dinámicas (`fields.map(quote)`). Asegura que `mod.table`, `mod.pk` provengan solo de `shared/modules.ts` (whitelist), nunca de input.
- `reports.ts`: `kind` se usa como clave de objeto (whitelist). Los filtros añaden columnas hardcoded. OK, pero valida que `req.query.doctor/estado/etc.` se conviertan a número cuando corresponda.
- Busca `eval`, `new Function`, `child_process` con input. (No debería haber.)

### D. XSS
- React escapa por defecto. Busca `dangerouslySetInnerHTML`, `innerHTML`, `document.write`. Si existen, sanitiza o elimina.
- Contenido público (`secciones_pagina`) se renderiza como texto. Si se permite HTML, sanitizar en backend y frontend.
- Excel export: ya previene inyección de fórmulas prefijando `'` (bueno). Verifica CSV si se agrega.

### E. CSRF
- Token en sesión + header `X-CSRF-Token` (ya). Verifica que `/api/auth/login` y `/api/auth/logout` también estén protegidos o exentos correctamente.
- Origin check: permite `APP_ORIGIN` y `http://127.0.0.1:PORT`. En producción, exige HTTPS y valida `APP_ORIGIN`.
- SameSite=Lax puede ser insuficiente para algunos flujos; considera `strict` si no rompe navegación.

### F. Subida de archivos
- Multer: límite 15MB, 1 archivo, extensiones/mimetype (ya). Magic bytes (ya). 
- Añade validación de nombre de archivo (no confiar en `originalname`), escaneo básico, y límite de total de archivos por usuario.
- Evita path traversal en `asset()` y en rutas de archivos. Verifica que `ruta_archivo` solo permita `uploads/examenes/...` (ya validado en `clean`).
- Añade headers `Content-Disposition: attachment` para descargas de archivos clínicos si corresponde, y `X-Content-Type-Options: nosniff` (ya).
- Limita tipos MIME reales y rechaza archivos con doble extensión.

### G. Headers y transporte
- Helmet CSP (ya). Revisa `script-src 'self'` (bien, sin unsafe-eval). `style-src 'unsafe-inline'` (necesario para React? Podría eliminarse con CSS modules; evalúa).
- Añade HSTS, Referrer-Policy, Permissions-Policy (Helmet defaults).
- En producción, fuerza HTTPS (proxy) y `trust proxy`.

### H. Rate limiting y DoS
- Añade rate limit global a `/api` (ej. 100 req/min/IP) y más estricto a login, uploads, reportes/export.
- Limita tamaño de JSON (ya 1mb) y de query params.
- Paginación: `size` máximo 1000; considera 100 por defecto y máximo 200.
- Evita ReDoS en regex de validación (DNI, email, fechas). Usa regex simples.

### I. Manejo de errores
- No filtrar stack traces ni detalles de DB al cliente (ya devuelve mensaje genérico en 500). Verifica que no haya `console.error` con datos sensibles en producción.
- Log estructurado con niveles; no loguear PHI/PII.

### J. Dependencias y supply chain
- `npm audit --omit=dev` y actualiza paquetes con vulnerabilidades.
- Fija versiones (ya en package-lock). Revisa `overrides` (uuid).
- No añadir dependencias innecesarias.

### K. Secretos y configuración
- `.env` no versionado (ya en .gitignore). Añade validación de todas las variables al arrancar (DB_*, SESSION_SECRET, APP_ORIGIN, PORT).
- En producción, exige `NODE_ENV=production`, HTTPS origin, usuario MySQL con permisos limitados (no root).
- No uses `root` en producción; documenta creación de usuario con permisos mínimos.

### L. Datos sensibles (PHI)
- Los archivos médicos y datos de pacientes son sensibles. Asegura cifrado en reposo a nivel de disco (documenta) y acceso mínimo.
- Backups fuera del repo y cifrados.
- Auditoría de cambios (ya existe `dentino_audit`). Asegura que registre usuario, módulo, registro, acción, fecha, e IP si es posible.

---

## 6. Fase 3 — Funcionalidades (arreglar y terminar)

### 6.1 Flujos ya implementados (no romper)
Auth, usuarios/roles/especialidades/turnos, pacientes (búsqueda, edición, archivo, historia clínica), agenda (día/semana/mes, validación de horarios), diagnósticos y odontograma adulto/infantil, exámenes con PDF/imagen, planes de tratamiento con recálculo, pagos por servicio con prorrateo de descuentos, evoluciones, arcos de ortodoncia, catálogo, inventario con movimientos, caja con cierre automático 24h, comprobantes simulados, reportes con Excel, página pública y promociones, categorías, dashboard.

### 6.2 Pendientes / especificaciones (decidir e implementar o documentar)
Según `README.md` y documentos de requisitos:
1. **Emisión electrónica / SUNAT**: hoy es simulación. Si se implementa, requiere proveedor, certificados, series. Si no, dejar claramente “simulación” y no prometer. **Recomendación:** mantener simulación pero mejorar la vista previa (logo, datos configurables, totales, observaciones) y agregar configuración de empresa (razón social, RUC, dirección, teléfono) en una tabla `configuracion_clinica` (admin), sin inventar datos.
2. **Envío de comprobantes por correo**: no implementado. Implementar con Nodemailer + SMTP configurable, con cola/reintentos y auditoría. O dejar como “pendiente” documentado.
3. **Firma digital / validación clínica con PIN**: el PIN existe en usuarios pero no sustituye firma. Implementar firma de evoluciones/planes con PIN + hash + timestamp, o documentar limitación.
4. **Mapa integrado** en página pública: agregar iframe de Google Maps configurable por admin (URL), sin exponer claves.
5. **Recepción de solicitudes desde formulario público**: hoy no envía. Implementar endpoint `/api/publico/solicitud` con validación, rate limit, honeypot y almacenamiento en tabla `solicitudes_contacto`, notificación por correo al admin.
6. **Devoluciones y anulaciones de pagos**: implementar flujo de anulación de movimiento de caja con motivo, reversión de `monto_pagado` y estado del plan, auditoría fuerte (solo admin, con confirmación). No borrar, marcar `Anulado`.
7. **Cobros bancarios externos / pasarela**: no implementado. Si se agrega, usar webhook verificado y idempotencia.
8. **Reportes adicionales**: filtrar por doctor en ingresos, exportar PDF server-side (o mantener imprimir del navegador). Mejorar filtros.
9. **Contenido público admin**: se retiró la sección admin. Si se quiere editar contenido público, restaurar CRUD admin sobre `secciones_pagina` y `promociones` (ya existen en recursos si se exponen). Verifica que `promociones` y `secciones_pagina` estén en `modules` (sí, secciones no está en modules; promociones sí). Considera agregar módulo `contenido` admin.
10. **Usuarios: ficha personal/laboral** (`UserDetail.tsx`) verificar que no muestre contraseña/PIN (ya excluidos). Añadir impresión/PDF.

### 6.3 Bugs a buscar y corregir
- **Timezone:** `db.ts` usa `timezone:'+00:00'` y `dateStrings:true`. Verifica que fechas/horas se guarden y muestren en hora local (Perú, UTC-5). El cierre automático usa `CURRENT_TIMESTAMP`. Revisa inconsistencias.
- **Slots de citas:** `clinical.ts` `slots()` calcula disponibilidad con `minutes(c.hora)+c.duration`. Verifica que `c.hora` sea string `HH:mm:ss` o `HH:mm`. Podría fallar si viene con segundos.
- **Odontograma infantil:** selección automática cuando diagnóstico solo tiene piezas infantiles (README). Verifica lógica.
- **Descuentos prorrateados:** centavos (ya testeado). Revisa redondeo en reportes.
- **Caja 24h:** `automaticCash` reutiliza caja abierta. Verifica concurrencia (FOR UPDATE) y que no se creen cajas duplicadas.
- **Uploads:** verificar que `fs.mkdirSync` de `uploads/examenes` no falle en producción (permisos).
- **SPA fallback:** `app.get('/{*path}')` sirve index.html; verifica que no exponga archivos sensibles.
- **`/api/health`** no requiere auth (correcto para healthcheck). Asegura que no exponga info.

### 6.4 Mejoras de UX/accesibilidad
- Añadir `aria-label`, foco visible, navegación por teclado en modales.
- Validación en cliente con mensajes claros (ya hay algunos).
- Estados de carga y error consistentes.
- Responsive: probar móvil.
- Internacionalización de fechas/números (es-PE).

---

## 7. Fase 4 — Calidad, tests y observabilidad

1. **TypeScript strict** (ya activo). Elimina `any` donde sea razonable; especialmente en `resources.ts` y `clinical.ts`.
2. **Tests:**
   - Mantén `tests/migration.test.ts` pasando.
   - Añade tests unitarios para `serviceBalances`, `money`, `positiveId`, `clean` (validación).
   - Añade tests de seguridad: auth, CSRF, permisos, path traversal, upload inválido.
   - Añade test de regresión para cada bug corregido.
3. **Lint/format:** considera añadir ESLint + Prettier y script `lint`. (Opcional pero recomendado.)
4. **Logging:** añadir middleware de request logging sin PHI; usar `pino` o `morgan` con formato JSON.
5. **Métricas/health:** `/api/health` con estado de DB y migraciones.
6. **Documentación:** actualizar `README.md` con cambios, variables nuevas y procedimientos de deploy.

---

## 8. Criterios de aceptación (checklist final)

- [ ] `npm run typecheck` sin errores.
- [ ] `npm test` pasa (base temporal creada y eliminada).
- [ ] `npm run build` genera `dist/` y `dist-server/`.
- [ ] `npm audit --omit=dev` sin vulnerabilidades críticas/altas (o documentadas).
- [ ] Login/logout funcionan; sesión se regenera y destruye.
- [ ] CSRF protege todos los POST/PUT/DELETE.
- [ ] Roles se validan en backend (recepcionista no accede a caja/usuarios).
- [ ] Subida de archivo inválido se rechaza; archivo válido se sirve solo con sesión.
- [ ] No hay SQL injection ni XSS en pruebas manuales (intentar `' OR 1=1 --`, `<script>`).
- [ ] Path traversal en `/uploads/../../` bloqueado.
- [ ] Caja: pago duplicado idempotente; sobrepago rechazado; cierre automático 24h funciona.
- [ ] Plan: recálculo de costo y validación de saldo pagado.
- [ ] Inventario: salida no deja stock negativo.
- [ ] Reportes Excel sin inyección de fórmulas.
- [ ] Migraciones idempotentes (correr `npm run db:migrate` dos veces sin error).
- [ ] No se pierden datos al migrar.
- [ ] README actualizado.

---

## 9. Formato de entrega

Al terminar, entrega:
1. `AUDIT_REPORT.md` con hallazgos y acciones.
2. `CHANGELOG.md` (o sección en README) con cambios por fase.
3. Lista de comandos ejecutados y resultados.
4. Riesgos pendientes y siguientes pasos recomendados.
5. Si algún item no se pudo completar (por falta de MySQL, SMTP, etc.), documentar claramente con instrucciones para el usuario.

---

## 10. Notas finales para el agente

- Trabaja en ramas/commits pequeños si hay git; si no, haz cambios incrementales y verifica después de cada bloque.
- No modifiques `.env` real ni bases de datos de producción. Usa la base de validación para tests.
- Ante la duda sobre un flujo de negocio, **pregunta al usuario** antes de cambiar reglas (especialmente pagos, descuentos, cierre de caja).
- Prioriza seguridad y no pérdida de datos sobre nuevas features.
- Mantén la interfaz en español y el estilo Bento existente.

---

**Fin del prompt.**
