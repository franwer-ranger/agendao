# Sub-proyecto A — Fundación multi-tenant (Postgres + tenancy + aislamiento)

> Primer sub-proyecto del giro a SaaS. Ver el diseño maestro en
> `2026-06-30-saas-pivot-design.md`. A convierte la base técnica de
> **single-tenant + SQLite** a **multi-tenant + Postgres**, para que B (signup +
> landing), C (billing) y D (superadmin) se construyan encima con seguridad.
>
> Fecha: 2026-06-30. Estado: diseño, pendiente de revisión → writing-plans.

---

## 1. Objetivo y alcance

**A entrega:**
1. La app corriendo sobre **Postgres (Neon)** en lugar de SQLite.
2. **Validez dura restaurada en la BD** (constraints `EXCLUDE`, triggers de
   validación y capacidad) — recuperada y adaptada del Postgres original.
3. **Aislamiento por tenant** con guard en la app **y** RLS en la BD.
4. **Gating de onboarding por-tenant** (sustituye al "first-boot" global).

**Fuera de alcance de A** (son B/C/D): signup público, landing comercial, billing/
Stripe, UI de superadmin, migración de uploads a object storage, SMS/depósitos.

**Contexto que no cambia en A:** uploads siguen en volumen local; el flujo de
reserva `/[salonSlug]/book` y el dashboard `/admin/*` siguen existiendo; auth sigue
siendo JWT(sid) + `auth_sessions`.

---

## 2. Hallazgo clave: gran parte es recuperable del historial

La app **vivió en Postgres (Supabase)** antes de migrar a SQLite. El `booking.ts`
actual es una réplica TS de triggers/constraints de Postgres. Esas definiciones
**siguen en el historial de git** (commit `c490267`, dir `supabase/migrations/`):

| Artefacto original | Estado para A |
|---|---|
| `extensions_and_core.sql` (`btree_gist`, `citext`, `pgcrypto`) | **Reutilizable** |
| `during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored` (en `bookings` y `booking_items`) | **Reutilizable** — alimenta `EXCLUDE` y los `&&` |
| `EXCLUDE USING gist` `booking_items_no_overlap_per_employee` | **Reutilizable** |
| Trigger `booking_items_validate` (+ versión ampliada en `salon_settings_and_hours.sql` con horario de salón) | **Reutilizable** (reconstruir la versión final, evolucionó en 2 migraciones) |
| Trigger `booking_items_check_capacity` (usa `pg_advisory_xact_lock`) | **Reutilizable** |
| `rls.sql` (266 líneas) | **Solo referencia** — montado sobre Supabase Auth (`auth.uid()`); hay que reescribir el enforcement sobre el contexto de tenant de la app |

**Implicación:** el grueso conceptual de A.2 (validez dura) se recupera; el de A.4
(RLS) se reescribe usando el original como mapa de cobertura.

---

## 3. A.1 — Migración a Postgres

**Driver y config.**
- `drizzle-orm/better-sqlite3` → `drizzle-orm/node-postgres` con `pg.Pool`.
- Conexión: **connection string *pooled* de Neon** (trae PgBouncer integrado).
- `drizzle.config.ts`: `dialect: 'sqlite'` → `'postgresql'`; regenerar migraciones
  desde cero (pre-lanzamiento, sin datos que conservar). Borrar `drizzle/*.sql`
  de SQLite.
- `lib/db/index.ts`: quitar `better-sqlite3`, WAL pragmas y `mkdirSync`; exponer el
  `db` de node-postgres y el pool.

**Mapeo de tipos (esquema `lib/db/schema.ts` → `pgTable`).**
- `integer({ mode: 'timestamp_ms' })` → `timestamp({ withTimezone: true })`. **Bajo
  churn**: Drizzle ya surfacea estas columnas como `Date` en ambos modos, así que el
  código TS que las consume no cambia de tipo.
- `customType citext` (`text collate nocase`) → tipo `citext` real (extensión).
- `CHECK ... glob '#[0-9A-Fa-f]...'` → `CHECK ... ~ '^#[0-9A-Fa-f]{6}$'` (regex PG).
- `unixepoch()*1000` default → `now()`.
- `integer().primaryKey({ autoIncrement: true })` → `bigint generated always as identity`.
- `text({ mode: 'json' })` → `jsonb`.
- Reintroducir las **columnas generadas `during`** y el `EXCLUDE` (ver A.2), que no
  existen en el esquema SQLite actual.

