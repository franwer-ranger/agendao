# Plan 004: Cálculo local→UTC DST-correcto en acciones admin de calendario

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- app/admin/calendar/_actions/create-booking-manual.ts app/admin/calendar/_actions/create-block.ts lib/time.ts lib/availability/time.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

Two admin server actions convert "local date + local HH:MM" to a UTC instant
by taking the UTC instant of **local midnight** and adding wall-clock
minutes. That arithmetic is DST-naive: on Madrid's spring-forward day the
offset at midnight (+01:00) differs from the offset at 09:00 (+02:00), so
"09:00" is stored as 10:00 local (and the inverse error on fall-back day).
The availability engine already has a DST-correct helper —
`madridLocalDateTimeToUtc` in `lib/availability/time.ts` — which resolves the
offset **at the target time**. Admin-created bookings and blocks must use the
same conversion the engine uses, or twice a year they silently land one hour
away from what the admin typed. The calendar's vertical-positioning helper
`minutesFromSalonMidnight` has the same flaw for display.

## Current state

- `lib/availability/time.ts:11-39` — `madridLocalDateTimeToUtc(date, hhmm)`,
  the DST-correct conversion (resolves the real offset via
  `Intl.DateTimeFormat` at the target instant). This is the helper to reuse.
- `app/admin/calendar/_actions/create-booking-manual.ts:80-83` — the
  DST-naive pattern:

```ts
  // Calcular instante UTC a partir de fecha local + hora local del salón.
  const dayStartUtc = salonDateToUtc(input.date, salon.timezone)
  const [h, m] = input.starts_at.split(':').map(Number)
  const startsAt = new Date(dayStartUtc.getTime() + (h * 60 + m) * 60_000)
```

- `app/admin/calendar/_actions/create-block.ts:61-67` — same pattern via
  `hhmmToMinutes`:

```ts
  const dayStartUtc = salonDateToUtc(parsed.data.date, salon.timezone)
  const startsAt = new Date(
    dayStartUtc.getTime() + hhmmToMinutes(parsed.data.starts_at) * 60_000,
  )
  const endsAt = new Date(
    dayStartUtc.getTime() + hhmmToMinutes(parsed.data.ends_at) * 60_000,
  )
```

- `lib/time.ts:102-109` — `minutesFromSalonMidnight(iso, localDate, tz)`
  computes `(instant - salonDateToUtc(localDate)) / 60_000`; on DST days the
  elapsed-time result differs from the wall-clock minutes the calendar grid
  expects.
- Context: the timezone is fixed to `Europe/Madrid` in v1 (constant
  `SALON_TZ` in both `lib/time.ts:7` and `lib/availability/time.ts:5`);
  `madridLocalDateTimeToUtc` deliberately takes no `tz` param. The public
  booking flow computes slots in the engine (already DST-correct) and passes
  ISO UTC instants around, so only these admin inputs are affected.

Repo conventions: Spanish comments, no semicolons, single quotes, `@/`
import alias.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |

Note: do NOT use `npx tsc --noEmit` as a gate — it currently false-fails on a
stale generated file under `.next/dev/types`. `npm run build` is the type gate.

## Scope

**In scope** (the only files you should modify):
- `app/admin/calendar/_actions/create-booking-manual.ts`
- `app/admin/calendar/_actions/create-block.ts`
- `lib/time.ts` (only `minutesFromSalonMidnight`)

**Out of scope** (do NOT touch):
- `lib/availability/time.ts` — the correct helper; consume it, don't edit it.
- `app/admin/calendar/_actions/move-booking.ts` — it receives an ISO UTC
  instant from the drag/drop UI, no local→UTC conversion happens there.
- `salonDateToUtc` in `lib/time.ts` — other callers use it correctly for
  "start of local day"; only the +minutes pattern on top of it is wrong.
- The availability engine and validators.

## Git workflow

- Branch: `advisor/004-dst-safe-admin-time-math`
- Commit message style: `fix(calendar): conversión local→UTC DST-correcta en reservas manuales y bloqueos`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix `create-booking-manual.ts`

Replace the excerpt shown above (lines 80-83) with:

