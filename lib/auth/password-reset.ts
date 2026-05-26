import 'server-only'
import { and, eq, isNull, gt } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'

import { db } from '@/lib/db'
import { app_users, auth_password_reset_tokens, salons } from '@/lib/db/schema'
import { sendTransactionalEmail } from '@/lib/email/send-transactional'
import { PasswordResetEmail } from '@/lib/email/templates/password-reset'

import { hashPassword } from './password'
import { revokeAllSessionsForUser } from './sessions'

const TOKEN_TTL_MS = 1000 * 60 * 60 // 1h
const TOKEN_TTL_MINUTES = 60

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function getAppUrl(): string {
  const raw = process.env.APP_URL ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

export async function requestPasswordReset(
  emailRaw: string,
): Promise<{ ok: true }> {
  const email = emailRaw.trim()
  if (!email) return { ok: true }

  const user = db
    .select({
      id: app_users.id,
      email: app_users.email,
      display_name: app_users.display_name,
      is_active: app_users.is_active,
      salon_id: app_users.salon_id,
    })
    .from(app_users)
    .where(eq(app_users.email, email))
    .get()

  // Always return success to avoid user enumeration.
  if (!user || !user.is_active) return { ok: true }

  const plaintext = randomBytes(32).toString('base64url')
  const tokenHash = sha256(plaintext)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  db.insert(auth_password_reset_tokens)
    .values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .run()

  const salon = db
    .select({ name: salons.name })
    .from(salons)
    .where(eq(salons.id, user.salon_id))
    .get()

  const resetUrl = `${getAppUrl()}/reset-password/${plaintext}`

  await sendTransactionalEmail({
    to: user.email,
    subject: 'Restablece tu contraseña',
    react: PasswordResetEmail({
      salonName: salon?.name ?? 'Agendao',
      userDisplayName: user.display_name,
      resetUrl,
      expiresInMinutes: TOKEN_TTL_MINUTES,
    }),
  })

  return { ok: true }
}

export type ValidatedResetToken = {
  userId: string
  tokenRowId: number
}

export async function validateResetToken(
  plaintext: string,
): Promise<ValidatedResetToken | null> {
  if (!plaintext) return null
  const tokenHash = sha256(plaintext)
  const row = db
    .select({
      id: auth_password_reset_tokens.id,
      user_id: auth_password_reset_tokens.user_id,
    })
    .from(auth_password_reset_tokens)
    .where(
      and(
        eq(auth_password_reset_tokens.token_hash, tokenHash),
        isNull(auth_password_reset_tokens.used_at),
        gt(auth_password_reset_tokens.expires_at, new Date()),
      ),
    )
    .get()
  if (!row) return null
  return { userId: row.user_id, tokenRowId: row.id }
}

export type ConsumeResetTokenResult =
  | { ok: true }
  | { ok: false; error: 'invalid_token' | 'unknown' }

export async function consumeResetToken(
  plaintext: string,
  newPassword: string,
): Promise<ConsumeResetTokenResult> {
  const validated = await validateResetToken(plaintext)
  if (!validated) return { ok: false, error: 'invalid_token' }

  try {
    const hashed = await hashPassword(newPassword)
    db.transaction((tx) => {
      tx.update(app_users)
        .set({ password_hash: hashed })
        .where(eq(app_users.id, validated.userId))
        .run()
      tx.update(auth_password_reset_tokens)
        .set({ used_at: new Date() })
        .where(eq(auth_password_reset_tokens.id, validated.tokenRowId))
        .run()
    })
    await revokeAllSessionsForUser(validated.userId)
    return { ok: true }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}
