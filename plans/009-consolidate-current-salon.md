# Plan 009: Consolidar `getCurrentSalon` en `lib/salons/` con `cache()`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/salon.ts lib/salons/queries.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Sequencing note**: plan 002 adds `requireAdmin` to files that import
> `getCurrentSalon`. Land 002 first (or rebase on it); the import-path
> updates here then include those files as they exist at that point.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-server-side-admin-role-guard.md (soft — ordering only)
- **Category**: tech-debt / perf
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

`getCurrentSalon()` — the session→salon resolver used by essentially every
admin page and action — lives alone in `lib/salon.ts` (singular), outside the
`lib/salons/` module where salon data access lives, and is **not** memoized.
Every admin navigation renders the layout plus the page, each calling it, so
the identical `auth()` decode + salon SELECT runs at least twice per request.
Its sibling `getSalonBySlug` in `lib/salons/queries.ts` is already wrapped in
React `cache()` for exactly this reason. Moving the function into
`lib/salons/queries.ts` with `cache()` removes duplicated round-trips and
leaves one convention for "salon data access".

## Current state

- `lib/salon.ts` — the whole file is the `CurrentSalon` type + the resolver:

```ts
// lib/salon.ts:15-37
export async function getCurrentSalon(): Promise<CurrentSalon> {
  const session = await auth()
  if (!session?.user?.salonId) {
    throw new Error('No hay sesión activa')
  }
  const row = (await db
    .select({ id: salons.id, slug: salons.slug, name: salons.name, ... })
    .from(salons)
    .where(eq(salons.id, session.user.salonId))
    .limit(1))[0]
  if (!row) { throw new Error('Salón no encontrado para la sesión actual') }
  return row
}
```

- RLS note (why this query works without `withTenant`): the `salons` SELECT
  policy is `using (true)` (`drizzle/0003_rls.sql:47-48`) — public reads by
  design. Keep the query as a plain `db.select`; do NOT wrap it in
  `withTenant`.
- The exemplar pattern to copy, `lib/salons/queries.ts:66` — `getSalonBySlug`
  wrapped in `cache()` (React's request-scoped memoization, imported from
  `'react'`).
- Import surface: `grep -rln "from '@/lib/salon'" app lib` → ~19 files
  (admin pages, layout, calendar actions, `lib/{services,employees,salons,
  bookings}/actions...`).

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |

Note: use `npm run typecheck` instead of `npm run build` as the fast gate if
plan 007 has landed.

## Scope

**In scope**:
- `lib/salons/queries.ts` (add the function + type)
- `lib/salon.ts` (delete at the end)
- Every file matching `grep -rl "from '@/lib/salon'" app lib` (import path
  update only — no behavior changes in those files)

**Out of scope** (do NOT touch):
- `lib/salons/storage.ts` — thin wrapper, separate cleanup, deliberately
  deferred.
- The function's behavior/signature — same type, same errors, plus
  `cache()`. No role checks here (that's plan 002's `requireAdmin`).

## Git workflow

- Branch: `advisor/009-consolidate-current-salon`
- Commit message style: `refactor(salons): getCurrentSalon a lib/salons con cache() por request`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `getCurrentSalon` to `lib/salons/queries.ts`

Copy the `CurrentSalon` type and the function body from `lib/salon.ts` into
`lib/salons/queries.ts`, wrapping with `cache()` exactly like
`getSalonBySlug` in the same file:

```ts
export const getCurrentSalon = cache(async (): Promise<CurrentSalon> => {
  ... // cuerpo idéntico al actual
})
```

Export both `CurrentSalon` and `getCurrentSalon`. Keep `lib/salon.ts` in
place for this step (temporarily duplicated) so the build never breaks.

**Verify**: `npm run build` → exit 0.

### Step 2: Update all importers

Mechanical replace across the repo:
`from '@/lib/salon'` → `from '@/lib/salons/queries'` (both the function and
the `CurrentSalon` type come from the new location).

**Verify**: `grep -rn "from '@/lib/salon'" app lib components` → no matches.

### Step 3: Delete `lib/salon.ts`

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

## Test plan

No automated tests (repo policy). Manual QA: log in, walk
`/admin/today → /admin/calendar → /admin/services → /admin/salon` — all
render; edit + save a salon setting — persists. `cache()` is request-scoped,
so there is no cross-request staleness to test; within-request staleness
after a same-request mutation is not a pattern this codebase uses
(mutations revalidate paths).

## Done criteria

- [ ] `lib/salon.ts` no longer exists
- [ ] `getCurrentSalon` in `lib/salons/queries.ts` is `cache()`-wrapped
- [ ] `grep -rn "@/lib/salon'" app lib components` → no matches
- [ ] `npm run lint` and `npm run build` exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `lib/salons/queries.ts` has an `import 'server-only'` conflict or its
  existing imports make `auth` unavailable (circular import between
  `lib/auth` and `lib/salons` — if adding `import { auth } from '@/lib/auth'`
  creates a cycle warning or build failure, report rather than restructure).
- Any importer uses `getCurrentSalon` in a **client** component (there
  should be none — it's server-only).

## Maintenance notes

- One convention now: salon reads live in `lib/salons/queries.ts`,
  request-memoized with `cache()`. Reviewers should push new salon lookups
  there.
- If a mutation ever needs the *fresh* salon row in the same request after
  writing, it must query directly instead of via the cached resolver.
- Deferred: inlining the 12-line `lib/salons/storage.ts` pass-through
  wrapper (single-implementation indirection) — low value, do it
  opportunistically.
