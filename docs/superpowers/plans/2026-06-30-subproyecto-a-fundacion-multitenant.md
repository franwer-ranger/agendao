# Sub-proyecto A — Fundación multi-tenant: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development`
> para implementar este plan tarea a tarea. Los pasos usan checkbox (`- [ ]`).
>
> Spec: `docs/superpowers/specs/2026-06-30-subproyecto-a-fundacion-multitenant-design.md`.
> Diseño maestro: `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`.

**Goal:** Migrar Agendao de SQLite single-tenant a Postgres (Neon) multi-tenant, con
validez dura restaurada en la BD, aislamiento por tenant (guard + RLS) y gating de
onboarding por-tenant — dejando la base sobre la que se construyen B/C/D.

**Architecture:** Se reescribe la capa de datos a `drizzle-orm/node-postgres`. El
esquema pasa a `pg-core`; el DDL que Drizzle no expresa (extensiones, columnas
generadas `tstzrange`, `EXCLUDE`, triggers, RLS) se recupera del Postgres original
del repo (commit `c490267`, dir `supabase/migrations/`) y se aplica vía migraciones
`--custom`. Las 54 llamadas síncronas (`.get/.run/.all`) pasan a `await`, módulo a
módulo, con `tsc` como red. El aislamiento se fija con un helper `withTenant` que
setea el GUC `app.current_salon_id` por transacción + policies RLS.

**Tech Stack:** Next.js 16, TypeScript 5, Drizzle ORM 0.45, `pg` (node-postgres),
Postgres 16 (Neon), Zod 4, Auth.js v5.

## Global Constraints

- **Sin tests automatizados nuevos.** Verificación = `npx tsc --noEmit` + `npm run lint`
  + `npm run build` + QA manual. (Decisión del usuario; QA manual es la práctica del
  proyecto.) Esto **reemplaza el ciclo TDD por defecto** de la skill de planes.
- **Los tests existentes acoplados a SQLite se eliminan** en su tarea (no se portan):
  `lib/setup/__tests__/setup-instance.test.ts` y, si rompe, los de
  `lib/availability/__tests__/`. La infra vitest (`vitest.config.ts`, scripts `test`,
  `predeploy`, deps) se retira en la tarea de limpieza final.
- **El Next.js de este repo tiene breaking changes**: leer `node_modules/next/dist/docs/`
  antes de tocar middleware/routing (ver `AGENTS.md`).
- **Locale/TZ fijos:** `es-ES` / `Europe/Madrid`. No introducir i18n.
- **Pre-lanzamiento:** no hay datos que preservar. El esquema se recrea limpio; no hay
  migración de datos ni ventana de corte.
- **Aislamiento es frontera de seguridad:** ninguna query de dashboard puede correr sin
  `salon_id` del contexto. Una fuga cross-tenant es catastrófica.
- **Commits frecuentes**, uno por tarea como mínimo. Mensajes en español, prefijo
  convencional (`feat:`/`refactor:`/`chore:`).

## Reglas de conversión síncrono → async (referencia compartida)

Aplican a TODA tarea de la Fase 3. `drizzle-orm/node-postgres` es asíncrono y **no
tiene** `.get()/.all()/.run()`:

| Patrón actual (better-sqlite3) | Patrón Postgres (node-postgres) |
|---|---|
| `const row = db.select()....get()` | `const row = (await db.select()....limit(1))[0]` |
| `const rows = db.select()....all()` | `const rows = await db.select()...` |
| `db.insert(...).values(...).run()` | `await db.insert(...).values(...)` |
| `db.update(...).set(...).where(...).run()` | `await db.update(...).set(...).where(...)` |
| `db.delete(...).where(...).run()` | `await db.delete(...).where(...)` |
| `const r = db.insert(...).values(...).returning({...}).all()` | `const r = await db.insert(...).values(...).returning({...})` |
| `db.transaction((tx) => { ...sync... })` | `await db.transaction(async (tx) => { ...await... })` |
| dentro de tx: `tx.select()....get()` | `(await tx.select()....limit(1))[0]` |

- La función que contiene la llamada debe ser `async` y la llamada `await`-eada. Si el
  caller la usaba como valor síncrono, propagar `await` hacia arriba.
- `tsc --noEmit` es el detector: un `.get()` sobre el builder de pg da *"Property 'get'
  does not exist"*; un `await` olvidado da un type error al usar la Promise como valor.
