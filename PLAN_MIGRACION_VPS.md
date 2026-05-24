# Plan de migración — Vercel + Supabase → VPS + SQLite

> Documento de guía viva, en línea con `PLAN.md`. Reordena lo que queda del plan de producto (Bloques 10-12) introduciendo antes los **bloques de migración** (M1..M9), porque la decisión de stack afecta de forma directa al Bloque 10 (autenticación) y a futuras decisiones.
>
> Cada bloque incluye un **prompt pegable para Claude Code** al final.

---

## Contexto y objetivo

- **Estado actual**: Next.js + TypeScript desplegado en Vercel Hobby. Base de datos en Supabase (Postgres). Bloques 1-9 del plan de producto completados. Bloque 10 (auth) sin empezar.
- **Objetivo**: pasar a un VPS dockerizado con SQLite local, Kamal como herramienta de despliegue, y servicios externos mínimos. La meta es **una sola instancia por cliente, una pieza de infraestructura, un solo recibo**, alineado con el modelo de pago único y el plan de onboarding.
- **Por qué ahora**: el Bloque 10 introduce el sistema de autenticación. Hacerlo sobre Supabase Auth y migrarlo después es trabajo duplicado. Mejor migrar primero y construir el Bloque 10 ya sobre el stack final.

---

## Decisiones de stack (justificadas)


| Pieza                                           | Elección                                                 | Por qué                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Hosting                                         | **Hetzner Cloud** (CX22, ~4,5€/mes)                      | Coste mínimo, ubicación europea (Falkenstein/Helsinki), API decente para automatizar el onboarding después.                       |
| Base de datos                                   | **SQLite** vía `better-sqlite3` en modo WAL              | Una pieza menos. Volumen de una peluquería es trivial. Disco persistente del VPS.                                                 |
| ORM                                             | **Drizzle ORM**                                          | TypeScript-first, ligero, migraciones explícitas y editables, excelente soporte SQLite. Reemplazo limpio del cliente de Supabase. |
| Auth                                            | **Auth.js v5** (antes NextAuth) con adaptador Drizzle    | Solución autocontenida, sin dependencia de Supabase Auth. Credenciales (email+password) + sesiones DB.                            |
| Email transaccional                             | **Resend** (3.000 emails/mes gratis)                     | Más simple que SES, DX excelente, suficiente para el volumen agregado de todos los clientes a tu cargo.                           |
| Storage de imágenes (logos, fotos de empleados) | Sistema de ficheros del VPS, montado como volumen Docker | Volumen ridículo. Cero servicio externo.                                                                                          |
| Despliegue                                      | **Kamal 2**                                              | Ya lo conoces de tu trabajo con Rails. Pensado exactamente para "mi app dockerizada en un VPS que yo controlo".                   |
| Proxy / HTTPS                                   | **kamal-proxy** (incluido en Kamal 2)                    | Let's Encrypt automático. Una pieza menos.                                                                                        |
| DNS                                             | **Cloudflare**                                           | API limpia para automatizar la creación de subdominios en el onboarding. Gratis.                                                  |
| Backups SQLite                                  | **Litestream** → Backblaze B2 (o Cloudflare R2)          | Replicación continua del WAL. Recuperación point-in-time. Coste céntimos.                                                         |
| Uptime                                          | **UptimeRobot** free                                     | 50 monitores gratis, más que suficiente para 15-20 instancias.                                                                    |
| Errores                                         | **Sentry** free                                          | 5.000 errores/mes, suficiente para detectar problemas reales antes que el cliente.                                                |


> Cosas que **deliberadamente no entran** todavía: CDN externo (Next.js standalone sirve assets bien), Redis (no hay nada que cachear que justifique la pieza extra), colas de tareas dedicadas (los pocos jobs son crons de sistema o rutas API protegidas).

---

## Reordenación del plan

```
M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → Bloque 10 → Bloque 11 → Bloque 12
```

- **M1..M4**: migración local (Drizzle + SQLite + storage local + sustitución del cliente Supabase). Se hace en `main` sin tocar producción.
- **M5..M7**: Dockerización, VPS y primer despliegue real.
- **M8..M9**: servicios de soporte (email, backups, monitorización).
- **Bloque 10 (auth)**: ahora sobre el stack definitivo, con Auth.js.
- **Bloques 11 y 12**: cierre del plan original (landing + pulido).

---

## M1 — Drizzle + SQLite conviviendo con Supabase

**Objetivo**: introducir Drizzle como capa de datos en paralelo, sin eliminar nada todavía. Tener el esquema replicado y la conexión funcionando en local.

### Pasos

- Instalar `drizzle-orm`, `drizzle-kit`, `better-sqlite3`, `@types/better-sqlite3`
- Crear `src/db/schema.ts` replicando el esquema actual de Postgres
- Crear `src/db/index.ts` con cliente singleton, **WAL mode activado**
- Configurar `drizzle.config.ts`
- Generar la primera migración con `drizzle-kit generate`
- Scripts en `package.json`: `db:generate`, `db:migrate`, `db:studio`
- Variable de entorno `DATABASE_URL` apuntando a fichero SQLite local (`./data/dev.db`)
- Añadir `data/` al `.gitignore`

