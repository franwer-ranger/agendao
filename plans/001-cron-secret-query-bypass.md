# Plan 001: Cerrar el bypass `?secret=` del cron en producción

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- app/api/cron/send-reminders/route.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

The cron endpoint accepts the shared secret as a URL query parameter whenever
`process.env.VERCEL_ENV !== 'production'`. `VERCEL_ENV` is a Vercel-platform
variable; this app deploys with **Kamal to a VPS** (see `config/deploy.yml`),
where `VERCEL_ENV` is never set — so the condition is always true and the
query-param path is **permanently enabled in production**. Secrets in URLs end
up in kamal-proxy access logs, container logs, and any intermediary, turning a
log read into a working credential that can trigger unbounded reminder-email
sends. The fix keys the dev convenience on `NODE_ENV`, which Next.js sets to
`'production'` in production builds on any platform.

## Current state

- `app/api/cron/send-reminders/route.ts` — GET handler for the reminder cron,
  triggered externally (cron-job.org) with `Authorization: Bearer $CRON_SECRET`.

Excerpt (`app/api/cron/send-reminders/route.ts:29-39`):

```ts
  const auth = req.headers.get('authorization') ?? ''
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret') ?? ''

  const authorized =
    auth === `Bearer ${secret}` ||
    (process.env.VERCEL_ENV !== 'production' && querySecret === secret)

  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
```

The header comment of the same file (line 15) says: `// En no-prod también
vale \`?secret=$CRON_SECRET\` para pruebas locales.` — that intent is correct;
only the gating variable is wrong.

Repo conventions: comments in Spanish, no semicolons, single quotes (Prettier
config at `.prettierrc.json`). Match the file's existing style.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |

Note: do NOT use `npx tsc --noEmit` as a gate — it currently false-fails on a
stale generated file under `.next/dev/types`. `npm run build` is the type gate.

## Scope

**In scope** (the only file you should modify):
- `app/api/cron/send-reminders/route.ts`

**Out of scope** (do NOT touch):
- `lib/email/triggers/send-reminders.ts` — the batch logic is fine.
- `.env.example` — updated by plan 007; its comment about the query param
  ("solo fuera de produccion") remains accurate after this fix.
- Any rotation of the actual `CRON_SECRET` value — that is an operator action
  (see Maintenance notes), not a code change.

## Git workflow

- Branch: `advisor/001-cron-secret-query-bypass`
- Commit message style (conventional commits in Spanish, matching `git log`):
  `fix(cron): el bypass ?secret= solo aplica fuera de producción`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Gate the query-param path on `NODE_ENV`

In `app/api/cron/send-reminders/route.ts`, change the `authorized` expression
so the query-secret branch requires `process.env.NODE_ENV !== 'production'`
instead of `process.env.VERCEL_ENV !== 'production'`:

```ts
  const authorized =
    auth === `Bearer ${secret}` ||
    (process.env.NODE_ENV !== 'production' && querySecret === secret)
```

**Verify**: `grep -n "VERCEL_ENV" app/api/cron/send-reminders/route.ts` → no matches.

### Step 2: Lint and build

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

## Test plan

No automated tests in this repo (explicit maintainer decision — do not add
any). Manual QA note for the reviewer: in `npm run dev`,
`curl -i "http://localhost:3000/api/cron/send-reminders?secret=<CRON_SECRET from .env.local>"`
still returns 200 (dev convenience preserved); in a production build
(`npm run build && npm start`) the same URL returns 401 while
`curl -i -H "Authorization: Bearer <secret>" ...` returns 200.

## Done criteria

- [ ] `grep -rn "VERCEL_ENV" app/` returns no matches
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `authorized` expression at lines 33-35 no longer matches the excerpt
  (drift).
- You find other routes using the same `VERCEL_ENV` pattern — report them;
  do not fix them here.

## Maintenance notes

- **Operator follow-up (important)**: `CRON_SECRET` may have been exposed in
  proxy/access logs while the query path was live in production. Rotate it:
  generate a new value, update `.kamal/secrets`, run `kamal env push`, and
  update the external cron job's Authorization header.
- If a future cron endpoint is added, copy the Bearer-only pattern; the
  query-param convenience must always be gated on `NODE_ENV`.
