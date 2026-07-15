# Plan 010: Índice `(salon_id, starts_at)` en `booking_items` y pool de pg acotado

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/db/schema.ts lib/db/index.ts drizzle/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

The hottest read paths — admin calendar, the "Hoy" panel, and public
availability — all query `booking_items` by `salon_id` plus a `starts_at`/
`ends_at` time range. The table has indexes on `booking_id`, `service_id`,
`employee_id`, and two *partial* indexes leading with `employee_id`/
`service_id`, but **none leading with `salon_id`**. In the shared multi-tenant
Postgres, those queries degrade linearly with *all tenants'* bookings (RLS
adds a filter, not an access path). Separately, the `pg` pool is created with
all defaults: no explicit `max`, and no `connectionTimeoutMillis`, so pool
saturation blocks requests indefinitely instead of failing fast — risky given
every `withTenant` call holds a connection for a whole transaction.

## Current state

- `lib/db/schema.ts:483-491` — current `booking_items` indexes:

```ts
    index('booking_items_booking_id_idx').on(t.booking_id),
    index('booking_items_service_id_idx').on(t.service_id),
    index('booking_items_employee_id_idx').on(t.employee_id),
    index('booking_items_employee_starts_active_idx')
      .on(t.employee_id, t.starts_at)
      .where(sql`${t.booking_status} in ('pending','confirmed','in_progress')`),
    index('booking_items_service_starts_active_idx')
      .on(t.service_id, t.starts_at)
      .where(sql`${t.booking_status} in ('pending','confirmed','in_progress')`),
```

  (For contrast, `bookings` already has `bookings_salon_starts_idx` on
  `(salon_id, starts_at)` — `lib/db/schema.ts:444`.)
- Query shapes served by the new index:
  - `lib/bookings/queries-calendar.ts:86-92` and
    `lib/bookings/queries-today.ts:79-85` — `salon_id = ? AND starts_at < ?
    AND ends_at > ?` (all statuses).
  - `lib/availability/queries.ts:225-232` — `salon_id = ? AND status IN
    ('pending','confirmed','in_progress') AND range`.
- `lib/db/index.ts` — complete file:

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

- Migration workflow: `npm run db:generate` (drizzle-kit reads
  `lib/db/schema.ts`, emits `drizzle/00NN_*.sql`); migrations are applied by
  `npm run db:migrate` locally and by `scripts/migrate-prod.mjs` on deploy.
  Existing custom migrations show the numbering: latest is
  `drizzle/0003_rls.sql`.

## Commands you will need

| Purpose            | Command               | Expected on success |
|--------------------|-----------------------|---------------------|
| Generate migration | `npm run db:generate` | new `drizzle/0004_*.sql` |
| Apply locally      | `npm run db:migrate`  | exit 0 (needs a local Postgres per `.env.local`) |
| Lint               | `npm run lint`        | exit 0              |
| Build              | `npm run build`       | exit 0              |

## Scope

**In scope**:
- `lib/db/schema.ts` (only the `booking_items` index list)
- `lib/db/index.ts`
- The generated migration under `drizzle/` + its `meta/` snapshot (generated
  by drizzle-kit — do not hand-edit SQL unless the STOP condition applies)

**Out of scope** (do NOT touch):
- Any query code — the planner picks the index; no query changes.
- Existing indexes — additive only; drop nothing.
- `drizzle/0000-0003` migration files.

## Git workflow

- Branch: `advisor/010-booking-items-index-and-pool`
- Commit message style: `perf(db): índice (salon_id, starts_at) en booking_items y pool acotado`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the index to the schema

In `lib/db/schema.ts`, append to the `booking_items` index list:

```ts
    index('booking_items_salon_starts_idx').on(t.salon_id, t.starts_at),
```

(One non-partial index: it serves the calendar/today queries, which include
terminal statuses, and still helps the availability scan; a second partial
variant is not worth the write amplification at this scale.)

**Verify**: `npm run db:generate` → emits a new `drizzle/0004_*.sql`
containing exactly one statement:
`grep -i "create index" drizzle/0004_*.sql` → one line mentioning
`booking_items_salon_starts_idx` on `(salon_id, starts_at)` (drizzle may
quote/format differently — the columns and table are what matter). If the
generated file contains **anything else** (drops, alters of other tables),
see STOP conditions.

### Step 2: Apply locally (if a local DB is configured)

If `.env.local` has a reachable `DATABASE_URL`: `npm run db:migrate` → exit
0. If no local Postgres is available, skip and note it in your report — the
generated SQL review in Step 1 is the gate.

### Step 3: Bound the pool

In `lib/db/index.ts` replace the pool construction:

```ts
// Pool acotado: cada withTenant retiene una conexión durante toda su
// transacción. max explícito y fail-fast al saturarse (mejor un error
// visible que requests colgados). Override por env para tuning sin deploy.
export const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
```

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

### Step 4 (optional, only if a seeded local DB exists): sanity-check the planner

`psql "$DATABASE_URL" -c "explain analyze select * from booking_items where salon_id = 1 and starts_at < now() + interval '1 day' and ends_at > now();"`
→ plan mentions `booking_items_salon_starts_idx` (with tiny seed data the
planner may still choose a seq scan — that's fine; don't chase it).

## Test plan

No automated tests (repo policy). The generated-SQL review plus lint/build
are the gates; the index takes effect in prod on the next deploy's
migration run (`scripts/migrate-prod.mjs`).

## Done criteria

- [ ] `booking_items_salon_starts_idx` exists in `lib/db/schema.ts` and in a
      new `drizzle/0004_*.sql`
- [ ] `lib/db/index.ts` sets `max`, `idleTimeoutMillis`,
      `connectionTimeoutMillis`
- [ ] `npm run lint` and `npm run build` exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run db:generate` produces a migration containing anything beyond the
  one CREATE INDEX (that means schema.ts and the migration history have
  drifted apart — applying it could alter prod tables unexpectedly).
- `PG_POOL_MAX` conflicts with an existing env var of the same name
  (`grep -rn "PG_POOL_MAX" .` first).

## Maintenance notes

- Sizing rule: `PG_POOL_MAX × app instances` must stay below the Postgres
  `max_connections` (minus superuser slots). Today: 1 instance, Neon pooled
  connection string recommended.
- `connectionTimeoutMillis: 5000` means pool exhaustion now surfaces as
  thrown errors in actions — if these appear in Sentry/logs, that's the
  signal to tune, not to remove the timeout.
- If booking volume grows and the availability scan shows up in slow-query
  logs despite this index, the follow-up is the partial
  `(salon_id, starts_at) WHERE booking_status IN (...)` variant.