### Puntos críticos

- El esquema debe **replicar exactamente** el actual: tipos, nullability, índices, foreign keys. Cualquier divergencia se paga en M2.
- WAL mode no es opcional para concurrencia razonable: `PRAGMA journal_mode = WAL` y `PRAGMA synchronous = NORMAL` en la inicialización del cliente.
- Singleton del cliente para evitar múltiples conexiones por proceso Next.

### Prompt para Claude Code

```text
Contexto: app Next.js 15 con TypeScript que actualmente usa @supabase/supabase-js
para acceder a Postgres. Ya tengo implementados los bloques 1-9 del plan de producto
(modelo de datos, dashboard, reserva pública, notificaciones, enlace mágico, calendario,
panel hoy, estados de reserva, ficha de cliente).

Objetivo: introducir Drizzle ORM como capa de datos en PARALELO al cliente de Supabase
actual. No reemplazar todavía ninguna llamada existente. Quiero que Drizzle quede
funcional y el esquema replicado en SQLite local.

Tareas:
1. Instalar drizzle-orm, drizzle-kit, better-sqlite3, @types/better-sqlite3
2. Inspeccionar el esquema actual (mira los archivos de migraciones SQL, los tipos
   TypeScript generados de Supabase, o pregúntame si no los encuentras)
3. Crear src/db/schema.ts replicando ese esquema con la sintaxis de Drizzle para SQLite.
   Mapear tipos: timestamptz → integer en modo timestamp_ms, uuid → text, jsonb → text con
   modo json, boolean → integer. Mantener nullability, índices y foreign keys exactamente
   igual.
4. Crear src/db/index.ts exportando un cliente Drizzle singleton sobre better-sqlite3.
   Habilitar PRAGMA journal_mode = WAL y PRAGMA synchronous = NORMAL en la inicialización.
   Path del fichero leído de DATABASE_URL (default ./data/dev.db).
5. Crear drizzle.config.ts apuntando a schema.ts y a una carpeta drizzle/ para migraciones.
6. Añadir scripts en package.json: "db:generate" (drizzle-kit generate), "db:migrate"
   (script propio que ejecute migraciones contra el fichero), "db:studio" (drizzle-kit studio).
7. Generar la primera migración SQL.
8. Añadir data/ al .gitignore.
9. Documentar en el README cómo levantar la base local desde cero.

Restricciones:
- No tocar ningún archivo que use el cliente de Supabase actualmente.
- Si hay alguna ambigüedad en el mapeo de tipos, párate y pregúntame antes de decidir.
- El nombre de tablas y columnas debe coincidir exactamente con el esquema actual
  para que las consultas existentes sigan siendo válidas conceptualmente.

Cuando termines, ejecuta "npm run db:migrate" para verificar que la base se crea sin
errores y dime cualquier discrepancia que hayas tenido que resolver.
```

---

## M2 — Migración del cliente Supabase a Drizzle, módulo a módulo

**Objetivo**: reemplazar todas las llamadas a `supabase.from(...).select/insert/update/delete` por equivalentes en Drizzle. **Sin Supabase Auth todavía** (eso es el Bloque 10).

### Pasos

- Inventariar todos los puntos del código que llaman a Supabase (route handlers, server actions, server components, scripts)
- Migrar por dominio: servicios → empleados → horarios → reservas → clientes → bloqueos
- Por cada dominio: reemplazar lecturas, escrituras, y comprobar que los tests (si existen) siguen pasando
- Eliminar dependencia de `@supabase/supabase-js` cuando no quede ninguna llamada
- Migrar el seed/datos de desarrollo a un script de Drizzle
- Verificación end-to-end del flujo crítico (reserva pública + dashboard) sobre SQLite

### Puntos críticos

- **El cálculo de disponibilidad es el punto de mayor riesgo de regresión**, igual que apuntaba el plan original. Verifícalo con datos reales antes de dar por buena la migración.
- **Transacciones**: cualquier operación que escriba en varias tablas a la vez (crear reserva + bloquear hueco, por ejemplo) debe envolverse en `db.transaction(...)`. better-sqlite3 las hace síncronas y rápidas.
- **Concurrencia en reservas**: el riesgo de "dos clientes reservan a la vez" del plan original sigue ahí. SQLite con WAL serializa escrituras; aprovechar eso para que la validación de disponibilidad y la inserción ocurran dentro de la misma transacción.

### Prompt para Claude Code

