# Plan 011: Realinear la documentación raíz con la realidad SaaS/Postgres

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- README.md MEMORY.md AGENTS.md PLAN.md PLAN_FINAL.md PLAN_MIGRACION_VPS.md`
> If any in-scope file changed since this plan was written, re-read it before
> proceeding; on a fundamental mismatch (e.g. someone already rewrote the
> README), treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

The repo pivoted (design doc dated 2026-06-30) from "one SQLite instance per
client" to a multi-tenant Postgres SaaS, and the migration landed — but the
root docs never caught up. `README.md` teaches a SQLite setup that no longer
exists; `MEMORY.md` asserts the abandoned business model as current truth;
the pivot doc's own §10 mandates rewriting/archiving these and it never
happened. These files are exactly what humans *and coding agents* read first,
so today they install a wrong mental model of the architecture. `AGENTS.md`
is 4 lines and documents none of the conventions (tenant discipline, no-tests
policy, commands) that every future change must honor.

**Source of truth for all content below**:
`docs/superpowers/specs/2026-06-30-saas-pivot-design.md` — read it fully
before writing anything.

## Current state

- `README.md` — lines 23-60: section "Database (local Drizzle + SQLite)"
  claims "two data layers in parallel: Supabase/Postgres + Drizzle SQLite",
  instructs `DATABASE_URL=./data/dev.db`; lines 110-145 describe SQLite in
  Docker (better-sqlite3/QEMU, `.db` in a volume); lines 219-224 "SQLite no
  soporta réplicas paralelas". Reality: SQLite was removed in commit
  `519ce13`; the stack is Postgres (`pg` + Drizzle), RLS per tenant,
  migrations in `drizzle/`. The auth section (lines 62-108) is still mostly
  accurate (JWT + `auth_sessions`, roles, reset flow). The Kamal sections
  are structurally right but reference SQLite specifics.
- `MEMORY.md` — asserts "cada peluquería tiene su propia instancia
  desplegada" (§Qué es Agendao), SQLite/better-sqlite3/Litestream stack
  table, DigitalOcean droplets, "Auth.js: sesiones en DB, no JWT" (wrong —
  it's JWT with `sid` validated against `auth_sessions`), and a "Cómo usar
  este documento" section that says the file must be kept current.
- `PLAN.md`, `PLAN_FINAL.md`, `PLAN_MIGRACION_VPS.md` — pre-pivot roadmaps.
  Pivot doc §10: `PLAN_MIGRACION_VPS.md` → **archive, don't delete**;
  others → rewrite business/infra/onboarding sections.
- `AGENTS.md` — complete current content (plus `CLAUDE.md` = `@AGENTS.md`):

```markdown
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
```

- Key facts the rewritten docs must state (verified in code at `7bff3dd`):
  - Stack: Next.js 16 (App Router) + TypeScript, Drizzle + `pg` on Postgres
    (Neon in prod), Auth.js v5 Credentials + JWT-with-`sid` validated
    against `auth_sessions` (instant revocation by deleting the row),
    Resend + react-email, Kamal 2 deploy to a Hetzner VPS, uploads on the
    host volume.
  - Multi-tenant: every business table carries `salon_id`; **hard validity
    lives in Postgres** (EXCLUDE no-overlap, triggers, RLS via GUC
    `app.current_salon_id`), **composition/business rules live in TS**;
    all tenant-scoped access goes through `withTenant(salonId, fn)`
    (`lib/db/tenant.ts`), which opens a transaction and sets the GUC;
    RLS is fail-closed when the GUC is unset.
  - Per-tenant onboarding gating via `salons.onboarding_completed_at`
    (`lib/setup/is-configured.ts`).
  - Commands: `npm run dev / lint / build / db:generate / db:migrate /
    db:seed / db:studio`; admin bootstrap `tsx scripts/create-admin.ts`.
    (If plan 007 landed, also `npm run typecheck`.)
  - **No automated tests — deliberate policy.** QA is manual. Never add
    test files, frameworks, or CI test steps.
  - Locale fixed `es-ES`, TZ `Europe/Madrid`; comments in Spanish; local
    date+time → UTC conversions must use `madridLocalDateTimeToUtc`
    (`lib/availability/time.ts`).
  - Kamal builds from a **git clone** — uncommitted changes never deploy.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0 (markdown isn't linted, but run it to prove nothing else broke) |

## Scope

**In scope**:
- `README.md` (rewrite the stale sections)
- `MEMORY.md` (rewrite business/infra/onboarding sections)
- `AGENTS.md` (expand)
- `PLAN_MIGRACION_VPS.md`, `PLAN.md`, `PLAN_FINAL.md` (move)
- `docs/archive/` (create)

**Out of scope** (do NOT touch):
- `docs/superpowers/**` — the pivot design doc and sub-project specs are the
  source of truth; never edit them here.
- `CLAUDE.md` — stays as `@AGENTS.md`.
- Any code file.
- Inventing product decisions not present in the pivot doc — where the doc
  is silent, the new text stays silent too.

## Git workflow

- Branch: `advisor/011-docs-realignment`
- Commit message style: `docs: README/MEMORY/AGENTS reflejan el SaaS multi-tenant sobre Postgres`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Archive the dead roadmaps

`mkdir -p docs/archive` and `git mv PLAN_MIGRACION_VPS.md PLAN.md PLAN_FINAL.md docs/archive/`.
Add a one-paragraph `docs/archive/README.md`: these documents describe the
pre-2026-06-30 "instance per client / SQLite" model, superseded by
`docs/superpowers/specs/2026-06-30-saas-pivot-design.md`; kept for
historical context. (Archiving all three is the conservative reading of
pivot doc §10 — rewriting the two PLANs' business sections has no audience
now that the pivot doc exists.)

**Verify**: `ls PLAN*.md 2>/dev/null` → no matches; `ls docs/archive/` → 4 files.

### Step 2: Rewrite `README.md`

Keep the overall structure (setup → auth → Docker → Kamal) but make it
Postgres/SaaS-true:

- Intro: one paragraph on what agendao is (multi-tenant SaaS de reservas
  para peluquerías) with a pointer to the pivot doc.
- **Setup local**: requirements (Node 20+, a Postgres — local or Neon),
  `cp .env.example .env.local` + fill `DATABASE_URL`, then `npm run
  db:migrate && npm run db:seed`, `npm run dev`. Delete every SQLite
  mention, the "two data layers" claim, and the "Caveats vs Postgres"
  subsection entirely.
- **Auth section**: keep, but correct any SQLite reference (revocation via
  `db:studio`/SQL still applies).
- **Docker/Kamal sections**: keep the operational commands (they're
  current), delete better-sqlite3/QEMU/`.db`-volume/Litestream notes; the
  volume now holds `uploads/` only; migrations run via
  `scripts/migrate-prod.mjs` on boot (see `docker-entrypoint.sh`) and
  `kamal migrate` alias.

**Verify**: `grep -ci "sqlite\|better-sqlite3\|litestream" README.md` → 0.

### Step 3: Rewrite the stale sections of `MEMORY.md`

Per its own "Cómo usar este documento" rules (overwrite, don't accumulate
versions): rewrite **Qué es Agendao**, **Modelo de negocio**, **Stack
definitivo**, **Decisiones de arquitectura**, and **Estado actual** to match
the pivot doc (§1-3, §6) and the code facts listed above. Point the roadmap
part at the pivot doc instead of duplicating it. Correct the auth line to
"JWT con `sid` validado contra `auth_sessions` (revocación instantánea)".
Keep the document short — it's a memory, not a spec. Note: the old "Cubrir
con tests" lines conflict with the no-tests policy; replace with "QA manual
(decisión explícita: sin tests automatizados)".

**Verify**: `grep -ci "sqlite\|litestream\|droplet\|digitalocean" MEMORY.md` → 0.

### Step 4: Expand `AGENTS.md`

Keep the existing Next.js-16 warning as section 1 (verbatim). Add concise
sections (target ≤ 60 lines total — agents read this every session):

1. (existing Next 16 warning)
2. **Qué es esto**: multi-tenant SaaS de reservas; `salon_id` es frontera de
   seguridad; fuente de verdad del rumbo:
   `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`.
3. **Comandos**: dev/lint/build/db:* (+ typecheck si existe).
4. **Reglas duras**: sin tests automatizados (política deliberada — no
   añadir jamás); todo acceso a datos tenant-scoped pasa por
   `withTenant(salonId, fn)` de `lib/db/tenant.ts` (RLS fail-closed via GUC
   `app.current_salon_id`); `salonId` siempre derivado de la sesión, nunca
   del cliente; acciones admin-only empiezan con `requireAdmin()` (si el
   plan 002 ya aterrizó); conversiones fecha+hora local → UTC solo via
   `madridLocalDateTimeToUtc`; SQL = validez dura, TS = composición.
5. **Convenciones**: español en comentarios/UI, `es-ES` / `Europe/Madrid`
   fijos, result-shape `{ ok, message?, fieldErrors? }` en actions,
   conventional commits en español.
6. **Deploy**: Kamal construye desde clon de git — commitea antes de
   desplegar.

**Verify**: `grep -c "withTenant" AGENTS.md` → ≥1; file ≤ ~60 lines.

### Step 5: Lint

**Verify**: `npm run lint` → exit 0. `git status` shows only in-scope
files (plus the `git mv` renames).

## Test plan

Docs-only change; the verification greps above are the gates. Reviewer
should read the new README top-to-bottom pretending to be a new dev with an
empty machine and flag any step that wouldn't work.

## Done criteria

- [ ] Zero SQLite/Litestream/droplet references in `README.md` and
      `MEMORY.md` (greps above)
- [ ] `PLAN*.md` moved to `docs/archive/` with an explanatory README
- [ ] `AGENTS.md` documents commands, tenant discipline, no-tests policy
- [ ] `npm run lint` exits 0; no code files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A claim you need to write contradicts what you find in the code (e.g. a
  command that doesn't exist) — verify each stated fact against the repo
  before writing it; report contradictions instead of copying them.
- The pivot design doc is missing or has moved.

## Maintenance notes

- MEMORY.md's own contract applies from now on: each development phase ends
  by checking whether the memory drifted, and overwriting in place.
- When signup/billing/superadmin land (plans 012/013 territory), README's
  onboarding section and AGENTS.md's "qué es esto" need one-line updates.
- The old README content survives in git history; nothing is lost by the
  rewrite.