**Conversión síncrono → async (el grueso del trabajo).**
- **54 ficheros** usan `.get()/.run()/.all()` (síncronos de better-sqlite3). En
  node-postgres todo es asíncrono: `.get()`→`await ....then(r=>r[0])` o el helper
  equivalente de Drizzle; `.all()`→`await`; `.run()`→`await`.
- **8 transacciones** `db.transaction((tx) => …)` (callback síncrono) →
  `db.transaction(async (tx) => …)`. Sitios: `lib/availability/booking.ts:403`,
  `lib/bookings/status-actions.ts`, `lib/auth/password-reset.ts`,
  `lib/setup/perform-setup.ts`, `lib/salons/actions.ts` (×2),
  `lib/services/actions.ts` (×2).
- El tipo `TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]` se recalcula
  solo al cambiar el `db`.
- **Hacer la conversión módulo por módulo, no entremezclada** (riesgo de bugs
  sutiles de promesas sin `await`).

**Idempotencia / mapeo de errores.**
- `isSqliteUniqueError` (`code === 'SQLITE_CONSTRAINT_UNIQUE'`) → unique violation
  Postgres `code === '23505'`.
- Violación del `EXCLUDE` → `code === '23P01'` (`exclusion_violation`) → mapear a
  `EMPLOYEE_OVERLAP`.
- Violación de capacidad (trigger lanza `check_violation`) → `23514` → mapear a
  `CAPACITY_EXCEEDED`.

---

## 4. A.2 — Validez dura restaurada (concurrencia híbrida)

Decisión tomada: **híbrido** — el solape de empleado lo garantiza la BD de forma
atómica; la capacidad concurrente se serializa.

- **No-solape por empleado:** restaurar la columna generada `during` + el
  `EXCLUDE USING gist (employee_id WITH =, during WITH &&) WHERE (booking_status in
  activos)` en `booking_items`. Hace el doble-booking **imposible** a nivel de BD,
  sin locks de aplicación. El check TS (paso 14 de `booking.ts`) se queda como
  **pre-check de error amable**, no como garantía.
- **Capacidad concurrente (`max_concurrent`):** **advisory lock** (decidido).
  Restaurar el mecanismo original: `pg_advisory_xact_lock(hashtextextended('cap:'
  || service_id))` dentro de la transacción, contar los solapes activos y rechazar
  con `service_capacity_exceeded` (`errcode 'check_violation'`) si `>= cap`. Sin
  bucle de reintentos, determinista, y ya escrito en el trigger original
  `booking_items_check_capacity`.
- **El resto de validaciones** (pertenencia al salón, autorización empleado↔
  servicio, horario semanal, horario de salón, descansos, time-off, cierres,
  antelación mínima): se restauran como **triggers** `booking_items_validate`
  (recuperando la versión final) **o** se mantienen en TS como pre-check. Dado el
  híbrido, la línea sensata: la BD garantiza lo que TS no puede garantizar bajo
  concurrencia (solape y capacidad); el resto puede vivir en TS como pre-check + un
  trigger de validación como red de seguridad. Detalle a fijar en el plan.
- **TS pasa a ser pre-check + composición de disponibilidad**, no la única frontera
  de validez. Alinea con la memoria `project_sql_vs_ts_split`.

---

## 5. A.3 — Gating de onboarding por-tenant

- Sustituir `isInstanceConfigured()` (global, "¿existe algún salón?", cachea `true`
  a nivel de módulo) por **`isSalonOnboarded(salonId)`**.
- Nuevo campo `salons.onboarding_completed_at timestamptz null`.
- **Eliminar el cache de módulo** de `lib/setup/is-configured.ts` (correcto en
  single-tenant, incorrecto con N tenants).
- El gate deja de preguntar por la existencia de un salón y pregunta si **el salón
  del usuario logueado** terminó su onboarding; si no, lo lleva al wizard.
- Nota: el wizard como flujo de signup/onboarding se cablea en **B**; A solo deja el
  mecanismo de gating per-tenant listo y elimina la asunción de instancia única.
- **Cambios de middleware/routing deben seguir la guía del Next.js de este repo**
  (`node_modules/next/dist/docs/`), que tiene breaking changes (ver `AGENTS.md`).

---

## 6. A.4 — Aislamiento: guard en app + RLS

Defensa en profundidad: la app filtra por tenant **y** la BD rechaza accesos
cross-tenant aunque la app tenga un bug.

**Guard en la app.**
- Helper `withTenant(salonId, fn)` que abre una transacción, fija el contexto de
  tenant (`SET LOCAL app.current_salon_id = <id>`) y ejecuta las queries dentro.
