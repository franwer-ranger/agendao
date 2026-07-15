# Plan 005: `normalize()` no debe mutar los intervalos del caller

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/availability/intervals.ts lib/availability/engine.ts`
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

`normalize()` in the availability engine claims to be a pure operation, but
it seeds its output with a **reference** to the caller's first interval and,
when merging adjacent intervals, writes `prev.end = curr.end` into that
shared object. The engine reuses the same interval objects across data
structures: `bookingsByEmployee` (whose intervals get normalized inside
`subtract`) and `bookingsByService` (used by the concurrent-capacity check)
hold references to the **same** `raw.bookingItems[].interval` objects. Net
effect: with back-to-back bookings, the earliest booking's interval is
silently extended in memory; the capacity counter then over-counts overlaps
and, for services with `max_concurrent` set, **available slots are dropped
from public availability**. The corruption persists for the rest of the
request. The fix is one line: never emit a caller-owned object.

## Current state

- `lib/availability/intervals.ts:6-23` — the offending function. The file
  header (line 3) states the contract: *"Operaciones puras sobre listas de
  Interval"*. The bug:

```ts
export function normalize(list: Interval[]): Interval[] {
  const valid = list.filter((i) => i.end.getTime() > i.start.getTime())
  if (valid.length === 0) return []
  const sorted = [...valid].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )
  const out: Interval[] = [sorted[0]]        // ← referencia al objeto del caller
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1]
    const curr = sorted[i]
    if (curr.start.getTime() <= prev.end.getTime()) {
      if (curr.end.getTime() > prev.end.getTime()) prev.end = curr.end   // ← muta
    } else {
      out.push({ start: curr.start, end: curr.end })
    }
  }
  return out
}
```

Note line 19 already pushes fresh objects — only the seed on line 12 leaks a
caller reference. `Interval` is `{ start: Date; end: Date }`
(`lib/availability/types.ts`).

- How the shared references arise, in `lib/availability/engine.ts`:
  - line 50: `bookingsByEmployee = groupBy(raw.bookingItems, ...)`
  - line 54: `bookingsByService = groupBy(raw.bookingItems, ...)` — same objects
  - lines 69-71: `empBookings = (...).map((r) => r.interval)` — new array,
    same `Interval` objects
  - line 107: `subtract(avail, empBookings)` → `subtract` calls
    `normalize(holes)` (`intervals.ts:28`) → mutation
  - lines 124-131: capacity check reads `sameService.map((b) => b.interval)`
    — sees the mutated `end`.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |

Note: do NOT use `npx tsc --noEmit` as a gate — it currently false-fails on a
stale generated file under `.next/dev/types`. `npm run build` is the type gate.

## Scope

**In scope** (the only file you should modify):
- `lib/availability/intervals.ts` (only the `normalize` function)

**Out of scope** (do NOT touch):
- `lib/availability/engine.ts` — its sharing of interval objects is fine
  once `normalize` stops mutating; do not add defensive copies there.
- `subtract`, `intersect`, `chunkBySlot` in the same file — they already
  emit fresh objects.
- Slot-grid anchoring in `chunkBySlot` — a separate, unrelated observation
  (see plans/README.md "deferred" section); do not fix it here.

## Git workflow

- Branch: `advisor/005-normalize-interval-mutation`
- Commit message style: `fix(availability): normalize() deja de mutar los intervalos de entrada`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Seed `out` with a copy

In `normalize`, change line 12 from:

```ts
  const out: Interval[] = [sorted[0]]
```

to:

```ts
  const out: Interval[] = [{ start: sorted[0].start, end: sorted[0].end }]
```

The later `prev.end = curr.end` then mutates only objects owned by `out`
(the seed copy or the fresh objects pushed at line 19), never caller data.
`Date` objects are never mutated anywhere in the function (only reassigned),
so sharing the `Date` instances is safe.

**Verify**: `grep -n "out: Interval\[\] = \[{" lib/availability/intervals.ts` → 1 match.

### Step 2: Lint and build

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

## Test plan

No automated tests in this repo (explicit maintainer decision — do not add
any). Manual QA for the reviewer, using the dev-only availability route
(`app/api/_dev/availability/route.ts`, available in `npm run dev`): pick a
service, set its `max_concurrent = 1` (admin UI), create two back-to-back
bookings for the same employee (e.g. 09:00-09:30 and 09:30-10:00), then
query availability for a **second** employee offering the same service on
that day. Before the fix, slots overlapping 09:30-10:00 for the second
employee are wrongly dropped (the first booking's interval was extended in
memory to 09:00-10:00, so the capacity counter sees 2 overlaps where there
is 1). After the fix they appear.

## Done criteria

- [ ] `normalize` seeds `out` with a new object literal, not `sorted[0]`
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `normalize` body no longer matches the excerpt (drift).
- You find call sites that **depend** on the mutation (e.g. code reading
  a raw interval after `normalize` and expecting the merged `end`) — grep
  callers of `normalize` in `lib/availability/` and skim; none should, but
  if one does, report it instead of preserving the mutation.

## Maintenance notes

- The file-header contract ("operaciones puras") is now true. Reviewers of
  future changes to `intervals.ts` should hold every function to it: emit
  fresh objects, never write into parameters.
- If interval math ever becomes a hot spot, an in-place variant may be
  reintroduced deliberately — but then callers must stop sharing interval
  objects between `bookingsByEmployee` and `bookingsByService`
  (`engine.ts:50,54`).