```text
Contexto: M1 está completo. Drizzle convive con el cliente de Supabase. SQLite local
funciona. Toca migrar las llamadas reales.

Objetivo: reemplazar TODAS las llamadas a @supabase/supabase-js por Drizzle, dominio
a dominio, manteniendo la app funcionando en cada paso. NO tocar autenticación todavía
(el Bloque 10 del PLAN.md aún no está implementado).

Plan de trabajo:
1. Primero, haz un inventario: lista todos los archivos y funciones que importan o
   usan supabase-js. Muéstrame la lista antes de empezar a migrar.
2. Propón un orden de migración por dominio (sugiero: servicios → empleados → horarios
   y excepciones → bloqueos → clientes → reservas, dejando reservas para el final por
   ser el dominio más complejo).
3. Para cada dominio, en una pasada:
   - Reemplaza las llamadas de lectura con queries de Drizzle equivalentes.
   - Reemplaza las llamadas de escritura, envolviendo en transacciones cuando se
     toquen varias tablas.
   - Verifica manualmente o con tests que la funcionalidad sigue.
4. Presta atención especial al cálculo de disponibilidad: es la lógica más crítica
   del sistema según PLAN.md. Asegúrate de que las condiciones de horario, excepciones,
   capacidad concurrente y bloqueos se traducen sin pérdida de semántica.
5. Cuando todos los dominios estén migrados, elimina la dependencia de @supabase/supabase-js
   del package.json y borra cualquier helper de inicialización del cliente Supabase.
6. Migra el seed de desarrollo (si existe) a un script de Drizzle ejecutable con tsx
   o ts-node.

Restricciones:
- Trabaja dominio por dominio, no toques todos los archivos a la vez. Quiero poder
  revisar y probar entre tandas.
- No introduzcas cambios de lógica de negocio. Si encuentras un bug, márcalo pero no
  lo arregles en este paso.
- Mantén la firma pública de las funciones de servicio/repo (los componentes que las
  consumen no deberían tener que cambiar).
- Si una query es difícil de expresar en Drizzle, párate y pregúntame antes de meter
  SQL crudo.

Al terminar cada dominio, dime: qué archivos tocaste, qué decisiones tomaste, y
cualquier cosa que requiera verificación manual.
```

---

## M3 — Storage local: logos y fotos de empleados

**Objetivo**: reemplazar Supabase Storage por almacenamiento en el sistema de ficheros del servidor. Volúmenes pequeños, sin necesidad de CDN.

### Pasos

- Definir estructura: `data/uploads/salons/{salon_id}/logo.{ext}`, `data/uploads/employees/{employee_id}/avatar.{ext}`
- Server action / route handler para upload con validación (tipo MIME, tamaño máximo)
- Procesamiento de imagen con `sharp` (redimensionar, convertir a webp/avif)
- Servir los ficheros desde una ruta Next.js o directamente desde el proxy
- Migrar uploads existentes de Supabase Storage si hay datos reales

### Puntos críticos

- **Path traversal**: validar siempre que el path resultante esté dentro de `data/uploads/`. No confiar en nombres de fichero del cliente.
- **Tamaño máximo de upload** en Next.js: por defecto 1MB para server actions; subirlo a 5-10MB con `serverActions.bodySizeLimit` en `next.config.js`.
- **El directorio `data/`** será el volumen Docker persistente. Todo lo que viva fuera de él se pierde al redeploy.

### Prompt para Claude Code

```text
Contexto: M1 y M2 completos. La app usa Drizzle + SQLite local. Las imágenes (logos
de salón, fotos de empleados) todavía se suben a Supabase Storage.

Objetivo: reemplazar Supabase Storage por almacenamiento en el sistema de ficheros
del servidor, bajo el directorio data/uploads/ (que será un volumen Docker persistente
más adelante).

Tareas:
1. Instalar sharp para procesamiento de imágenes.
2. Crear src/lib/storage.ts con funciones:
   - saveImage(file, { kind: 'salon-logo' | 'employee-avatar', entityId: string }):
     procesa la imagen con sharp (redimensiona a un máximo razonable, convierte a webp),
     la guarda en data/uploads/{kind}/{entityId}.webp, devuelve la ruta pública relativa.
   - deleteImage(path): borra una imagen.
   - getPublicUrl(path): devuelve la URL pública servible.
3. Validaciones en saveImage: tipo MIME permitido (image/jpeg, image/png, image/webp),
   tamaño máximo 5MB pre-procesado, path siempre normalizado y dentro de data/uploads/.
4. Configurar serverActions.bodySizeLimit a 10MB en next.config.js (los uploads van
   por server action).
5. Servir los ficheros: crear una ruta tipo /uploads/[...path]/route.ts que sirva el
   contenido del fichero correspondiente con los headers correctos (Cache-Control,
   Content-Type). Validar siempre que el path resuelto esté dentro de data/uploads/.
6. Reemplazar todas las llamadas a supabase.storage por las nuevas funciones.
7. Si tengo datos reales en Supabase Storage, crear un script de migración one-off
   que los descargue y los reubique con la nueva estructura. Pregúntame antes de
   ejecutarlo.

Restricciones:
- Path traversal es el riesgo principal. Cada acceso a fichero debe validar que el
  path absoluto resuelto está dentro del directorio uploads/.
- No uses fetch() para imágenes locales; léelas con fs.
- Considera que en producción este directorio será un volumen Docker; no asumas que
  el path es relativo al cwd del proceso Node (usa una variable UPLOADS_DIR con default).
```

---

## M4 — Sustitución de Supabase Realtime (si aplica)

**Objetivo**: si alguna parte del dashboard depende de actualizaciones en tiempo real vía Supabase Realtime, sustituirlo por una solución autocontenida.

### Pasos

