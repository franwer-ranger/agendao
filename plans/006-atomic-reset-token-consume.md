# Plan 006: Consumo atómico del token de reseteo de contraseña

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bff3dd..HEAD -- lib/auth/password-reset.ts`
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

Password-reset tokens are designed to be single-use, but consumption is
check-then-act: `consumeResetToken` first validates the token with a SELECT
(`used_at IS NULL`), then — in a separate transaction — updates the password
and stamps `used_at` **without re-checking** `used_at IS NULL` and without
verifying a row was affected. Two concurrent submissions of the same token
both pass validation and both change the password, defeating single-use
semantics on an authentication flow. The fix makes the token consumption a
guarded UPDATE inside the same transaction and treats "0 rows updated" as an
invalid token.

## Current state

- `lib/auth/password-reset.ts` — the whole reset-token lifecycle. Tokens are
  sha256-hashed at rest, TTL 60 min, and consuming one revokes all the
  user's sessions (that part is correct; keep it).
- The vulnerable function (`lib/auth/password-reset.ts:126-154`):

```ts
export async function consumeResetToken(
  plaintext: string,
  newPassword: string,
): Promise<ConsumeResetTokenResult> {
  const validated = await validateResetToken(plaintext)
  if (!validated) return { ok: false, error: 'invalid_token' }

  try {
    const hashed = await hashPassword(newPassword)
    await db.transaction(async (tx) => {
      // GUC como PRIMER statement: el UPDATE de app_users está scoped por RLS.
      await tx.execute(
        sql`select set_config('app.current_salon_id', ${String(validated.salonId)}, true)`,
      )
      await tx
        .update(app_users)
        .set({ password_hash: hashed })
        .where(eq(app_users.id, validated.userId))
      await tx
        .update(auth_password_reset_tokens)
        .set({ used_at: new Date() })
        .where(eq(auth_password_reset_tokens.id, validated.tokenRowId))
    })
    await revokeAllSessionsForUser(validated.userId)
    return { ok: true }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}
```

- `validateResetToken` (same file, ~lines 90-120) SELECTs the token row where
  `used_at IS NULL AND expires_at > now()` joined to `app_users` for the
  `salon_id`. It is also used by the reset **page** to render/refuse the form
  — keep it exported and unchanged.
- RLS context (from `drizzle/0003_rls.sql:13-14`): `auth_password_reset_tokens`
  and `auth_sessions` deliberately have **no RLS** ("se acceden por token/sid
  opaco"). `app_users` UPDATE **is** RLS-scoped by the GUC — that's why the
  transaction sets `app.current_salon_id` first. Preserve that ordering.
- Drizzle returning-clause convention: `.returning({ id: table.id })` — see
  `lib/email/notifications-log.ts:44` for an exemplar.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Lint      | `npm run lint`  | exit 0              |
| Build     | `npm run build` | exit 0              |

Note: do NOT use `npx tsc --noEmit` as a gate — it currently false-fails on a
stale generated file under `.next/dev/types`. `npm run build` is the type gate.

## Scope

**In scope** (the only file you should modify):
- `lib/auth/password-reset.ts` (only `consumeResetToken`)

**Out of scope** (do NOT touch):
- `validateResetToken` — the reset page uses it to render the form; the
  pre-validation inside `consumeResetToken` also stays (it resolves
  `salonId`/`userId`/`tokenRowId` and gives fast feedback).
- `app/reset-password/[token]/actions.ts` — its handling of
  `invalid_token` vs `unknown` already exists; the new failure mode maps to
  `invalid_token`, no caller change needed.
- Token generation/hashing, session revocation.

## Git workflow

- Branch: `advisor/006-atomic-reset-token-consume`
- Commit message style: `fix(auth): consumo del token de reseteo atómico y de un solo uso real`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Guarded, verified token consumption inside the transaction

Restructure the transaction body in `consumeResetToken` so that:

1. The GUC `set_config` stays the **first** statement (RLS requirement).
2. The token UPDATE runs **before** the password UPDATE, gains an
   `isNull(auth_password_reset_tokens.used_at)` predicate, and returns the
   affected id.
3. If it affected 0 rows (another request consumed the token between
   validation and now), throw a sentinel error so the transaction rolls
   back and the function returns `invalid_token`.

Target shape (add `isNull` to the existing `drizzle-orm` import if missing):

```ts
class TokenAlreadyUsedError extends Error {}

...
    await db.transaction(async (tx) => {
      // GUC como PRIMER statement: el UPDATE de app_users está scoped por RLS.
      await tx.execute(
        sql`select set_config('app.current_salon_id', ${String(validated.salonId)}, true)`,
      )
      // Consumo atómico: solo un request puede pasar de used_at NULL → now().
      const consumed = await tx
        .update(auth_password_reset_tokens)
        .set({ used_at: new Date() })
        .where(
          and(
            eq(auth_password_reset_tokens.id, validated.tokenRowId),
            isNull(auth_password_reset_tokens.used_at),
          ),
        )
        .returning({ id: auth_password_reset_tokens.id })
      if (consumed.length === 0) throw new TokenAlreadyUsedError()

      await tx
        .update(app_users)
        .set({ password_hash: hashed })
        .where(eq(app_users.id, validated.userId))
    })
```

And split the catch:

```ts
  } catch (err) {
    if (err instanceof TokenAlreadyUsedError) {
      return { ok: false, error: 'invalid_token' }
    }
    return { ok: false, error: 'unknown' }
  }
```

Declare `TokenAlreadyUsedError` at module scope in the same file (not
exported). Keep `revokeAllSessionsForUser` after the transaction, unchanged.

**Verify**: `grep -n "isNull(auth_password_reset_tokens.used_at)" lib/auth/password-reset.ts` → 2 matches (the one in `validateResetToken` plus the new one).

### Step 2: Lint and build

**Verify**: `npm run lint` → exit 0. `npm run build` → exit 0.

## Test plan

No automated tests in this repo (explicit maintainer decision — do not add
any). Manual QA for the reviewer, in `npm run dev`: run the full
forgot-password flow once → reset succeeds, old sessions die. Submit the
**same** token URL a second time → the form/action reports invalid token
(previously the second submit would also succeed within the TTL if it raced;
sequentially it already failed via `validateResetToken` — the race window is
what this plan closes, which manual QA can't exercise directly; the guarded
UPDATE + rowcount check is the verification).

## Done criteria

- [ ] The token UPDATE has the `used_at IS NULL` guard, uses `.returning`,
      and a 0-row result maps to `invalid_token`
- [ ] The token UPDATE precedes the `app_users` password UPDATE inside the
      transaction, and `set_config` remains the first statement
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The transaction body no longer matches the excerpt (drift).
- `auth_password_reset_tokens` gained an RLS policy (check any new
  migration under `drizzle/`) — the ordering assumptions here would need
  re-review.
- Drizzle's `.returning()` is unavailable on `.update()` in the installed
  version (it is in drizzle-orm 0.45 — if typechecking disagrees, report).

## Maintenance notes

- Pattern for reviewers: any "single-use" semantic (tokens, invitation
  links, the future `booking_tokens` magic links of plan 013) must be
  consumed via a guarded UPDATE with a rowcount check — never
  SELECT-then-UPDATE across statements.
- The pre-validation `validateResetToken` call is now purely UX (fast
  feedback + resolving ids); the guarded UPDATE is the source of truth.