- **Códigos de error Postgres** (reemplazan a `SQLITE_CONSTRAINT_UNIQUE`):
  `23505` unique_violation · `23P01` exclusion_violation (EXCLUDE de empleado) ·
  `23514` check_violation (capacidad). Helper de detección por `(e as {code?}).code`.

> **Nota de estado de compilación:** tras la Fase 1 (cambio de cliente a pg), `tsc`
> mostrará muchos errores hasta completar la Fase 3. Es esperado. El gate de cada
> tarea de Fase 3 es *"los ficheros de ESTE módulo ya no producen errores de
> `.get/.run/.all`"* (verificable filtrando la salida de `tsc` por las rutas del
> módulo). El gate "tsc 100% limpio + build" es de la última tarea.

---

## Prerrequisito manual (usuario)

- [ ] **Provisionar Postgres en Neon.** Crear proyecto Neon, copiar la **connection
  string *pooled*** (la que incluye `-pooler`), y exportarla como `DATABASE_URL` en
  `.env.local` (dev) y en `.kamal/secrets` (prod). Para dev local también vale un
  Postgres en Docker. *(Acción tuya; el resto del plan asume `DATABASE_URL` apuntando
  a Postgres.)*

---

## FASE 1 — Fundación Postgres (cliente, esquema, migraciones base)

### Task 1: Dependencias y configuración de Drizzle a Postgres

**Files:**
- Modify: `package.json` (deps), `drizzle.config.ts`

- [ ] **Step 1:** Instalar driver y tipos:
```bash
npm install pg
npm install -D @types/pg
```
- [ ] **Step 2:** Cambiar el dialecto en `drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
})
```
- [ ] **Step 3 (verificar):** `npx tsc --noEmit drizzle.config.ts` no debe dar errores
  de tipos en este fichero. (El resto del repo aún no; es esperado.)
- [ ] **Step 4 (commit):**
```bash
git add package.json package-lock.json drizzle.config.ts
git commit -m "chore(db): driver pg + dialecto postgresql en drizzle-kit"
```

### Task 2: Reescribir `lib/db/schema.ts` a `pg-core`

**Files:**
- Modify: `lib/db/schema.ts` (reescritura completa)

**Interfaces:**
- Produces: las mismas tablas y tipos `$inferSelect` exportados que hoy (mismos
  nombres: `salons`, `app_users`, `auth_sessions`, `employees`, `services`,
  `employee_services`, `clients`, `employee_weekly_schedule`,
  `employee_recurring_breaks`, `employee_time_off`, `salon_closures`,
  `salon_working_hours`, `bookings`, `booking_items`, `booking_status_events`,
  `booking_tokens`, `booking_notifications`, `auth_password_reset_tokens`), más una
  columna nueva `salons.onboarding_completed_at` (Fase 5 la usa).

- [ ] **Step 1:** Sustituir imports de `drizzle-orm/sqlite-core` por
  `drizzle-orm/pg-core` y definir los customTypes especiales arriba del fichero:
```ts
import { sql } from 'drizzle-orm'
import {
  bigint, boolean, check, customType, index, integer, jsonb,
  pgTable, primaryKey, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core'

// email case-insensitive (extensión citext, creada en Task 4)
const citext = customType<{ data: string; driverData: string }>({
  dataType() { return 'citext' },
})
```
- [ ] **Step 2:** Traducir cada tabla de `sqliteTable` a `pgTable` aplicando este mapeo
  (la **fuente de columnas es el `schema.ts` actual**, no el Postgres antiguo, que
  tenía menos columnas):