- Auditar usos de Realtime: probablemente el calendario (Bloque 6) y el panel hoy (Bloque 7) si reflejan cambios de otros usuarios en vivo
- Decidir estrategia: polling simple (refetch cada 30-60s) vs SSE (Server-Sent Events)
- Implementar la estrategia elegida
- Eliminar dependencia de Realtime

### Puntos críticos

- **Probablemente no necesitas tiempo real "de verdad"**. Una peluquería con 2-4 empleados no genera la presión de eventos que justificaría SSE. Polling con `useSWR` o React Query cada 30s es suficiente y mucho más simple.
- Si optas por SSE, recuerda que Next.js standalone en Node sirve SSE sin problema; no es como serverless donde se complica.

### Prompt para Claude Code

```text
Contexto: M1-M3 completos. Queda revisar si alguna parte del frontend depende de
Supabase Realtime (suscripciones, channels, broadcast).

Objetivo: auditar y sustituir cualquier uso de Realtime por una solución autocontenida.

Tareas:
1. Buscar en el código cualquier uso de supabase.channel(), .on(), .subscribe(),
   broadcast, o presence. Lista los archivos y muéstrame el patrón de uso antes de
   cambiar nada.
2. Para cada caso, propón la estrategia más simple que mantenga la UX aceptable:
   - Si el caso es "ver cambios de otros usuarios en tiempo real" (ej: dos recepcionistas
     mirando el calendario): polling cada 30s con SWR o React Query es probablemente
     suficiente.
   - Si la latencia importa de verdad: implementar una ruta /api/events que sirva SSE
     y un hook cliente que escuche eventos por tipo.
3. Implementa la sustitución. No introduzcas WebSockets propios — son complejidad
   innecesaria para este volumen.
4. Elimina cualquier import o configuración relacionada con Realtime.

Si no hay uso de Realtime en el código, dímelo y no hagas cambios. Es probable que
solo afecte al calendario y al panel hoy, si es que afecta.
```

---

## M5 — Dockerización de la app

**Objetivo**: imagen Docker lista para desplegar, con Next.js en modo standalone, sharp incluido, y volumen para `data/`.

### Pasos

- Activar `output: 'standalone'` en `next.config.js`
- Dockerfile multi-stage: builder + runner mínimo
- `.dockerignore` agresivo
- Sharp instalado en el runtime (no solo en build)
- Healthcheck endpoint: `/api/health` que toque la DB y devuelva 200
- Variables de entorno documentadas en `.env.example`
- Probar localmente: `docker build` + `docker run` con volúmenes mapeados

### Puntos críticos

- **Standalone output** es necesario para que la imagen sea pequeña (~150MB en lugar de >1GB).
- **Sharp** necesita binarios nativos. La imagen base `node:20-slim` los soporta, pero hay que asegurarse de instalar `sharp` en el stage final también.
- **El volumen `data/`** debe ser persistente entre redeploys. Lo configuraremos en Kamal en M6.

### Prompt para Claude Code

```text
Contexto: app Next.js 15 ya migrada a Drizzle + SQLite + storage local (M1-M4 hechos).
Próximo paso: dockerizarla.

Objetivo: tener una imagen Docker lista para desplegar con Kamal en un VPS.

Tareas:
1. Modificar next.config.js: añadir output: 'standalone'.
2. Crear Dockerfile multi-stage:
   - Stage 1 (deps): node:20-slim, instala dependencias (npm ci).
   - Stage 2 (builder): copia el código, ejecuta npm run build.
   - Stage 3 (runner): node:20-slim mínimo. Copia el output standalone, el directorio
     .next/static, public/, y los binarios nativos de sharp. Crea usuario no-root.
     Expone el puerto 3000. CMD ejecuta node server.js.
3. Crear .dockerignore que excluya: node_modules, .next, .git, data/, .env*, README, etc.
4. Verificar que sharp se incluye correctamente en el stage runner (es la pieza más
   propensa a fallar por arquitectura: si construyes en Mac ARM y despliegas en VPS x86,
   hay que forzar la plataforma o usar buildx).
5. Crear endpoint /api/health que:
   - Verifique que puede leer de la DB (un SELECT 1 contra Drizzle).
   - Devuelva 200 si todo OK, 503 si la DB no responde.
   Este endpoint lo usará Kamal como healthcheck.
6. Crear/actualizar .env.example con TODAS las variables necesarias documentadas con
   un comentario breve de para qué sirve cada una.
7. Documentar en el README cómo construir y ejecutar localmente:
   - docker build -t reservas-peluqueria .
   - docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env.local reservas-peluqueria
8. Verificar que la app levanta, sirve la home y el healthcheck devuelve 200.

Restricciones:
- Imagen final por debajo de 250MB si es posible.
- No copies node_modules entero al runner; usa el output standalone que ya lo trae minimizado.
- El proceso debe correr como usuario no-root.
- Si vas a desplegar desde una Mac ARM hacia un VPS x86, dime para que veamos si
  buildamos con --platform=linux/amd64 o si usamos buildx.
```

---

## M6 — VPS Hetzner + primer despliegue con Kamal

