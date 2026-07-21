# Agendao

SaaS multi-tenant de reservas para peluquerías y salones (estilo Booksy). Una
sola aplicación y una sola base de datos Postgres sirven a todas las peluquerías,
cada una con su página pública de reservas (`/[salon]/book`) y su panel de
gestión. Aislamiento por `salon_id` con guard de app + RLS.

- **Rumbo del producto (features + roadmap):** `GUIA_PRODUCTO.md`
- **Decisiones core / invariantes:** `MEMORY.md`
- **Mapa del código (autogenerado):** `Project_Map.md` (`npm run map:generate`)
- **Rumbo estratégico (giro a SaaS):** `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`
- **Reglas para agentes de IA:** `AGENTS.md`

Stack: Next.js 16 (App Router) + TypeScript · Drizzle ORM + `pg` sobre Postgres
(Neon en producción) · Auth.js v5 · Resend + react-email · Kamal 2 sobre VPS.

## Setup local

Requisitos: **Node 20+** y un **Postgres** accesible (uno local, o una rama de
[Neon](https://neon.tech) u otro Postgres gestionado).

1. Crea `.env.local` con, como mínimo:

   ```bash
   DATABASE_URL=postgres://user:pass@host:5432/agendao   # cadena de conexión Postgres
   APP_URL=http://localhost:3000
   AUTH_SECRET=...            # openssl rand -base64 32
   RESEND_API_KEY=...         # o un valor placeholder en desarrollo
   EMAIL_FROM="Agendao <no-reply@tu-dominio>"
   CRON_SECRET=...            # openssl rand -base64 32
   # Opcionales: UPLOADS_DIR (por defecto data/uploads), AUTH_TRUST_HOST=true tras proxy
   ```

2. Instala dependencias y aplica el esquema:

   ```bash
   npm install
   npm run db:migrate     # aplica las migraciones de drizzle/ a Postgres
   npm run db:seed        # datos de ejemplo (idempotente)
   ```

   `db:seed` limpia las tablas e inserta un salón de ejemplo con servicios,
   empleados con horarios distintos, clientes y reservas **relativas a hoy**, para
   que el dashboard siempre tenga algo que mostrar.

3. Arranca:

   ```bash
   npm run dev            # http://localhost:3000
   ```

4. Inspecciona la BD con Drizzle Studio:

   ```bash
   npm run db:studio
   ```

### Cambios de esquema

El esquema vive en `lib/db/schema.ts` (Drizzle, dialecto `postgresql`). Tras
editarlo:

```bash
npm run db:generate    # genera el SQL de migración en drizzle/
npm run db:migrate     # lo aplica
```

La validez dura (no-solape de reservas con `EXCLUDE USING gist`, triggers, RLS por
tenant) vive en Postgres; la composición y las reglas de negocio, en TypeScript.

Cada salón tiene además un registro 1:1 en `salon_lifecycle`. Los salones nuevos
empiezan con un trial de 14 días; el estado de billing y la suspensión operativa
se conservan por separado y Postgres rechaza transiciones inválidas. Esta tabla es
tenant-scoped y solo se consulta dentro de `withTenant(salonId, fn)`.

## Autenticación

Auth.js v5 con Credentials (email + password, hash argon2id). Estrategia JWT: el
token lleva `sid` y `salonId`, y el `sid` se valida contra la tabla
`auth_sessions` en cada request para permitir **revocación inmediata**.

### Crear el primer admin

El registro público está disponible en `/signup` y crea el salón, el admin y el
trial inicial. Para instalaciones existentes, el primer admin también se puede
crear por script:

```bash
# Si solo hay un salón en la DB
tsx scripts/create-admin.ts admin@ejemplo.com supersecreta1

# Si hay varios, pasa el slug del salón
tsx scripts/create-admin.ts admin@ejemplo.com supersecreta1 estudio-aurora
```

Requisitos: email válido, password ≥ 8 caracteres. El insert va scoped por el GUC
de tenant (`app.current_salon_id`) dentro de la misma transacción, para respetar
la RLS.

En producción (Kamal):

```bash
kamal app exec --interactive "tsx scripts/create-admin.ts admin@ejemplo.com supersecreta1"
```

### Roles

- `admin` → acceso completo a `/admin/*`.
- `staff` → solo `/admin/today` y `/admin/calendar`. El resto redirige a `/admin/today`.

### Revocación de sesión

Borrar la fila correspondiente en `auth_sessions` (vía `db:studio` o SQL)
invalida la sesión en el siguiente request y redirige a `/login`. Hacer sign-out
también limpia la fila.

### Recuperación de contraseña

Flujo en `/forgot-password` → `/reset-password/<token>`. Token de un solo uso,
TTL 60 min. Consumir el token revoca todas las sesiones activas del usuario.

## Docker (producción)

La app se distribuye como imagen Docker multi-stage (`node:20-slim` + Next
standalone) lista para Kamal sobre un VPS amd64. La base de datos Postgres es
**externa** (Neon u otro Postgres gestionado): no vive en el contenedor.

### Variables de entorno

Mínimo necesario: `DATABASE_URL` (Postgres), `APP_URL`, `AUTH_SECRET`,
`RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. Detrás de proxy añadir
`AUTH_TRUST_HOST=true`. Ver `config/deploy.yml` para el reparto clear/secret.

### Run local con la imagen

```bash
docker build -t agendao .
docker run --rm -p 3000:3000 --env-file .env.local --name agendao agendao
```

- Las migraciones se aplican automáticamente al arrancar
  (`docker-entrypoint.sh` → `scripts/migrate-prod.mjs`).
- El contenedor corre como usuario no-root (`nextjs`, uid 1001).
- `GET /api/health` devuelve `200` si la DB responde, `503` en caso contrario — es
  el endpoint que sondea Kamal.

## Despliegue en VPS con Kamal 2

La app se despliega con [Kamal 2](https://kamal-deploy.org/) sobre un VPS amd64.
La config vive en `config/deploy.yml` y los secretos en `.kamal/secrets` (no
versionado). Postgres es gestionado (Neon): su backup/PITR lo da el proveedor.

### Prerrequisitos

- VPS accesible por SSH como `root` con tu llave pública.
- DNS A-record del dominio → IP del VPS (proxy de Cloudflare **apagado** durante
  la emisión del cert de Let's Encrypt; después se puede activar).
- `DATABASE_URL` de un Postgres gestionado accesible desde el VPS.
- Personal Access Token de GitHub con scope `write:packages` como `GHCR_TOKEN`.
- Kamal 2.x (`gem install kamal`, ≥ 2.10). Firewall abriendo TCP 22, 80 y 443.

### Setup único del host

Solo se necesita el directorio de **uploads** en el volumen persistente (Postgres
es externo):

```bash
ssh root@<IP>
mkdir -p /var/lib/agendao/data/uploads
chown -R 1001:1001 /var/lib/agendao/data
chmod 750 /var/lib/agendao/data
exit
```

El `chown` a uid 1001 es indispensable: el contenedor corre como `nextjs`
(uid 1001) y no podría escribir los uploads si el host dir queda como root.

### Primer despliegue

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u franwer-ranger --password-stdin
kamal setup       # instala Docker, levanta kamal-proxy y hace el primer deploy
curl -sf https://<DOMINIO>/api/health   # esperado: {"status":"ok"}
```

### Operaciones comunes

```bash
kamal deploy                                  # nuevo cambio de código
kamal logs                                    # logs en vivo (alias)
kamal shell                                   # shell en el contenedor (alias)
kamal migrate                                 # corre scripts/migrate-prod.mjs (alias)
kamal proxy logs                              # logs del proxy (TLS, routing)
kamal rollback <version>                      # volver a una imagen anterior
```

### Preview HTTP sin dominio

Mientras no haya un dominio real apuntando a la IP, `kamal setup` fallará al emitir
el certificado de Let's Encrypt. Para validar el deploy sin TLS, edita
temporalmente `config/deploy.yml`:

1. Comentar todo el bloque `proxy:`.
2. Bajo `servers.web` añadir un mapeo de puerto al host:
   ```yaml
   servers:
     web:
       hosts:
         - <IP>
       options:
         publish:
           - '80:3000'
   ```
3. `kamal setup` → la app queda en `http://<IP>/`.

Cuando llegue el dominio, revertir: descomentar `proxy:`, quitar `options.publish`,
actualizar `proxy.host` y `env.clear.APP_URL`, y `kamal redeploy`.

### Notas importantes

- **`boot.limit: 1`** fuerza stop-then-start en cada deploy. Con un único host, evita
  que dos contenedores monten el mismo **volumen de uploads** a la vez; genera unos
  segundos de 502s mientras arranca el contenedor nuevo. Aceptable para esta etapa.
- **El bind mount `/var/lib/agendao/data` guarda los uploads** (`data/uploads/`), la
  única fuente de verdad en disco. Migrar a object storage (R2/S3) está en el
  roadmap como fast-follow.
- **Los datos de negocio viven en Postgres gestionado**, no en el VPS. El backup lo
  da el proveedor (Neon).
- **Kamal construye desde un clon de git**: los cambios sin commitear no se
  despliegan. Commitea antes de `kamal deploy`.
