# Plan 012 (spike): Diseño de `salons.status` + signup público self-serve

> **Executor instructions**: This is a **design spike, not a build plan**.
> The deliverable is a written design document plus a list of decisions for
> the maintainer — **no application code changes**. Follow the steps, honor
> the STOP conditions, and when done update the status row in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.

> **Actualización 2026-07-20:** AGE-001 sustituyó y ejecutó el alcance de ciclo
> de vida: modelo `salon_lifecycle`, trial, backfill, RLS y transiciones. No
> ejecutar Step 2 ni diseñar un `salons.status` alternativo. El alcance pendiente
> de este spike es signup, abuso y re-cableado de `/setup`.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/setup lib/db/schema.ts app/setup docs/superpowers`
> If these changed materially since this plan was written, re-read them
> before designing on top.

## Status

- **Priority**: P3 (first brick of the v1 roadmap — high product priority,
  after the P1 fixes)
- **Effort**: M (spike; the build that follows is L)
- **Risk**: LOW (no code changes)
- **Depends on**: none (but read plans 002 and 006 — their guard patterns
  constrain the design)
- **Category**: direction
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

The SaaS pivot design (`docs/superpowers/specs/2026-06-30-saas-pivot-design.md`)
defines the build order `A → (B ∥ C) → D`. Sub-project A (multi-tenant
foundation) is done. The next brick is **public signup** (B) and its shared
substrate, the **tenant lifecycle column** `salons.status`
(`trialing | active | past_due | canceled | suspended`, pivot §5.A.4) —
which signup writes (`trialing`), Stripe webhooks update (C), superadmin
overrides (`suspended`, D), and gating reads. None of it exists yet: there
is no `app/signup` route ("signup" appears only as a reserved slug in
`lib/salons/schema.ts:27`), and `salons` has no status column. Meanwhile the
`/setup` wizard is a de-facto **open, unthrottled signup** (unauthenticated
`performSetup` runs argon2 and creates a salon per request —
`lib/setup/actions.ts:18-27`), which is both a spam/DoS exposure and
evidence that the real signup flow is overdue. This spike turns pivot §5.B
into an implementable spec.

## Current state (read all of these before designing)

- `docs/superpowers/specs/2026-06-30-saas-pivot-design.md` — §5.A.4, §5.B,
  §5.C (webhooks will write status), §7, §9. The design must not contradict
  it; where you disagree, record it as an open question instead.
- `docs/superpowers/specs/2026-06-30-subproyecto-a-fundacion-multitenant-design.md`
  and `docs/superpowers/plans/2026-06-30-subproyecto-a-fundacion-multitenant.md`
  — how A was specced/executed; match their vocabulary.
- `lib/db/schema.ts` — `salons` table (has `onboarding_completed_at`, no
  status); `app_users` (role CHECK `admin|staff`).
- `lib/setup/perform-setup.ts` — creates admin + salon + services/employees/
  hours in one flow today; the signup design will split "create admin+salon"
  (signup) from "configure" (wizard), per pivot §5.B: the wizard "pierde el
  paso de crear admin".
- `app/setup/**` — the wizard UI (steps: welcome/admin/salon/services/
  employees/matrix/review) and its localStorage draft (`app/setup/_lib/`).
- `lib/setup/is-configured.ts` — per-tenant gating on
  `onboarding_completed_at`.
- `proxy.ts` + `lib/auth/config.ts` — edge middleware; gating by
  subscription status will eventually hook in here or in layouts (pivot
  §5.C); the config must stay edge-safe (no DB imports).
- RLS: `drizzle/0003_rls.sql:50-51` — `salons_insert ... with check (true)`
  exists precisely so pre-tenant onboarding can create the salon.

## Scope

**In scope** (deliverables — files to create):
- `docs/superpowers/specs/2026-07-signup-and-salon-status-design.md` — the
  design doc (naming follows the existing specs' convention).
- An "open questions / decisions for the maintainer" section inside it.

**Out of scope**:
- ANY change to application code, schema, or migrations.
- Stripe/billing design beyond defining the `status` values and who writes
  them (billing is its own sub-project, C).
- Superadmin design (D) beyond noting that `suspended` is written by it.

## Git workflow

- Branch: `advisor/012-spike-signup-design`
- Commit message style: `docs(spec): diseño de salons.status y signup self-serve`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Investigate

Read every file in "Current state". Additionally inventory what
`performSetup` does transactionally (`lib/setup/perform-setup.ts` top to
bottom) and what the wizard draft stores, so the split point
(signup vs wizard) is grounded in the real code, not the doc's summary.

**Verify**: you can answer — without re-opening files — (a) which wizard
step creates the admin today, (b) what makes a slug valid/reserved,
(c) where `onboarding_completed_at` is written.

### Step 2: Design `salons.status`

Specify: column definition (enum-check constraint like the repo's existing
`CHECK ... in (...)` pattern — see `app_users.role`), default at insert
(`trialing`), who may write each transition (signup / webhooks / superadmin
/ nobody), a transition table, `trial_ends_at` placement (on `salons` vs the
future `subscriptions` table — pivot §5.C suggests `subscriptions`; take a
position and justify), and the read path for gating (a
`getSalonAccessState(salonId)` helper: where it lives, what it returns,
where it's called — admin layout, public booking page, proxy?). Include the
migration sketch (SQL) and backfill for existing salons (`active`? decide
and justify).

### Step 3: Design `/signup`

Specify, at the level of detail of the existing sub-project-A spec:
route(s) and UI states; the input schema (email, password, salon name, slug
autoproposal — reusing `lib/salons/schema.ts` slug rules); the transactional
create (reusing which parts of `performSetup`); auto-login (the
`signIn('credentials')` pattern from `lib/setup/actions.ts:32-37`); redirect
into the wizard; the wizard re-wire (which steps are removed/kept, what
happens to drafts); what happens to `/setup` for already-onboarded salons
and for brand-new-DB first boot (superadmin bootstrapping vs
`scripts/create-admin.ts`).

**Abuse resistance is part of the design** (this fixes finding SECURITY-04):
rate limiting approach for a single-VPS deploy (no Redis — repo constraint;
consider a Postgres-table-based limiter or per-IP in-memory with the single
instance), email verification (before or after provisioning — take a
position), disposable-email policy, and the slug-squatting question.
Frame as defensive requirements, not attack recipes.

### Step 4: Open questions for the maintainer

Collect every decision the docs don't settle. At minimum: trial length;
whether `/setup` remains reachable at all post-signup-launch; verification
email provider flows (Resend template needed?); whether signup is gated by
an invite code pre-launch; what "temporarily unavailable" looks like for
`canceled` salons' public booking pages (pivot §5.C says both dashboard and
`/[slug]/book` shut off).

### Step 5: Write the design doc

Structure it like `2026-06-30-saas-pivot-design.md` (numbered sections,
decision tables, risks). End with a "siguiente paso" section: the build
plan(s) an executor would need, with coarse effort estimates.

**Verify**: the doc exists, is in Spanish (matching the other specs), cites
`file:line` for every claim about current code, and contains the open-
questions section.

## Done criteria

- [ ] `docs/superpowers/specs/2026-07-signup-and-salon-status-design.md`
      exists, in Spanish, with: status column spec + transition table,
      signup flow spec, wizard re-wire spec, abuse-resistance section,
      open questions
- [ ] No application code, schema, or migration files modified
      (`git status` shows only the new doc)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The pivot doc's §5.B assumptions no longer match the code (e.g. the
  wizard was already re-wired) — the spike would be speccing the past.
- You find an existing signup/status design doc under `docs/superpowers/`
  newer than 2026-06-30 — reconcile instead of duplicating.

## Maintenance notes

- The maintainer reviews the doc, answers the open questions, and only then
  should build plans be written (spec → plan → implementation is this
  repo's established cycle — see `docs/superpowers/`).
- Plan 013 (magic links) and sub-project C (billing) both touch adjacent
  surfaces; the status-column design here is the contract they build on.