**Objetivo**: VPS provisionado, Kamal configurado, primer deploy funcionando bajo un dominio (subdominio tuyo de prueba).

### Pasos

- Crear cuenta Hetzner Cloud y un proyecto
- Provisionar VPS (CX22, Ubuntu 22.04 o 24.04, ubicación europea)
- Configurar acceso SSH con clave (deshabilitar password)
- Configurar firewall básico (UFW): solo 22, 80, 443
- Instalar Docker en el VPS (o dejar que Kamal lo haga; Kamal 2 puede instalarlo)
- Crear registro DNS en Cloudflare apuntando subdominio al VPS
- Instalar Kamal local: `gem install kamal` (o usar la imagen Docker oficial)
- Inicializar configuración: `kamal init`
- Editar `config/deploy.yml`: servidor, registro de contenedores, volumen de `data/`, healthcheck
- Configurar secrets en `.kamal/secrets`
- Primer `kamal setup`, luego `kamal deploy`
- Verificar app en producción

### Puntos críticos

- **El volumen de `data/` es crítico**. Debe estar montado en el host (`/var/lib/reservas-peluqueria/data` o similar) y mapeado al contenedor en `/app/data`. Si te lo saltas, pierdes la base al primer redeploy.
- **kamal-proxy** (Kamal 2) gestiona Let's Encrypt automáticamente. Sin Nginx ni Traefik.
- **No commitees `.kamal/secrets`**. Va a `.gitignore`.
- Registro de contenedores: GitHub Container Registry (gratis para repos públicos y privados con límites generosos) o Docker Hub. GHCR encaja mejor si tu repo está en GitHub.

### Prompt para Claude Code

```text
Contexto: imagen Docker construida y funcionando localmente (M5). Toca configurar
Kamal y hacer el primer despliegue a un VPS de Hetzner que ya tengo provisionado.

Datos del VPS (los daré yo cuando me preguntes):
- IP pública
- Usuario SSH (probablemente root o un usuario sudoer)
- Dominio/subdominio que apuntará al VPS (configuraré el DNS en Cloudflare)

Objetivo: dejar Kamal configurado y la app desplegada.

Tareas:
1. Instalar Kamal local si no está. Verificar versión (Kamal 2.x).
2. Ejecutar kamal init para generar la estructura de config.
3. Editar config/deploy.yml con:
   - service: nombre del servicio
   - image: nombre completo (ej: ghcr.io/usuario/reservas-peluqueria)
   - servers.web: la IP del VPS
   - proxy: host con el dominio, ssl: true (para Let's Encrypt automático)
   - registry: GitHub Container Registry (ghcr.io)
   - env:
     * clear: variables no sensibles (NODE_ENV, etc.)
     * secret: lista de claves de variables sensibles (DATABASE_URL apuntará a
       /app/data/prod.db, RESEND_API_KEY se añadirá en M8, etc.)
   - volumes:
     * "/var/lib/reservas-peluqueria/data:/app/data" para persistir SQLite y uploads
   - healthcheck.path: /api/health
   - asset_path si aplica para zero-downtime deploys
4. Crear .kamal/secrets (NO commitear) con las variables sensibles. Usar referencias
   a $KAMAL_REGISTRY_PASSWORD para el token del registry.
5. Añadir .kamal/secrets al .gitignore.
6. Documentar en el README:
   - Cómo hacer login en el registry (docker login ghcr.io)
   - Cómo hacer el primer setup (kamal setup)
   - Cómo desplegar (kamal deploy)
   - Cómo ver logs (kamal app logs -f)
   - Cómo abrir una shell (kamal app exec --interactive bash)
7. Pregúntame por la IP del VPS, el dominio que quiero usar, y el nombre del repo
   en GHCR antes de generar la configuración final.

Restricciones:
- Nada de credenciales hardcodeadas en deploy.yml. Todo lo sensible va por secrets.
- El volumen del directorio data/ es crítico. No deployes sin verificar que está
  configurado.
- Antes de kamal setup, asegúrate de que el firewall del VPS permite 22, 80 y 443.

Tras el primer kamal deploy, accederé al dominio para verificar. Si algo falla,
empezaremos por los logs (kamal app logs y kamal proxy logs).
```

---

## M7 — Healthcheck, logs, primeras pruebas en producción

**Objetivo**: pulir la configuración inicial. Verificación end-to-end del flujo crítico en producción. Logs accesibles. Healthcheck robusto.

### Pasos

- Verificar que `kamal-proxy` está sirviendo en HTTPS con cert de Let's Encrypt
- Probar el flujo de reserva pública end-to-end
- Probar el dashboard (con la auth que tenga ahora, o sin ella si Bloque 10 no está)
- Logs centralizados: revisar `kamal app logs -f` y entender el patrón
- Configurar log rotation en el host (Docker por defecto puede llenar el disco)
- Healthcheck ampliado: además del SELECT 1, verificar acceso a `data/uploads/`

### Puntos críticos

- **Log rotation** en Docker: configurar `--log-opt max-size=10m --log-opt max-file=3` o equivalente en `/etc/docker/daemon.json`. Sin esto, un bug ruidoso llena el disco del VPS y se cae todo.
- Si el cert de Let's Encrypt tarda, revisar que `kamal proxy logs` no muestre errores de ACME.

