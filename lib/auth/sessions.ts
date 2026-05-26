import 'server-only'
import { db } from '@/lib/db'
import { app_users, auth_sessions } from '@/lib/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export type ValidatedSession = {
  sessionId: string
  userId: string
  email: string
  displayName: string
  role: 'admin' | 'staff'
  salonId: number
}

export type CreatedSession = {
  id: string
  expiresAt: Date
}

export async function createSession(
  userId: string,
  ctx?: { userAgent?: string; ip?: string },
): Promise<CreatedSession> {
  const id = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  db.insert(auth_sessions)
    .values({
      id,
      user_id: userId,
      expires_at: expiresAt,
      user_agent: ctx?.userAgent ?? null,
      ip: ctx?.ip ?? null,
    })
    .run()
  return { id, expiresAt }
}

export async function validateSession(
  sessionId: string,
): Promise<ValidatedSession | null> {
  const row = db
    .select({
      sessionId: auth_sessions.id,
      userId: app_users.id,
      email: app_users.email,
      displayName: app_users.display_name,
      role: app_users.role,
      salonId: app_users.salon_id,
      isActive: app_users.is_active,
    })
    .from(auth_sessions)
    .innerJoin(app_users, eq(app_users.id, auth_sessions.user_id))
    .where(
      and(
        eq(auth_sessions.id, sessionId),
        gt(auth_sessions.expires_at, new Date()),
      ),
    )
    .get()

  if (!row || !row.isActive) return null
  if (row.role !== 'admin' && row.role !== 'staff') return null

  // Best-effort refresh of last_used_at; failure to update should not block auth.
  try {
    db.update(auth_sessions)
      .set({ last_used_at: new Date() })
      .where(eq(auth_sessions.id, sessionId))
      .run()
  } catch {
    // ignore
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    salonId: row.salonId,
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  db.delete(auth_sessions).where(eq(auth_sessions.id, sessionId)).run()
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  db.delete(auth_sessions).where(eq(auth_sessions.user_id, userId)).run()
}
