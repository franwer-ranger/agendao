# Plan 007: Higiene de toolchain y entorno (deps, typecheck, .env.example, CI, deploy env)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- package.json package-lock.json .env.example config/deploy.yml tsconfig.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

Four small gaps compound: (1) the `shadcn` codegen CLI sits in production
`dependencies`, dragging a high-severity `hono` advisory into every
`npm audit --omit=dev` and inflating the prod install; (2) there is no
`typecheck` script, and `npx tsc --noEmit` false-fails on stale generated
types, so type regressions surface only in full builds; (3) `.env.example`
still documents the removed SQLite setup and omits variables the code reads,
so a fresh clone breaks; (4) `config/deploy.yml` does not pass `AUTH_SECRET`
or `AUTH_TRUST_HOST` to the container even though the README (line 122) says
both are required in production — Auth.js v5 throws `MissingSecret` /
`UntrustedHost` without them. A minimal CI (lint + typecheck + build; **no
tests — deliberate repo policy**) makes the gates automatic.

## Current state

- `package.json:40` — `"shadcn": "^4.7.0"` under `dependencies`. Nothing in
  `app/` or `lib/` imports it (it's the component-codegen CLI).
  `npm ls hono` shows `shadcn → @modelcontextprotocol/sdk → hono@4.12.18`
  (high advisories per `npm audit --omit=dev`).
- `package.json:5-16` — scripts: `dev/build/start/lint/lint:fix/predeploy/db:*`.
  `predeploy` = `npm run lint && npm run build`. No `typecheck`.
- Known wrinkle: `npx tsc --noEmit` currently errors with
  `.next/dev/types/validator.ts ... Cannot find module '../../../app/page.js'`
  — a stale generated file from before the landing moved into the
  `(landing)` route group. Next 16 provides `next typegen` to regenerate
  route types; run it before `tsc`. **This repo is Next 16 — check
  `node_modules/next/dist/docs/` if any Next behavior surprises you.**
- `.env.example` (full current content is 22 lines) — documents
  `DATABASE_URL=./data/dev.db` as a "Path al archivo SQLite" (line 4); the
  app now uses Postgres via `pg` (`lib/db/index.ts:6-9` throws if
  `DATABASE_URL` is unset). Vars actually read by code
  (`grep -rhoE "process\.env\.[A-Z_]+" app lib scripts config`):
  `DATABASE_URL, APP_URL, UPLOADS_DIR, RESEND_API_KEY, EMAIL_FROM,
  EMAIL_EXAMPLE, CRON_SECRET, NODE_ENV` — plus `AUTH_SECRET` /
  `AUTH_TRUST_HOST`, read internally by `next-auth`. `.env.example` is
  missing `APP_URL`, `UPLOADS_DIR`, `EMAIL_EXAMPLE`, `AUTH_SECRET`.
- `config/deploy.yml:35-49` — `env.clear` has `NODE_ENV, PORT, HOSTNAME,
  NEXT_TELEMETRY_DISABLED, APP_URL, UPLOADS_DIR`; `env.secret` has
  `DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, CRON_SECRET`. **No AUTH_SECRET,
  no AUTH_TRUST_HOST.**
- No `.github/` directory exists. Remote is GitHub
  (`github.com/franwer-ranger/agendao`).
- Repo policy: **no automated tests, ever** (maintainer decision; QA is
  manual). CI must not include a test step or install a test framework.
- The production build needs a `DATABASE_URL` present at build time even
  though it doesn't connect — the Dockerfile uses a placeholder for this
  (see commit `7bff3dd` "placeholder DATABASE_URL en build stage"). CI must
  do the same.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Install   | `npm install`              | exit 0, lockfile updated |
| Lint      | `npm run lint`             | exit 0              |
| Typecheck | `npm run typecheck` (created in Step 2) | exit 0 |
| Build     | `npm run build`            | exit 0              |
| Audit     | `npm audit --omit=dev`     | after Step 1: no high/critical from `hono` |

## Scope

**In scope** (the only files you should modify/create):
- `package.json`, `package-lock.json` (via `npm install`)
- `.env.example`
- `config/deploy.yml`
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- Any application source under `app/` or `lib/`.
- `Dockerfile`, `docker-entrypoint.sh` — already correct for Postgres.
- `.kamal/secrets` — not in git; Step 4 only adds the variable **names** to
  `deploy.yml`; the operator supplies values (see Maintenance notes).
- Adding any test framework, test script, or test CI step — explicitly
  forbidden by repo policy.

## Git workflow

- Branch: `advisor/007-toolchain-and-env-hygiene`
- Commit message style: `chore(dx): shadcn a devDeps, script typecheck, .env.example Postgres y CI mínima`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move `shadcn` to devDependencies

In `package.json`, move `"shadcn": "^4.7.0"` from `dependencies` to
`devDependencies`, then run `npm install` to sync the lockfile.

**Verify**: `npm audit --omit=dev 2>&1 | grep -ci "high"` → 0 (no high
advisories in the prod tree). `grep -rn "from 'shadcn'\|from \"shadcn\"" app/ lib/ components/` → no matches (nothing imported it).

### Step 2: Add a `typecheck` script

In `package.json` scripts add:

```json
"typecheck": "next typegen && tsc --noEmit"
```

and change `predeploy` to `npm run lint && npm run typecheck && npm run build`.
If `next typegen` is not a valid command in the installed Next version
(check `npx next --help` and `node_modules/next/dist/docs/`), use
`"typecheck": "tsc --noEmit"` and note that a `next build` (or `next dev`)
must have run since the last route change.

**Verify**: `npm run typecheck` → exit 0 (the stale `.next/dev/types`
error is gone after typegen).

### Step 3: Rewrite `.env.example` for the Postgres reality

Replace the file content with documented entries for every variable, no
real values (placeholders only):

- `DATABASE_URL` — Postgres connection string, example
  `postgres://user:pass@localhost:5432/agendao` (comment: Neon pooled URL
  in prod).
- `APP_URL` — absolute base URL for links/uploads, `http://localhost:3000`
  in dev.
- `UPLOADS_DIR` — where uploaded images land; default `./data/uploads` in
  dev, `/app/data/uploads` in the container.
- `AUTH_SECRET` — Auth.js session-encryption secret; generate with
  `openssl rand -base64 32` (leave value empty in the example).
- `RESEND_API_KEY`, `EMAIL_FROM` — keep existing comments.
- `EMAIL_EXAMPLE` — non-prod recipient override sandbox (see
  `lib/email/client.ts`).
- `CRON_SECRET` — keep, but the comment should say the `?secret=` query
  form works only when `NODE_ENV !== 'production'` (aligned with plan 001).
- `NODE_ENV` — keep.

Preserve the existing style: Spanish comments, `# --- Sección ---` headers.

**Verify**: for each var in
`grep -rhoE "process\.env\.[A-Z_]+" app lib scripts config | sort -u`
(ignore `NODE_ENV` duplicates and `VERCEL_ENV` if plan 001 hasn't landed),
`grep -c "^<VAR>=" .env.example` → 1. Also `grep -c "AUTH_SECRET" .env.example` → ≥1.

### Step 4: Pass auth env through Kamal

In `config/deploy.yml`:
- Under `env.clear`, add `AUTH_TRUST_HOST: 'true'` (required behind
  kamal-proxy; README line 122 documents this).
- Under `env.secret`, add `- AUTH_SECRET`.

Names only — never write a secret value into this file.

**Verify**: `grep -n "AUTH_SECRET\|AUTH_TRUST_HOST" config/deploy.yml` → 2 matches.

### Step 5: Minimal CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      # next build importa lib/db/index.ts, que exige DATABASE_URL aunque
      # no conecte en build. Mismo truco de placeholder que el Dockerfile.
      DATABASE_URL: postgres://build:build@localhost:5432/build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
```

No test step — deliberate repo policy.

**Verify**: `npx --yes yaml-lint .github/workflows/ci.yml 2>/dev/null || node -e "require('js-yaml')"` may not be available; instead verify with
`node -e "const fs=require('fs');console.log(fs.readFileSync('.github/workflows/ci.yml','utf8').includes('npm run build'))"` → `true`, and rely on the full local sequence below.

### Step 6: Full local gate

**Verify**: `npm run lint && npm run typecheck && npm run build` → all exit 0.

## Test plan

No automated tests (repo policy). The verification gates above are the test.
Reviewer note: after merge, the first push to GitHub shows the CI run; the
first `kamal deploy` after the operator adds `AUTH_SECRET` to
`.kamal/secrets` (+ `kamal env push`) validates Step 4 — watch for Auth.js
`MissingSecret`/`UntrustedHost` errors disappearing from `kamal logs`.

## Done criteria

- [ ] `node -e "const p=require('./package.json');console.log(!p.dependencies.shadcn && !!p.devDependencies.shadcn && !!p.scripts.typecheck)"` → `true`
- [ ] `npm run typecheck` exits 0
- [ ] `.env.example` contains `DATABASE_URL` (postgres form), `APP_URL`,
      `UPLOADS_DIR`, `AUTH_SECRET`, `EMAIL_EXAMPLE` entries
- [ ] `config/deploy.yml` lists `AUTH_SECRET` under `env.secret` and
      `AUTH_TRUST_HOST` under `env.clear`
- [ ] `.github/workflows/ci.yml` exists with lint/typecheck/build and no
      test step
- [ ] `npm run lint && npm run build` exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Removing `shadcn` from `dependencies` breaks `npm run build` (it should
  not — nothing imports it; if it does, something else changed).
- `next typegen` and the fallback both fail to clear the
  `.next/dev/types/validator.ts` error — deleting `.next` is acceptable to
  try once (`rm -rf .next`), but if the error persists after a fresh
  `npm run build`, report.
- You are tempted to add any secret value to `.env.example`,
  `config/deploy.yml`, or CI. Never do that; names and placeholders only.

## Maintenance notes

- **Operator follow-ups after merge**: (1) add `AUTH_SECRET` to
  `.kamal/secrets` and run `kamal env push` — if production login currently
  works, find where the value was being injected before assuming it's new;
  if it errors, this fixes it. (2) Consider making the GitHub branch
  protection require the CI check.
- When plan 001 lands, `VERCEL_ENV` disappears — the CRON_SECRET comment in
  `.env.example` written here already matches that end state.
- New env vars must be added to `.env.example` **and** `config/deploy.yml`
  in the same PR that reads them — reviewers should enforce this.