### Prompt para Claude Code

```text
Contexto: primer deploy hecho (M6). La app responde en https://[dominio]. Toca
pulir antes de seguir.

Objetivo: dejar la instancia en estado "presentable", con healthcheck robusto, logs
sanos, y flujo crítico verificado.

Tareas:
1. Endpoint /api/health: ampliarlo para verificar también que puede leer/escribir
   en /app/data (intenta crear y borrar un fichero tmp dentro de data/, no en raíz).
   Sigue devolviendo 200/503.
2. Configurar log rotation a nivel Docker en el VPS. Edita /etc/docker/daemon.json
   (o créalo) con:
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "10m",
       "max-file": "3"
     }
   }
   Tras editar, sudo systemctl restart docker. (Esto necesitará reconectar Kamal y
   posiblemente un redeploy).
3. Verificar que el certificado Let's Encrypt está activo y se renovará: revisar
   kamal proxy logs y comprobar que no hay errores.
4. Crear un checklist de smoke test que ejecutaré yo manualmente tras cada deploy:
   - La landing carga
   - Puedo entrar al wizard de reserva pública
   - Puedo completar una reserva
   - El email de confirmación llega (esto fallará hasta M8, márcalo como pendiente)
   - El dashboard responde
   - El calendario muestra la reserva creada
5. Documentar en el README la sección "Troubleshooting" con los comandos más útiles:
   - kamal app logs -f
   - kamal proxy logs -f
   - kamal app exec --interactive bash
   - kamal redeploy (si hay que forzar)
   - df -h en el VPS para vigilar el disco

Restricciones:
- No introduzcas dependencias nuevas en este paso.
- Si el healthcheck ampliado da falsos positivos por carrera con el arranque, da una
  ventana de gracia (ej: el endpoint devuelve 200 si la app lleva menos de 10s arriba
  aunque la DB no haya conectado todavía).
```

---

## M8 — Email transaccional con Resend

**Objetivo**: sustituir el envío de emails (actualmente probablemente desde Supabase o un mock) por Resend. Plantillas básicas alineadas con el Bloque 4 del plan.

### Pasos

- Cuenta en Resend, verificar dominio remitente (`tuapp.es` o similar)
- Obtener API key, añadirla a Kamal secrets
- Instalar `resend` (o usar SDK oficial)
- Helper `sendEmail({ to, subject, react/html })`
- Plantillas con `react-email` para: confirmación, recordatorio, cancelación, reprogramación
- Conectar las plantillas a los puntos del Bloque 4 que las disparan
- Job de recordatorios 24h: cron de sistema en el VPS que llama a una ruta protegida `/api/jobs/reminders`
- Verificación: hacer una reserva real y comprobar que llega el email

### Puntos críticos

- **Verificación del dominio** en Resend (registros DNS SPF, DKIM) es requisito para que los emails no caigan en spam. Esto **se hace una vez** para tu dominio raíz.
- **Cuando el modelo de instancia-por-cliente entre en juego**, cada cliente puede tener un remitente tipo `salonX@tuapp.es` sin necesidad de configurar DNS por cliente, porque el dominio raíz ya está verificado.
- **El cron de recordatorios** debe ser idempotente: si se ejecuta dos veces no debe enviar el email dos veces. Marcar reservas como `reminder_sent_at`.

### Prompt para Claude Code

```text
Contexto: la app está en producción (M7) pero los emails no funcionan o están mockeados.
El Bloque 4 del plan de producto define qué emails debe enviar la app.

Objetivo: integrar Resend como proveedor de email transaccional, implementar las
plantillas, y configurar el job de recordatorios 24h.

Tareas:
1. Instalar resend y react-email (@react-email/components, @react-email/render).
2. Crear src/lib/email.ts con:
   - Cliente Resend inicializado con RESEND_API_KEY.
   - Función sendEmail({ to, subject, react }): renderiza el componente React a HTML
     y lo envía. Logueable y con manejo de errores que no rompa el flujo (un email
     que falla no debería romper la creación de la reserva).
3. Crear src/emails/ con plantillas React (react-email):
   - BookingConfirmation.tsx (incluye el enlace mágico de cancelar/reprogramar del Bloque 5)
   - BookingReminder.tsx
   - BookingCancellation.tsx
   - BookingRescheduled.tsx
   Todas con el branding mínimo (logo del salón, datos básicos).
4. Conectar las plantillas a los puntos del código donde el Bloque 4 dice que se
   disparan los emails.
5. Job de recordatorios:
   - Crear /api/jobs/reminders/route.ts (POST). Verifica un header X-Job-Token contra
     una variable de entorno JOB_TOKEN (rotacionable).
   - Query: reservas confirmadas con start_at entre ahora+23h y ahora+25h, que no
     tengan reminder_sent_at.
   - Envía el recordatorio y marca reminder_sent_at.
   - Idempotente: si se llama dos veces, no envía dos veces.
6. Configurar cron de sistema en el VPS (kamal accessory o cron del host).
   Sugerencia: añadir un accessory cron en deploy.yml que ejecute curl -X POST
   https://[dominio]/api/jobs/reminders con el header de auth cada 30 minutos.
   Pregúntame si prefieres cron del host directamente.
7. Añadir columna reminder_sent_at a la tabla de reservas (migración de Drizzle).

Restricciones:
- Que el envío de email NUNCA bloquee ni rompa el flujo principal. Si Resend falla,
  se loguea y la reserva se crea igual.
- El JOB_TOKEN debe ser un secreto, no commitearlo. Va en .kamal/secrets.
- Verificación del dominio en Resend la haré yo manualmente; tú solo asume que
  RESEND_API_KEY y RESEND_FROM están configurados.

Tras esto, haré una reserva real para verificar que el email de confirmación llega.
```

