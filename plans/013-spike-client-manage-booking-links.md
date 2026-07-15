# Plan 013 (spike): Diseño del enlace mágico de gestión de reserva (cancelar/reprogramar)

> **Executor instructions**: This is a **design spike, not a build plan**.
> The deliverable is a written design document plus open questions — **no
> application code changes**. Follow the steps, honor the STOP conditions,
> and when done update the status row in `plans/README.md` — unless a
> reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/db/schema.ts lib/email app/[salonSlug]/book lib/bookings`
> If these changed materially since this plan was written, re-read before
> designing on top.

## Status

- **Priority**: P3
- **Effort**: M (spike; build likely M–L)
- **Risk**: LOW (no code changes)
- **Depends on**: read plan 012's output if it exists (status gating may
  turn off public booking management too); read plan 006 (single-use token
  consumption pattern — the guarded-UPDATE rule applies to these tokens).
- **Category**: direction
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

The end-client self-service flow is half-built and dead in the codebase:
the `booking_tokens` table exists with a `'manage'` purpose and RLS policy
but is read/written **nowhere**; a `booking-cancellation` email template
exists but is imported nowhere; the booking-confirmation page **promises**
"un enlace para gestionar tu reserva" that is never sent; and the salon
settings `cancellation_min_hours` / `cancellation_policy_text` are
configured in the admin UI but no client-facing flow consumes them. Until
this is wired, every change is a phone call and no-show slots stay blocked —
while anti-no-show is one of the product's stated selling points. This spike
produces the design that turns the existing substrate into a working flow.

## Current state (verified evidence — read these files)

- `lib/db/schema.ts:523-540` — `booking_tokens`: `booking_id`, `purpose`
  (`'manage'`), `token_hash`, `expires_at`, `used_at`, … Referenced by zero
  application files (`grep -rn "booking_tokens" app lib --include=*.ts*`
  → only schema + RLS).
- `drizzle/0003_rls.sql:186-197` — RLS policy for `booking_tokens` scoped
  via the parent booking's `salon_id`.
- `app/[salonSlug]/book/done/[publicId]/page.tsx:52` — confirmation copy
  promising the management link ("un enlace para gestionar tu reserva").
- `lib/email/templates/booking-cancellation.tsx` — exists;
  `BookingCancellationEmail` imported nowhere.
- `lib/email/triggers/` — has `on-booking-created.ts`,
  `on-booking-rescheduled.ts`, `send-reminders.ts`; **no**
  `on-booking-cancelled`.
- `lib/bookings/status-actions.ts` (comment, ~line 14): `cancelled_client`
  "no es accesible desde aquí — eso lo provoca el enlace mágico del
  cliente" — the status value and transition already anticipate this flow.
- `salons` settings: `cancellation_min_hours`, `cancellation_policy_text`
  (`lib/db/schema.ts`, edited in `app/admin/salon/_components/
  cancellation-form.tsx`).
- Reusable machinery: the availability engine + `validateAndCreateBooking`
  / `validateBookingItemInterval` (`lib/availability/booking.ts`) for the
  reschedule path; the move logic in
  `app/admin/calendar/_actions/move-booking.ts` (window recompute); the
  hashed-token pattern in `lib/auth/password-reset.ts` (sha256 at rest,
  TTL, single-use); the reset-password magic-link route shape
  (`app/reset-password/[token]/`).
- Precedent for the public side: the booking flow lives under
  `app/[salonSlug]/book/**` with server actions in `_actions/`.

## Scope

**In scope** (deliverable):
- `docs/superpowers/specs/2026-07-booking-manage-links-design.md`

**Out of scope**:
- ANY application code/schema change.
- SMS/WhatsApp reminders and deposits (pivot §5.E — fast-follow, not this).
- Admin-side cancellation UX changes (exists already via status actions).

## Git workflow

- Branch: `advisor/013-spike-manage-links-design`
- Commit message style: `docs(spec): diseño del enlace mágico de gestión de reservas`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Investigate the substrate

Read every file listed above. Establish: exact `booking_tokens` columns and
semantics; how `publicId` on bookings works today (the `done/[publicId]`
page) and whether it's guessable; the full lifecycle of a booking's statuses
(`lib/bookings/status.ts`); what `on-booking-created` does (where a token
would be issued and the link injected into the confirmation email).

**Verify**: you can state, with `file:line`, where the confirmation email
is assembled and where a manage URL would be embedded.

### Step 2: Design the flow

Specify:

- **Token issuance**: when (at booking creation, inside or after the
  transaction), entropy and at-rest hashing (follow
  `lib/auth/password-reset.ts`), expiry policy (e.g. until appointment end),
  one token per booking vs per action; single-use semantics — and where
  single-use does/doesn't apply (a manage link is typically multi-visit,
  read-carefully: viewing is repeatable, *state changes* are the guarded
  part; apply plan 006's guarded-UPDATE rule to the state change).
- **Routes**: e.g. `app/[salonSlug]/book/manage/[token]/page.tsx` — view
  booking, cancel, reschedule entry; error states (expired/used/unknown
  token, already-cancelled booking, past booking).
- **Cancel action**: sets `cancelled_client` via the existing transition
  rules, enforces `cancellation_min_hours` against booking start (in salon
  TZ), records a `booking_status_events` row (actor_type `client`),
  triggers the cancellation email (new `on-booking-cancelled.ts` using the
  existing template — to the client AND the salon? decide), frees
  availability automatically (bookings with cancelled status are excluded
  by the active-status filters — verify and cite).
- **Reschedule action**: which slots to offer (reuse the public
  availability engine scoped to the same service; same employee or any?),
  validation via `validateBookingItemInterval` with `excludeItemId`, window
  recompute copied from `move-booking.ts`, and the reschedule email
  (interacts with plan 003's versioning — cite it).
- **Tenant/RLS path**: public flow resolves salon by slug then uses
  `withTenant` — trace how the token lookup gets `salon_id` before the GUC
  is set (token → booking → salon requires a read; the RLS policy on
  `booking_tokens` is tenant-scoped, chicken-and-egg — resolve it in the
  design, e.g. lookup joined via the salon slug from the URL).
- **Copy/UX**: es-ES, `cancellation_policy_text` displayed, mobile-first
  like the booking flow.

### Step 3: Open questions for the maintainer

At minimum: reschedule allowed how many times; can a client cancel inside
the `cancellation_min_hours` window (hard block vs "call the salon" CTA);
does the salon get notified on client cancellation (probably yes — which
template); should old bookings' confirmation emails retroactively get links
(no backfill is simpler — state the tradeoff).

### Step 4: Write the design doc

Same structure and language (Spanish) as the existing specs under
`docs/superpowers/specs/`. End with build-plan decomposition + coarse
estimates.

**Verify**: doc exists, every claim about current code carries `file:line`,
open-questions section present.

## Done criteria

- [ ] `docs/superpowers/specs/2026-07-booking-manage-links-design.md`
      exists with: token design, routes, cancel + reschedule action specs,
      tenant/RLS resolution, email triggers, open questions
- [ ] No application code modified (`git status` shows only the new doc)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `booking_tokens` turns out to be referenced by live code after all
  (recheck the grep) — the "dead substrate" premise would be wrong.
- The `cancelled_client` transition is not representable in
  `lib/bookings/status.ts` transition rules — that's a deeper model
  conflict to surface, not design around.

## Maintenance notes

- This flow, once built, is the template for any future client-facing
  magic-link surface (e.g. "confirm attendance"). The token design decided
  here becomes the precedent — that's why the spike insists on the hashed,
  guarded-consumption pattern.
- The confirmation-page promise (`done/[publicId]/page.tsx:52`) should be
  softened or fulfilled in the same release that ships this — shipping
  copy that promises an email link that never arrives is the current bug.