| Tipo actual (sqlite) | Tipo Postgres (pg-core) |
|---|---|
| `integer().primaryKey({ autoIncrement: true })` | `bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity()` |
| `text().primaryKey()` (ids de `app_users`, `auth_sessions`) | `text().primaryKey()` |
| `integer({ mode: 'timestamp_ms' })` | `timestamp({ withTimezone: true, mode: 'date' })` |
| `.default(NOW_MS)` en timestamps | `.defaultNow()` |
| `citext()` | `citext()` (el customType de arriba) |
| `integer({ mode: 'boolean' })` | `boolean()` |
| `text({ mode: 'json' }).$type<…>()` | `jsonb().$type<…>()` |
| `integer()` (weekday, minutos, position, version, display_order, count) | `integer()` |
| `bigint`-FK `integer().references(() => salons.id)` | `bigint({ mode: 'number' }).references(() => salons.id)` |

  **Casos especiales (no convertir a tipos date/time nativos — el motor compara como
  string):**
  - `employee_weekly_schedule.starts_at/ends_at`, `employee_recurring_breaks.starts_at/ends_at`
    → **`text()`** (siguen siendo `'HH:MM'`).
  - `…effective_from/effective_until`, y los `default(TODAY_DATE)` →
    **`text()`** (siguen siendo `'YYYY-MM-DD'`); el default `(date('now'))` →
    `.default(sql\`(now() at time zone 'Europe/Madrid')::date::text\`)` o dejar sin
    default y rellenarlo en app (preferido: sin default, ya se rellena en TS).
  - Checks con `glob` → `~` (regex). Ej. color hex:
    `sql\`${t.color_hex} is null or ${t.color_hex} ~ '^#[0-9A-Fa-f]{6}$'\``.
  - `salons`: añadir `onboarding_completed_at: timestamp({ withTimezone: true, mode: 'date' })`
    (nullable, sin default).
  - `bookings.public_id`: mantener `text().notNull().unique().$defaultFn(() => crypto.randomUUID())`
    (igual que hoy; sin default de BD).
  - `bookings.idempotency_key`: `text().unique()` (NULLs múltiples permitidos; **no**
    usar `nulls not distinct`).
  - **No** añadir aquí las columnas `during`, el `EXCLUDE` ni los triggers: van en Task 5.
- [ ] **Step 3 (verificar):** `npx tsc --noEmit` sobre el repo: los errores deben ser
  ahora del tipo *"Property 'get'/'run'/'all' does not exist"* en los call-sites (eso
  confirma que el esquema pg compila y que lo que rompe es el cliente, que se cambia en
  Task 3). No debe haber errores dentro de `lib/db/schema.ts`.
- [ ] **Step 4 (commit):**
```bash
git add lib/db/schema.ts
git commit -m "feat(db): esquema en pg-core (multi-tenant) + onboarding_completed_at"
```

### Task 3: Cliente Postgres y runner de migraciones

**Files:**
- Modify: `lib/db/index.ts`, `scripts/db-migrate.ts`

**Interfaces:**
- Produces: `db` (instancia `drizzle` node-postgres) y `pool` (`pg.Pool`), mismos
  nombres de export que hoy (`db`; sustituir `sqlite` por `pool`).

- [ ] **Step 1:** Reescribir `lib/db/index.ts`:
```ts
import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL no está definida')

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })
```
- [ ] **Step 2:** Reescribir `scripts/db-migrate.ts`:
```ts
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL no está definida')

const pool = new Pool({ connectionString })
const db = drizzle(pool)

await migrate(db, { migrationsFolder: './drizzle' })
await pool.end()
process.stdout.write(`Migrations applied to Postgres\n`)
```
- [ ] **Step 3:** Borrar las migraciones SQLite previas: `rm -rf drizzle/` (se
  regeneran desde cero para Postgres en las tareas siguientes; pre-lanzamiento).
- [ ] **Step 4 (verificar):** `npx tsc --noEmit lib/db/index.ts scripts/db-migrate.ts`
  sin errores en esos ficheros.
- [ ] **Step 5 (commit):**
```bash
git add lib/db/index.ts scripts/db-migrate.ts drizzle
git commit -m "feat(db): cliente node-postgres + migrator pg; baja migraciones sqlite"
```

### Task 4: Migración de extensiones (primera, antes de las tablas)

**Files:**
- Create: `drizzle/0000_extensions.sql` (vía `--custom`)

- [ ] **Step 1:** Generar una migración custom vacía y rellenarla:
```bash
npx drizzle-kit generate --custom --name extensions
```
  En el `.sql` creado, escribir:
```sql
create extension if not exists btree_gist;
create extension if not exists citext;
create extension if not exists pgcrypto;
```
- [ ] **Step 2 (verificar):** `npm run db:migrate` aplica sin error contra el Neon de
  dev. (Solo extensiones; aún no hay tablas.)
- [ ] **Step 3 (commit):**
```bash
git add drizzle
git commit -m "feat(db): migración de extensiones (btree_gist, citext, pgcrypto)"
```

### Task 5: Migración de tablas (generada) + hardening (during, EXCLUDE, triggers)

**Files:**
- Create: `drizzle/0001_*.sql` (generada), `drizzle/0002_hardening.sql` (custom)

