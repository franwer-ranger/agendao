# Plan 002: Exigir rol admin server-side en las acciones de administración

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/auth lib/services/actions.ts lib/employees/actions.ts lib/salons/actions.ts lib/salon.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

The app has two roles: `admin` (full access) and `staff` (only
`/admin/today` and `/admin/calendar`). Today that restriction is enforced
**only** by a path-based middleware redirect and by hiding nav links. Server
actions are not dispatched by path — a logged-in `staff` user sitting on an
allowed page can invoke any server action in the build, including creating or
deleting services, employees, working hours, closures, and salon settings.
That is intra-tenant privilege escalation. Authorization must be re-checked
server-side inside each admin-only action. (Tenant isolation itself is fine —
every action derives `salonId` from the session.)

## Current state

- `lib/auth/config.ts` — the only role enforcement, a middleware redirect:

```ts
// lib/auth/config.ts:3-7
const STAFF_ALLOWED_PREFIXES = ['/admin/today', '/admin/calendar']

function isStaffAllowed(pathname: string): boolean {
  return STAFF_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))
}
```

- `lib/salon.ts:15-19` — `getCurrentSalon()` checks only that a session
  exists, never the role:

```ts
export async function getCurrentSalon(): Promise<CurrentSalon> {
  const session = await auth()
  if (!session?.user?.salonId) {
    throw new Error('No hay sesión activa')
  }
```

- `lib/auth/index.ts` — exports `auth` (full Node config). The session shape
  is typed in `lib/auth/types.ts`: `session.user.role` is `'admin' | 'staff'`.
- **Admin-only action modules** (each exports `'use server'` async functions
  that call `getCurrentSalon()` and then mutate): `lib/services/actions.ts`,
  `lib/employees/actions.ts`, `lib/salons/actions.ts`.
- **Staff-legitimate action modules** (used by the calendar/today pages that
  staff may access — must NOT be gated): `lib/bookings/status-actions.ts`,
  `lib/bookings/note-actions.ts`, `app/admin/calendar/_actions/move-booking.ts`,
  `app/admin/calendar/_actions/create-booking-manual.ts`,
  `app/admin/calendar/_actions/create-block.ts`, `app/admin/actions.ts`.

Repo conventions: comments in Spanish, no semicolons, single quotes, actions
return `{ ok: boolean, message?, fieldErrors? }` result objects, `@/` import
alias. `import 'server-only'` heads non-action server modules (see
`lib/db/tenant.ts:1`).

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |

Note: do NOT use `npx tsc --noEmit` as a gate — it currently false-fails on a
stale generated file under `.next/dev/types`. `npm run build` is the type gate.

## Scope

**In scope** (the only files you should modify/create):
- `lib/auth/guards.ts` (create)
- `lib/services/actions.ts`
- `lib/employees/actions.ts`
- `lib/salons/actions.ts`

**Out of scope** (do NOT touch, even though they look related):
- The staff-legitimate action modules listed above — staff must keep using
  them; gating them breaks the calendar/today workflow.
- `lib/auth/config.ts` and `proxy.ts` — the middleware redirect stays as the
  UX layer; this plan adds the authorization layer beneath it.
- `lib/salon.ts` / `getCurrentSalon` — plan 009 relocates it; do not change
  its behavior here.
- `app/setup/**`, `lib/setup/**` — pre-auth onboarding, different flow.

## Git workflow

- Branch: `advisor/002-server-side-admin-role-guard`
- Commit message style: `fix(auth): guard de rol admin server-side en acciones de administración`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `lib/auth/guards.ts`

New file exporting a single helper that re-validates the role server-side:

```ts
import 'server-only'

import { auth } from '@/lib/auth'

// Autorización server-side: el middleware solo redirige por path, y las
// server actions no se despachan por path — cada acción admin-only debe
// re-validar el rol aquí. Lanza en vez de devolver un result-shape porque
// la UI legítima nunca ofrece estas acciones a staff.
export async function requireAdmin(): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    throw new Error('No autorizado')
  }
}
```

**Verify**: `npm run lint` → exit 0.

### Step 2: Gate every exported action in the three admin-only modules

In each of `lib/services/actions.ts`, `lib/employees/actions.ts`,
`lib/salons/actions.ts`:

1. Add `import { requireAdmin } from '@/lib/auth/guards'` to the imports.
2. Add `await requireAdmin()` as the **first statement** of every
   `export async function ...Action` in the file (before parsing input and
   before `getCurrentSalon()`).

Enumerate the functions first:
`grep -n "^export async function" lib/services/actions.ts lib/employees/actions.ts lib/salons/actions.ts`
— every listed function gets the guard. Helper functions that are not
exported actions (e.g. `syncEmployeeAssignments` in `lib/services/actions.ts`)
do NOT get the guard (their callers already have it).

**Verify**: for each file, the count of `requireAdmin()` call sites equals the
count of `^export async function` matches:
`grep -c "await requireAdmin()" lib/services/actions.ts` equals
`grep -c "^export async function" lib/services/actions.ts` (repeat for the
other two files).

### Step 3: Lint and build

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

## Test plan

No automated tests in this repo (explicit maintainer decision — do not add
any). Manual QA for the reviewer: log in as a `staff` user (create one via
the employees admin or DB), confirm `/admin/today` and `/admin/calendar`
still work end-to-end (change a booking status, move a booking, create a
manual booking) — none of those hit the gated modules. Then confirm an admin
session can still create/edit a service and an employee.

## Done criteria

- [ ] `lib/auth/guards.ts` exists and exports `requireAdmin`
- [ ] In each of the three gated files: `grep -c "await requireAdmin()"` ==
      `grep -c "^export async function"`
- [ ] `grep -n "requireAdmin" lib/bookings/ app/admin/calendar/_actions/ -r`
      returns no matches (staff paths untouched)
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any exported function in the three gated modules is also imported by
  components under `app/admin/today/` or `app/admin/calendar/` (check with
  grep before Step 2) — that would mean the admin-only/staff split assumed
  here is wrong for that function. Report which one.
- `session.user.role` does not exist on the session type — the auth types
  have drifted from `lib/auth/types.ts`.
- A gated action's UI flow breaks in `npm run dev` for an **admin** user.

## Maintenance notes

- Every future admin-only server action must start with
  `await requireAdmin()`. Reviewers should reject new action files under
  `lib/**/actions.ts` that mutate settings/catalog data without it.
- If a third role (e.g. `superadmin`, planned in the SaaS pivot doc) is
  added, generalize the helper to `requireRole(...roles)` — single call site
  to change.
- Deferred: the staff-legitimate calendar actions currently allow staff to
  manage *any* employee's bookings (not just their own agenda). That's
  today's intended behavior per the UI; revisit when per-employee staff
  scoping becomes a requirement.
