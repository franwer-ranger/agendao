# Plan 003: Que cada reprogramación de reserva envíe su email (versionar la idempotencia)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/email/triggers/on-booking-rescheduled.ts lib/email/notifications-log.ts lib/email/send.ts`
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

Email idempotency is enforced by a unique key `(booking_id, kind, version)`
on `booking_notifications`. Reschedule emails are *supposed* to use `version`
so each reschedule is a new event — the schema comment says so explicitly.
But the reschedule trigger never passes a `version`, so it defaults to `0`:
the **first** move of a booking emails the client, and every later move is
silently skipped as `already_sent`. The client is left holding a stale
appointment time. The fix threads a per-booking incrementing version through
the existing parameter that already exists all the way down the stack.

## Current state

- `lib/email/triggers/on-booking-rescheduled.ts` — fired via `after()` from
  `app/admin/calendar/_actions/move-booking.ts:132-140` when the admin moves
  a booking with "notify client" checked. The `sendBookingEmail` call passes
  no `version` (lines 26-33):

```ts
    const result = await sendBookingEmail({
      to: ctx.client.email,
      subject: `Reserva reprogramada en ${ctx.salon.name}`,
      react: BookingRescheduleEmail({ ctx, previousStartsAt }),
      kind: 'booking_reschedule',
      bookingId,
      salonId: ctx.salon.id,
    })
```

- `lib/email/notifications-log.ts:42` — `version: params.version ?? 0`, and
  its doc comment (lines 22-25): *"`version` se usa solo para
  `booking_reschedule` (cada reprogramación es un evento nuevo). El resto de
  tipos lo deja en 0"*. On a duplicate key (Postgres error 23505) it returns
  `{ reserved: false }`.
- `lib/email/send.ts:50-51` — `if (!reservation.reserved) return { ok: true,
  skipped: true, reason: 'already_sent' }`.
- `lib/email/send.ts:19` — `SendBookingEmailParams` already has `version?:
  number` and forwards it (line 47). **No signature changes are needed**
  except adding the computation in the trigger.
- DB access convention: tenant-scoped reads go through
  `withTenant(salonId, async (tx) => ...)` from `@/lib/db/tenant` (RLS GUC).
  See `lib/email/notifications-log.ts:49` for the exemplar.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |

Note: do NOT use `npx tsc --noEmit` as a gate — it currently false-fails on a
stale generated file under `.next/dev/types`. `npm run build` is the type gate.

## Scope

**In scope** (the only file you should modify):
- `lib/email/triggers/on-booking-rescheduled.ts`

**Out of scope** (do NOT touch):
- `lib/email/notifications-log.ts`, `lib/email/send.ts` — the `version`
  plumbing already exists; do not restructure it.
- `lib/db/schema.ts` — the unique key is correct as designed.
- `lib/email/triggers/on-booking-created.ts` and `send-reminders.ts` —
  version 0 is correct for those kinds.

## Git workflow

- Branch: `advisor/003-reschedule-email-version`
- Commit message style: `fix(email): versiona la idempotencia de booking_reschedule para que cada reprogramación notifique`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Compute the next version in the trigger

In `lib/email/triggers/on-booking-rescheduled.ts`, before the
`sendBookingEmail` call, query how many `booking_reschedule` notifications
already exist for this booking and pass `version: count + 1`. Target shape
(imports: `count` and `and`/`eq` from `drizzle-orm`, `withTenant` from
`@/lib/db/tenant`, `booking_notifications` from `@/lib/db/schema`):

```ts
    // Cada reprogramación es un evento nuevo: versionamos el slot de
    // idempotencia contando los reschedules ya notificados de esta reserva.
    const existing = await withTenant(salonId, async (tx) => {
      const rows = await tx
        .select({ n: count() })
        .from(booking_notifications)
        .where(
          and(
            eq(booking_notifications.booking_id, bookingId),
            eq(booking_notifications.kind, 'booking_reschedule'),
          ),
        )
      return rows[0]?.n ?? 0
    })

    const result = await sendBookingEmail({
      ...,
      version: existing + 1,
    })
```

Keep the rest of the function (context load, error logging) unchanged. Note
the whole body is already inside a `try/catch` that never throws — preserve
that.

**Verify**: `grep -n "version:" lib/email/triggers/on-booking-rescheduled.ts`
→ one match inside the `sendBookingEmail` call.

### Step 2: Lint and build

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

## Test plan

No automated tests in this repo (explicit maintainer decision — do not add
any). Manual QA for the reviewer, in `npm run dev` against a seeded DB:
move the same booking twice from `/admin/calendar` with "notificar" enabled.
Expected: `booking_notifications` gains two rows with `kind =
'booking_reschedule'` and `version` 1 and 2 (check via `npm run db:studio`),
and two emails are dispatched (dev sandbox redirect applies, see
`lib/email/client.ts`). Concurrency note: two truly simultaneous moves may
compute the same version — one email is then skipped by the unique key,
which is the correct idempotent behavior.

## Done criteria

- [ ] `sendBookingEmail` in the trigger receives an explicit `version`
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `SendBookingEmailParams` no longer has an optional `version` field
  (`lib/email/send.ts:19`) — the plumbing this plan relies on has drifted.
- The `booking_notifications` unique key no longer includes `version`
  (check `lib/db/schema.ts`, index/unique on booking_id + kind + version).

## Maintenance notes

- Existing prod rows have `version = 0` for past reschedules; the new
  scheme starts at 1 and never collides with them. No data migration needed.
- If a future "client rescheduled via magic link" flow (see plan 013)
  reuses this trigger, the version computation already covers it — it counts
  rows regardless of who initiated the move.
- Reviewer should scrutinize: the count query must be tenant-scoped
  (`withTenant`) or RLS returns 0 rows and versions restart at 1 — which the
  unique key would then reject (email skipped, bug reappears).
