# Plan 008: Cabeceras de endurecimiento HTTP

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- next.config.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `7bff3dd`, 2026-07-05

## Why this matters

The app serves an authenticated admin panel (`/admin`), auth pages, and a
public booking flow with **zero** hardening headers: no HSTS, no
clickjacking protection, no `X-Content-Type-Options`, no referrer policy.
kamal-proxy terminates TLS but asserts nothing to browsers. Adding the
low-risk header set is a few lines in `next.config.ts`. A full
Content-Security-Policy is deliberately **out of scope** here (it needs
nonce plumbing and inline-style auditing in a Next 16 app); this plan adds
`frame-ancestors`-equivalent protection via `X-Frame-Options` and leaves CSP
as a documented follow-up.

## Current state

- `next.config.ts` — the complete current config:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      // Permite hasta 10MB en server actions con uploads de imágenes; sharp
      // recomprime después a WebP, así que el archivo en disco es bastante
      // más pequeño. Validación dura de 5MB pre-procesado en lib/storage.ts.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
```

- Deploy: Kamal + kamal-proxy with Let's Encrypt on `app.agendao.xyz`
  (`config/deploy.yml:17-24`) — HTTPS is always on in prod, so HSTS is safe.
- **This repo is Next 16** — if the `headers()` API shape surprises you,
  check `node_modules/next/dist/docs/` before improvising (per `AGENTS.md`).

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |
| Dev check | `npm run dev` + `curl -sI http://localhost:3000/login` | headers present |

## Scope

**In scope** (the only file you should modify):
- `next.config.ts`

**Out of scope** (do NOT touch):
- A full `Content-Security-Policy` — follow-up, see Maintenance notes.
- `proxy.ts` / middleware — headers belong in the config for static
  coverage.
- kamal-proxy configuration.

## Git workflow

- Branch: `advisor/008-security-headers`
- Commit message style: `feat(security): cabeceras de endurecimiento (HSTS, XFO, nosniff, referrer)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `headers()` block

Extend `next.config.ts` (keep the existing `output` and `experimental`
entries untouched):

```ts
const securityHeaders = [
  // 2 años, tras verificar que todo el tráfico prod es HTTPS (kamal-proxy).
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: { ... },  // sin cambios
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}
```

**Verify**: `npm run build` → exit 0.

### Step 2: Confirm headers are emitted

Start `npm run dev`, then:

**Verify**: `curl -sI http://localhost:3000/login | grep -ci "x-frame-options\|x-content-type-options\|referrer-policy"` → 3. (HSTS may be
stripped on plain HTTP in dev; that's fine — it applies in prod behind TLS.)
Stop the dev server afterwards.

## Test plan

No automated tests (repo policy). Manual QA: after the next deploy,
`curl -sI https://app.agendao.xyz/login` shows all five headers, and the
booking flow + admin panel render normally (these headers don't affect
same-origin behavior; `X-Frame-Options: DENY` only breaks the app if
something legitimately iframes it — nothing in this repo does).

## Done criteria

- [ ] `next.config.ts` returns the five headers for `/(.*)`
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] Dev-server curl check shows the headers
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `headers()` is not supported in this Next 16 config shape (consult
  `node_modules/next/dist/docs/` first; report only if the docs confirm a
  different mechanism is required).
- Any page visibly breaks in dev with the headers on.

## Maintenance notes

- **Deferred follow-up**: a real `Content-Security-Policy`, started in
  report-only mode. It needs an inventory of inline styles/scripts (Tailwind
  is fine; check the landing's scroll-driven components) and Next's nonce
  support. Do it as its own plan.
- If an embed/widget feature ever ships (e.g. "inserta el botón de reservas
  en tu web"), `X-Frame-Options: DENY` must become route-scoped instead of
  global — revisit then.