- Los repos del dashboard reciben `salonId` (del token) de forma obligatoria.
  Auditar los **54 ficheros**: ningún call-site puede consultar "el único salón";
  todos filtran por el `salonId` del contexto.

**RLS en Postgres.**
- **Rol de aplicación dedicado** (no owner, no superuser) para que las policies
  apliquen de verdad (owners/superusers hacen bypass de RLS).
- `enable row level security` + `force row level security` en cada tabla con
  `salon_id`.
- Policy genérica por tabla: `using (salon_id = current_setting('app.current_salon_id')::bigint)`
  y `with check (...)` análogo. La app fija el GUC vía `withTenant` (dashboard) y vía
  el resolver de slug (flujo público de reserva).
- **Flujo público de reserva** (`/[salonSlug]/book`, sin usuario logueado): resuelve
  `salon_id` desde el slug y fija el mismo contexto de tenant para sus
  INSERT/SELECT.
- **Superadmin** (D): rol/ruta con bypass de RLS (o GUC especial). En A solo se deja
  previsto; la UI es D.
- `rls.sql` original = **mapa de qué tablas y qué forma de policy**; el enforcement
  se reescribe sobre el GUC `app.current_salon_id` (no `auth.uid()`).

---

## 7. Estrategia de verificación

> Recordatorio del proyecto: **no hay tests automatizados** en agendao; el QA es
> manual (memoria `feedback_no_automated_tests`). La "verificación" aquí es manual y
> por inspección, salvo que decidas explícitamente lo contrario para las piezas de
> mayor riesgo.

Piezas que exigen verificación deliberada por su riesgo:
- **Concurrencia de reservas:** dos reservas simultáneas al mismo empleado/hueco →
  exactamente una gana (la otra recibe `EMPLOYEE_OVERLAP`). Capacidad: N+1 reservas
  concurrentes del mismo servicio con `max_concurrent=N` → la N+1 recibe
  `CAPACITY_EXCEEDED`. (Punto de mayor regresión.)
- **Aislamiento RLS:** con el contexto de un salón fijado, una query que intente
  leer/escribir filas de otro `salon_id` devuelve vacío / es rechazada.
- **Smoke de migración:** el wizard sobre BD limpia y el flujo de reserva completo
  funcionan sobre Postgres.

---

## 8. Riesgos

- **Promesas sin `await`** durante la conversión async: bug silencioso (datos que
  parecen escribirse pero no, o race). Mitigar: conversión por módulo + lint de
  floating promises si está disponible.
- **GUC de tenant no fijado** en algún camino → RLS deniega todo (falla ruidoso,
  bueno) o, peor, un camino con rol equivocado hace bypass (falla silencioso).
  Centralizar el set del GUC en `withTenant` y en el resolver público; no fijarlo
  ad-hoc.
- **Trigger `validate` vs pre-check TS divergentes:** ya pasó una vez
  (`fix(availability): cerrar disparidad motor/trigger`). Definir claramente qué es
  garantía (BD) y qué es pre-check (TS) para no duplicar lógica que derive.
- **Pool/Neon:** agotar conexiones si no se usa el endpoint pooled o si las
  transacciones quedan abiertas. Usar el string pooled y cerrar siempre.

---

## 9. Orden de trabajo dentro de A

```
A.1 (Postgres + schema + async)  →  A.2 (validez dura)  →  A.4 (RLS)  →  A.3 (gating)
```

- **A.1 primero**: sin Postgres no hay nada. Es el grueso (54 ficheros).
- **A.2 después**: restaurar EXCLUDE/triggers sobre el esquema ya en PG.
- **A.4**: RLS sobre el esquema ya estable.
- **A.3**: el gating per-tenant es pequeño y puede ir al final o en paralelo con A.4.

---

## 10. Referencias

- Diseño maestro: `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`.
- DDL Postgres original (recuperar con `git show c490267:supabase/migrations/<f>`):
  - `…120001_extensions_and_core.sql` — extensiones + tablas core.
  - `…120003_bookings.sql` — `during` generado + `EXCLUDE`.
  - `…120004_booking_validations.sql` — triggers validate + capacity.
  - `…120005_rls.sql` — RLS (solo referencia, era Supabase Auth).
  - `…120001_salon_settings_and_hours.sql` (commit posterior) — versión ampliada del
    trigger `validate` con horario de salón.

---

## Estado del diseño

Todas las decisiones de A están cerradas. Siguiente paso: writing-plans para el
plan de implementación detallado.