- [ ] **Step 1:** Generar las tablas desde el esquema:
```bash
npm run db:generate
```
  Revisar el `.sql` generado: tipos correctos, `citext` en `app_users.email`,
  `generated always as identity` en los PK bigint, checks con `~`.
- [ ] **Step 2:** Crear la migración de hardening:
```bash
npx drizzle-kit generate --custom --name hardening
```
  Rellenarla recuperando el DDL original (`git show c490267:supabase/migrations/<f>`)
  y adaptándolo. Contenido exacto:

  **a) Columnas generadas `during`** (en `bookings` y `booking_items`):
```sql
alter table bookings
  add column during tstzrange
  generated always as (tstzrange(starts_at, ends_at, '[)')) stored;

alter table booking_items
  add column during tstzrange
  generated always as (tstzrange(starts_at, ends_at, '[)')) stored;
```
  **b) EXCLUDE de no-solape por empleado** (recuperado verbatim de
  `…120003_bookings.sql`):
```sql
alter table booking_items
  add constraint booking_items_no_overlap_per_employee
  exclude using gist (
    employee_id with =,
    during with &&
  ) where (booking_status in ('pending','confirmed','in_progress'));
```
  **c) Trigger de validación** (`booking_items_validate`) y **trigger de capacidad**
  (`booking_items_check_capacity`, con `pg_advisory_xact_lock`): recuperar de
  `…120004_booking_validations.sql` **y** la versión ampliada del `validate` con
  horario de salón de `…120001_salon_settings_and_hours.sql` (commit posterior;
  `git log --all --oneline -S "booking_items_validate"` para localizarla). Pegar ambas
  funciones + sus `create trigger`. (Son ~150 líneas; van verbatim, solo verificar que
  los nombres de columnas coinciden con el esquema actual.)
- [ ] **Step 3 (verificar):** `npm run db:migrate` aplica las tres migraciones sin
  error. Comprobar en `db:studio` o con un `SELECT` que el EXCLUDE existe:
```sql
select conname from pg_constraint where conname = 'booking_items_no_overlap_per_employee';
```
- [ ] **Step 4 (commit):**
```bash
git add drizzle
git commit -m "feat(db): tablas + during/EXCLUDE/triggers (validez dura restaurada)"
```

---

## FASE 2 — Conversión síncrono → async (módulo a módulo)

> Aplicar las **reglas de conversión** de la cabecera. Gate de cada tarea: los ficheros
> del módulo dejan de producir errores `.get/.run/.all` en `tsc --noEmit`. Commit por
> módulo: `refactor(<modulo>): queries/actions async sobre Postgres`.

### Task 6: Módulo `lib/auth`
**Files:** `lib/auth/index.ts`, `lib/auth/sessions.ts`, `lib/auth/password-reset.ts`,
`lib/auth/actions.ts`, y los callers `app/login/actions.ts`,
`app/forgot-password/actions.ts`, `app/reset-password/[token]/actions.ts`.
- [ ] Convertir cada `.get/.run/.all` y la `db.transaction` de `password-reset.ts:121`
  a `async` (regla de la cabecera). El `authorize` y los callbacks `jwt`/`session` ya
  son async; propagar `await` a `createSession`/`validateSession`/`revokeSession` si no
  lo estaban.
- [ ] **Verificar:** `npx tsc --noEmit 2>&1 | grep -E "lib/auth|app/login|app/forgot-password|app/reset-password"` → vacío.
- [ ] **Commit.**

### Task 7: Módulo `lib/availability` (incluye concurrencia)
**Files:** `lib/availability/queries.ts`, `engine.ts`, `group.ts`, `booking.ts`.
- [ ] Convertir queries/engine/group a async por las reglas.
- [ ] En `booking.ts`: `validateBookingItemInterval` pasa a `async` (sus SELECTs son
  `await`); `validateAndCreateBooking` envuelve en `await db.transaction(async (tx) => …)`.
- [ ] Sustituir `isSqliteUniqueError` por un detector de códigos Postgres y mapear:
```ts
function pgErrCode(e: unknown): string | undefined {
  return e instanceof Error && 'code' in e
    ? (e as { code?: string }).code : undefined
}
// en el catch:
const code = pgErrCode(e)
if (code === '23P01') return { ok: false, code: 'EMPLOYEE_OVERLAP', message: 'Ese empleado ya tiene una reserva en ese horario.' }
if (code === '23514') return { ok: false, code: 'CAPACITY_EXCEEDED', message: 'No hay disponibilidad para ese servicio en ese horario.' }
if (code === '23505' && input.idempotencyKey) { /* replay idempotente: SELECT por idempotency_key, devolver ok */ }
```
  El pre-check TS (pasos 1–15) se mantiene como error amable; el `EXCLUDE`/capacidad de
  BD son la garantía bajo concurrencia.