---

## M9 — Backups con Litestream + monitorización

**Objetivo**: backup continuo del SQLite + uptime + errores. Sin esto, no es producción.

### Pasos

- Cuenta Backblaze B2 (10GB gratis) o Cloudflare R2 (10GB gratis). Crear bucket
- Litestream como accessory de Kamal o instalado en el VPS, replicando `data/prod.db`
- Verificar restauración: practicar un `litestream restore` en una máquina aparte para confirmar que el backup vale
- UptimeRobot: monitor HTTP del dominio cada 5 minutos
- Sentry: SDK en la app, DSN como variable de entorno
- Documentar el runbook de recuperación

### Puntos críticos

- **Un backup que no se ha probado restaurando es un backup que no existe.** Hacer al menos una restauración manual antes de declarar M9 completo.
- **Sentry en cliente Y servidor**: configurar ambos para capturar errores de Server Components y de cliente.

### Prompt para Claude Code

```text
Contexto: la app está en producción con email funcionando (M8). Falta protegerla:
backups, uptime, errores.

Objetivo: dejar montados Litestream para backups continuos de SQLite, UptimeRobot
para uptime, y Sentry para errores.

Tareas:
1. Litestream:
   - Decidir entre Backblaze B2 y Cloudflare R2 como destino. Pregúntame; si no
     tengo preferencia, recomienda según la operativa más simple.
   - Crear src/litestream.yml de configuración: replicar /app/data/prod.db a un
     bucket S3-compatible.
   - Añadir Litestream como accessory en config/deploy.yml de Kamal, ejecutándose
     en paralelo a la app, con acceso al mismo volumen data/ en modo lectura.
   - Variables de entorno necesarias en secrets: LITESTREAM_ACCESS_KEY_ID,
     LITESTREAM_SECRET_ACCESS_KEY, LITESTREAM_BUCKET.
   - Verificar después del deploy: kamal accessory logs litestream debería mostrar
     replicación activa.
2. Probar restauración:
   - Documentar en el runbook (README sección operations) los pasos para restaurar:
     descargar Litestream local, ejecutar litestream restore con la config apuntando
     al bucket, verificar el .db resultante con un SELECT contra Drizzle.
   - Esto lo ejecutaré yo manualmente en mi máquina al menos una vez.
3. UptimeRobot: te paso a mí los pasos manuales que tengo que dar (crear cuenta,
   añadir monitor HTTP cada 5 min al dominio, configurar alerta por email).
4. Sentry:
   - Instalar @sentry/nextjs.
   - Ejecutar el wizard (npx @sentry/wizard) o configurar manualmente:
     sentry.client.config.ts, sentry.server.config.ts, instrumentation.ts.
   - DSN como variable de entorno SENTRY_DSN, añadirlo a secrets.
   - Verificar capturando un error de prueba en una ruta de test.
5. Actualizar el runbook con:
   - Cómo restaurar SQLite desde Litestream paso a paso.
   - Cómo consultar UptimeRobot.
   - Cómo entrar a Sentry y filtrar por release.
   - Qué hacer si Litestream deja de replicar (síntomas, dónde mirar).

Restricciones:
- No declares M9 completo hasta que hayas verificado que Litestream replica de verdad
  (kamal accessory logs litestream con líneas de "wrote snapshot" o equivalentes).
- La restauración la pruebo yo. Tú prepara el procedimiento.
```

---

## Bloque 10 (revisado) — Autenticación con Auth.js v5

**Objetivo**: implementar el Bloque 10 original del plan de producto, pero **sobre el stack nuevo** (Auth.js + Drizzle, sin Supabase Auth).

### Pasos

- Instalar `next-auth@beta` (Auth.js v5) y `@auth/drizzle-adapter`
- Tablas de auth en el esquema de Drizzle (users, sessions, accounts, verification_tokens)
- Configurar Auth.js con credentials provider (email + password)
- Hash de passwords con `argon2` o `bcrypt`
- Middleware de protección de rutas del dashboard
- Roles `admin` y `staff` en la tabla `users` (no es algo nativo de Auth.js, lo añades como columna y lo respetas en las queries y middleware)
- Recuperación de contraseña: token → email con enlace → form de nueva password
- Verificación end-to-end de los dos roles

### Puntos críticos