```ts
  // Instante UTC a partir de fecha local + hora local del salón,
  // resolviendo el offset real en ese momento (DST-correcto, mismo helper
  // que usa el motor de disponibilidad).
  const startsAt = madridLocalDateTimeToUtc(input.date, input.starts_at)
```

Add `import { madridLocalDateTimeToUtc } from '@/lib/availability/time'` and
remove the now-unused `salonDateToUtc` import (only if unused in the file —
check first).

**Verify**: `grep -n "salonDateToUtc\|madridLocalDateTimeToUtc" app/admin/calendar/_actions/create-booking-manual.ts`
→ only `madridLocalDateTimeToUtc` appears.

### Step 2: Fix `create-block.ts`

Same replacement for both bounds:

```ts
  const startsAt = madridLocalDateTimeToUtc(parsed.data.date, parsed.data.starts_at)
  const endsAt = madridLocalDateTimeToUtc(parsed.data.date, parsed.data.ends_at)
```

Remove the `salonDateToUtc` / `hhmmToMinutes` imports if they become unused
in this file (check with grep first — `hhmmToMinutes` may have other uses).

**Verify**: `grep -n "dayStartUtc" app/admin/calendar/_actions/create-block.ts` → no matches.

### Step 3: Fix `minutesFromSalonMidnight` in `lib/time.ts`

Reimplement it to return **wall-clock** minutes in the salon TZ instead of
elapsed ms since local midnight. Target shape (there is an exemplar of the
`Intl` pattern in the same file, `formatSalonTime` at lines 81-88):

```ts
// Minutos de reloj (hora local del salón) desde la medianoche local del día
// del instante. DST-correcto: usa la hora de pared, no el tiempo transcurrido.
export function minutesFromSalonMidnight(
  iso: string,
  localDate: string,
  tz: string = SALON_TZ,
): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}
```

Note the `localDate` parameter becomes unused by the new implementation but
**keep the signature** — callers pass it, and events are always positioned
within their own local day. (`Intl` with `hour12: false` can render midnight
as `"24"` in some ICU versions; `en-GB` with `2-digit` yields `"00"` — if you
observe 1440 for a midnight instant during QA, normalize with `% 1440`.)

**Verify**: `grep -n "callers" -r` is not needed; instead
`grep -rn "minutesFromSalonMidnight" app/ lib/ --include=*.ts*` and confirm
every caller passes `(iso, localDate)` — signature unchanged.

### Step 4: Lint and build

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

## Test plan

No automated tests in this repo (explicit maintainer decision — do not add
any). Manual QA for the reviewer, in `npm run dev`: create a manual booking
for a normal day at 09:00 → detail dialog and grid show 09:00 (regression
check). For the DST case, create a manual booking dated on the next
spring-forward Sunday (last Sunday of March) at 09:00 and inspect
`booking_items.starts_at` via `npm run db:studio`: it must be `07:00Z`
(+02:00 offset), not `08:00Z`.

## Done criteria

- [ ] Neither action file contains the `dayStartUtc + minutes` pattern
      (`grep -rn "dayStartUtc" app/admin/calendar/_actions/` → no matches)
- [ ] `minutesFromSalonMidnight` no longer subtracts `salonDateToUtc`
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `madridLocalDateTimeToUtc` is not exported from `lib/availability/time.ts`
  or its signature differs from `(date: string, hhmm: string): Date`.
- Any caller of `minutesFromSalonMidnight` relies on values > 1440 or
  negative values (an event outside its `localDate`) — the new wall-clock
  implementation would change its meaning. Report the caller.
- Validation (`validateAndCreateBooking` / `validateBookingItemInterval`)
  starts rejecting the corrected instants during QA — that would indicate a
  deeper disagreement between validator and engine; do not patch around it.

## Maintenance notes

- Rule for reviewers going forward: **never** add wall-clock minutes to a
  UTC instant. Any "local date + HH:MM → instant" conversion must go through
  `madridLocalDateTimeToUtc`.
- When multi-timezone support arrives (the `tz` params exist for that), the
  Madrid-hardcoded helper needs a `tz` argument — grep for its call sites
  then; they'll all need the salon's TZ.
- Bookings/blocks created on past DST days with the old math are stored 1h
  off; this plan does not attempt data repair (rare, and intent is
  unrecoverable). Deferred deliberately.