- [ ] **Verificar:** `npx tsc --noEmit 2>&1 | grep "lib/availability"` → vacío.
- [ ] **Verificar manual (riesgo alto):** con la app en `npm run dev`, crear dos
  reservas solapadas para el mismo empleado → la segunda devuelve `EMPLOYEE_OVERLAP`.
  Con un servicio `max_concurrent=1`, dos reservas solapadas → la segunda
  `CAPACITY_EXCEEDED`.
- [ ] **Commit.**

### Task 8: Módulo `lib/bookings`
**Files:** `queries.ts`, `queries-calendar.ts`, `queries-today.ts`, `status.ts`,
`status-actions.ts` (tiene `db.transaction`), `note-actions.ts`.
- [ ] Convertir por reglas; `status-actions.ts:38` → `await db.transaction(async …)`.
- [ ] **Verificar:** `tsc --noEmit | grep "lib/bookings"` → vacío. **Commit.**

### Task 9: Módulo `lib/clients`
**Files:** `lib/clients/queries.ts`.
- [ ] Convertir. **Verificar** grep vacío. **Commit.**

### Task 10: Módulo `lib/employees`
**Files:** `actions.ts`, `queries.ts`, `slug.ts`, `schema.ts`.
- [ ] Convertir (incluye lookups de slug `.get()`). **Verificar** grep vacío. **Commit.**

### Task 11: Módulo `lib/services`
**Files:** `actions.ts` (2 `db.transaction`), `queries.ts`, `slug.ts`, `schema.ts`.
- [ ] Convertir; las dos `db.transaction` a `async`. **Verificar** grep vacío. **Commit.**

### Task 12: Módulo `lib/salons` + `lib/salon.ts`
**Files:** `lib/salons/actions.ts` (2 `db.transaction`), `lib/salons/queries.ts`,
`lib/salons/schema.ts`, `lib/salon.ts` (`getCurrentSalon`).
- [ ] Convertir. `getCurrentSalon` (en `lib/salon.ts`) ya es `async`; asegurar `await`
  en su SELECT. **Verificar** grep vacío. **Commit.**

### Task 13: Módulo `lib/email`
**Files:** `load-context.ts`, `notifications-log.ts`, `triggers/on-booking-created.ts`,
`triggers/send-reminders.ts`.
- [ ] Convertir. **Verificar** grep vacío. **Commit.**

### Task 14: Rutas y componentes en `app/`
**Files:** `app/admin/calendar/_actions/create-block.ts`, `…/move-booking.ts`,
`app/admin/calendar/page.tsx`, `app/admin/employees/...` (pages + `_components` que
leen datos), `app/admin/salon/...`, `app/admin/services/[id]/edit/page.tsx`,
`app/admin/today/...`, `app/admin/layout.tsx`, `app/api/_dev/availability/route.ts`,
`app/api/cron/send-reminders/route.ts`, `app/api/health/route.ts`,
`app/[salonSlug]/book/_lib/booking-flow-schema.ts`.
- [ ] Convertir cada `.get/.run/.all` por reglas. Donde un Server Component leía datos
  de forma síncrona, hacer el componente `async` y `await`.
- [ ] **`app/api/cron/send-reminders`:** verificar que la query **no asume un único
  salón** (ahora itera todos los tenants). Si filtra por "el salón único", cambiar a
  recorrer todos.
- [ ] **`app/api/health`:** debe hacer un `select 1` async contra Postgres.
- [ ] **Verificar:** `npx tsc --noEmit` → **0 errores en todo el repo**.
  `npm run lint` y `npm run build` pasan.
- [ ] **Commit.**

---

## FASE 3 — Aislamiento: guard `withTenant` + RLS (A.4)

### Task 15: Helper `withTenant` (contexto de tenant por transacción)

**Files:**
- Create: `lib/db/tenant.ts`

**Interfaces:**
- Produces: `withTenant<T>(salonId: number, fn: (tx: TxDb) => Promise<T>): Promise<T>`.