- **Auth.js v5 está en beta pero estable**. La documentación es buena.
- **Roles no son nativos**: van en la columna `users.role`. El callback `session` debe inyectarlo en la sesión para tenerlo en cliente y server.
- **Las cuentas se crean desde el wizard de onboarding**, no por registro público. La app no tiene página de "registrarse"; solo de "login" y "olvidé mi contraseña".

### Prompt para Claude Code

```text
Contexto: M1-M9 completos. App en producción con Drizzle + SQLite + Resend + Litestream
+ Sentry. Sin autenticación todavía. Toca implementar el Bloque 10 del PLAN.md.

Objetivo: autenticación con Auth.js v5 y roles admin/staff. No hay registro público;
las cuentas se crearán desde el wizard de onboarding (que es otro proyecto / fase).
Para esta fase: crear cuentas manualmente desde un script seed o desde una ruta admin.

Tareas:
1. Instalar next-auth@beta y @auth/drizzle-adapter, argon2.
2. Añadir al esquema Drizzle las tablas que Auth.js requiere (users, sessions, accounts,
   verificationTokens). Añadir a users una columna role: 'admin' | 'staff' y salon_id.
3. Configurar Auth.js en auth.ts (raíz del proyecto):
   - Adapter: Drizzle.
   - Providers: Credentials (email + password verificado con argon2).
   - Session strategy: database.
   - Callbacks: session debe incluir role y salon_id.
   - Pages: signIn personalizado en /login.
4. Crear /login page con un form sencillo.
5. Crear /api/auth/[...nextauth]/route.ts con los handlers de Auth.js.
6. Middleware en middleware.ts protegiendo /dashboard/* y derivados:
   - No autenticado → redirige a /login.
   - Autenticado pero no admin intentando acceder a configuración (Bloque 2) →
     403 o redirect a /dashboard/agenda.
7. Recuperación de password:
   - /forgot-password: formulario con email. Genera token, guarda en tabla, envía
     email con enlace usando Resend (plantilla nueva: PasswordResetEmail).
   - /reset-password/[token]: formulario para nueva password. Verifica token válido
     y no expirado. Actualiza password (hasheada). Invalida el token.
8. Script seed para crear el primer usuario admin:
   - scripts/create-admin.ts que toma email + password por argumentos, hashea con
     argon2 e inserta en la tabla users con role='admin' y un salon_id.
   - Documentar en el README cómo ejecutarlo en producción:
     kamal app exec --interactive "node scripts/create-admin.js admin@ejemplo.com password123"

Restricciones:
- argon2 sobre bcrypt: mejor resistencia a ataques modernos.
- NO permitas registro público en ninguna ruta. Solo login y reset.
- El campo salon_id en users es el que limita lo que cada usuario ve. Asegúrate de
  que TODAS las queries del dashboard filtran por session.user.salonId. Esta es la
  línea entre el "mono-salón en UI, multi-salón en datos" del PLAN.md.
- Sesiones en DB (no JWT) para poder revocar al instante si hace falta.
- Cookies con secure, httpOnly, sameSite=lax.
```

---

## Bloque 11 (sin cambios) — Landing pública

El bloque original del plan no cambia. Sigue siendo independiente del stack. Sin prompt específico aquí porque no hay nada de migración relevante.

---

## Bloque 12 (sin cambios) — Responsive y pulido final

Igual que el 11. Cuando llegues, asegúrate de probar el flujo end-to-end completo **sobre la instancia de producción real**, no solo en local.

---

## Riesgos identificados (nuevos)

- **Migración del esquema de Postgres a SQLite**: tipos no equivalentes (jsonb, uuid, timestamptz) se traducen, pero hay riesgo de perder restricciones. Mitigado en M1 con replicación cuidadosa.
- **Sharp y arquitecturas**: si construyes en Mac ARM y despliegas en VPS x86, sharp falla en runtime. Mitigado en M5 con buildx o `--platform=linux/amd64`.
- **Volumen Docker mal mapeado**: si `data/` no es volumen persistente, primer redeploy borra la base. Mitigado en M6, con verificación explícita.
- **Litestream replicando pero no probado**: backups falsamente sanos. Mitigado en M9 con restauración real obligatoria.
- **WAL mode y backups**: el fichero `-wal` y `-shm` son parte de la base. Litestream lo maneja, pero un `cp` ingenuo del `.db` sin Litestream no es backup válido.
- **Auth.js v5 en beta**: API estable pero pueden cambiar detalles. Fijar la versión exacta y revisar changelog al actualizar.
- **El Bloque 4 (emails) depende de M8**: si la migración se hace por partes y el email se rompe entre M2 y M8, hay una ventana donde la app no envía confirmaciones. Asumirlo o mantener el envío de emails con la solución anterior hasta M8.

---

## Cuándo declarar la migración terminada

Checklist final, antes de pasar al Bloque 10:

- M1-M9 completos
- App en producción accesible por HTTPS bajo un dominio real
- Flujo de reserva pública funcionando end-to-end con email de confirmación
- Dashboard accesible (aunque sin auth de producción aún)
- Litestream replicando, restauración probada al menos una vez
- UptimeRobot monitorizando, Sentry capturando un error de prueba
- Runbook escrito en el README
- Sin ninguna dependencia de `@supabase/`* en `package.json`