**Nota:** no hace falta crear un rol nuevo. En Neon te conectas como owner de las
tablas, y el owner hace *bypass* de RLS por defecto; eso se neutraliza marcando las
tablas con `force row level security` en la Task 16. Así la RLS aplica también a la
conexión de la app sin gestionar roles.

- [ ] **Step 1:** `lib/db/tenant.ts`:
```ts
import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function withTenant<T>(
  salonId: number,
  fn: (tx: TxDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_salon_id', ${String(salonId)}, true)`,
    )
    return fn(tx)
  })
}
```
- [ ] **Step 2 (verificar):** `npx tsc --noEmit lib/db/tenant.ts` sin errores.
- [ ] **Step 3 (commit):** `git add lib/db/tenant.ts && git commit -m "feat(db): withTenant + GUC app.current_salon_id"`

### Task 16: Policies RLS (adaptadas del original)

**Files:**
- Create: `drizzle/0003_rls.sql` (custom)

- [ ] **Step 1:** Recuperar `git show c490267:supabase/migrations/20260510120005_rls.sql`
  como **mapa** (qué tablas llevan RLS, cuáles necesitan lectura pública). Reescribir el
  enforcement: sustituir `is_salon_member(...)`/`auth.uid()` por el GUC. Para cada tabla
  de negocio con `salon_id`:
```sql
alter table employees enable row level security;
alter table employees force row level security;
create policy employees_tenant on employees
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);
```
  (Repetir para `services`, `clients`, `employee_*`, `salon_*`, `bookings`,
  `booking_items`, `booking_status_events`, `booking_tokens`, `booking_notifications`,
  `app_users`.) Tablas hijas sin `salon_id` directo (`employee_services`,
  `employee_weekly_schedule`, `employee_recurring_breaks`, `employee_time_off`): policy
  por `exists (select 1 from employees e where e.id = employee_id and e.salon_id =
  current_setting('app.current_salon_id', true)::bigint)`.
  `salons`: policy de tenant por `id = current_setting(...)::bigint` para escritura.
  `current_setting(…, true)` (missing_ok) devuelve NULL si no hay tenant fijado →
  **deniega por defecto** (fail-closed).
- [ ] **Step 2 (verificar manual, riesgo alto):** con `withTenant(1, …)` activo, un
  `select` de filas con `salon_id = 2` devuelve **0 filas**; un `insert` con
  `salon_id = 2` es rechazado por la policy `with check`.
- [ ] **Step 3 (commit):** `git add drizzle && git commit -m "feat(db): RLS por tenant (GUC) en todas las tablas de negocio"`

### Task 17: Enrutar las lecturas/escrituras por contexto de tenant

**Files:** call-sites de dashboard (`lib/salons`, `lib/employees`, `lib/services`,
`lib/clients`, `lib/bookings`, `lib/availability`) y el resolver del flujo público
`app/[salonSlug]/book/_actions/*`.

- [ ] **Dashboard:** las acciones que hoy hacen `getCurrentSalon()` + queries sueltas
  deben ejecutar sus queries dentro de `withTenant(salon.id, async (tx) => …)` (o un
  wrapper de request que fije el GUC). Auditar que **ningún** call-site consulta "el
  único salón"; todos parten del `salonId` del token / del slug.
- [ ] **Flujo público de reserva:** resolver `salon_id` desde `salonSlug`, y ejecutar
  el `validateAndCreateBooking` y SELECTs de disponibilidad dentro de `withTenant`.
- [ ] **Verificar:** `tsc --noEmit` 0 errores; QA manual de una reserva pública y de una
  acción de dashboard end-to-end.
- [ ] **Commit:** `refactor(tenant): todas las queries de negocio pasan por withTenant`.

---

## FASE 4 — Gating de onboarding por-tenant (A.3)

### Task 18: `isSalonOnboarded` y baja del cache global

**Files:** Modify `lib/setup/is-configured.ts`; callers en `app/setup/layout.tsx`,
`lib/setup/perform-setup.ts`.

- [ ] Sustituir `isInstanceConfigured()` (global, cache de módulo) por:
```ts
import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { salons } from '@/lib/db/schema'

export async function isSalonOnboarded(salonId: number): Promise<boolean> {
  const row = (
    await db.select({ done: salons.onboarding_completed_at })
      .from(salons).where(eq(salons.id, salonId)).limit(1)
  )[0]
  return row?.done != null
}
```
  Eliminar `configuredCache`, `invalidateConfiguredCache`, `__resetConfiguredCacheForTests`.
- [ ] `perform-setup.ts`: al completar el setup, setear
  `salons.onboarding_completed_at = new Date()` en la transacción (en vez de depender
  del cache global). Pasar su `db.transaction` a `async`.
- [ ] **Verificar:** `tsc --noEmit` 0 errores.
- [ ] **Commit:** `feat(setup): gating de onboarding por-tenant (onboarding_completed_at)`.

### Task 19: Middleware/layout: redirigir según onboarding del salón del usuario

**Files:** `app/setup/layout.tsx`, y el punto de gate de `/admin` (`app/admin/layout.tsx`
o `proxy.ts`).

- [ ] **Leer primero** `node_modules/next/dist/docs/` para el patrón de middleware/
  redirect de esta versión de Next (breaking changes, ver `AGENTS.md`).
- [ ] El gate deja de preguntar "¿existe algún salón?" y pregunta "¿el salón del usuario
  logueado (`session.user.salonId`) tiene `onboarding_completed_at`?". Si no, redirige a
  `/setup`. Si lo tiene y entra a `/setup`, redirige a `/admin`.
- [ ] **Verificar manual:** usuario con salón sin onboarding → cae en `/setup`; con
  onboarding → `/admin`. (El cableado de signup→wizard es de B; aquí solo el gating.)
- [ ] **Commit:** `feat(setup): gate de /admin y /setup por onboarding del tenant`.

---

## FASE 5 — Limpieza y cierre

### Task 20: Retirar SQLite y tests acoplados; smoke final

**Files:** `package.json`, `lib/setup/__tests__/setup-instance.test.ts`,
`lib/availability/__tests__/*` (si rompen), `vitest.config.ts`, `lib/__test-stubs__/`,
restos de `better-sqlite3`.

- [ ] Eliminar `better-sqlite3` y `@types/better-sqlite3` de `package.json`
  (`npm uninstall better-sqlite3 @types/better-sqlite3`). Verificar que ningún import
  los referencia (`grep -rn "better-sqlite3" lib app scripts`).
- [ ] Eliminar `lib/setup/__tests__/setup-instance.test.ts` (acoplado a SQLite; la
  política es QA manual). Revisar `lib/availability/__tests__/*`: `intervals.test.ts` y
  `time.test.ts` son lógica pura y pueden romper solo por imports — eliminarlos también
  para no dejar rastro de tests (decisión del usuario), junto con `vitest.config.ts`,
  `lib/__test-stubs__/server-only.ts`, los scripts `test`/`test:watch`, el paso `test`
  de `predeploy`, y las devDeps `vitest`/`@vitest/coverage-v8`.
- [ ] Actualizar `predeploy` a `npm run lint && npm run build`.
- [ ] **Verificar (gate final de A):** `npx tsc --noEmit` (0 errores) · `npm run lint` ·
  `npm run build` · `npm run db:migrate` sobre una BD Neon limpia · QA manual del flujo
  completo: reserva pública end-to-end, login/dashboard, una acción de cada módulo,
  aislamiento (un tenant no ve datos de otro), gating de onboarding.
- [ ] **Commit:** `chore: retirar better-sqlite3 y tooling de tests; cierre de A`.

---

## Self-review (cobertura del spec)

- A.1 migración Postgres → Tasks 1–5 (driver, esquema, cliente, migrator, extensiones,
  tablas) + Fase 2 (async, 54 ficheros). ✅
- A.2 validez dura (EXCLUDE + advisory lock capacidad + triggers) → Task 5 + Task 7
  (mapeo de errores). ✅
- A.4 aislamiento (guard + RLS) → Tasks 15–17. ✅
- A.3 gating por-tenant → Tasks 18–19. ✅
- Limpieza (SQLite, tests, build) → Task 20. ✅
- Verificación manual + typecheck/build (sin tests nuevos) → en cada tarea. ✅

---

## Execution handoff

Plan guardado. El usuario eligió **implementar con subagentes**, así que la ejecución es:

**Subagent-Driven** (`superpowers:subagent-driven-development`): un subagente fresco por
tarea, con review entre tareas. Recomendado crear el workspace de implementación con
`superpowers:using-git-worktrees` (rama `feature/postgres-multitenant` desde `main`,
incorporando estos docs), y arrancar por la Task 1 tras el prerrequisito manual de Neon.
