import { eq } from 'drizzle-orm'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import 'server-only'
import { z } from 'zod'

import { db } from '@/lib/db'
import { app_users } from '@/lib/db/schema'

import { authConfig } from './config'
import { verifyPassword } from './password'
import { createSession, revokeSession, validateSession } from './sessions'
import './types'

const credsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw)
        if (!parsed.success) return null
        const { email, password } = parsed.data

        const user = db
          .select()
          .from(app_users)
          .where(eq(app_users.email, email))
          .get()

        if (!user || !user.is_active) return null
        if (user.role !== 'admin' && user.role !== 'staff') return null

        const ok = await verifyPassword(user.password_hash, password)
        if (!ok) return null

        try {
          db.update(app_users)
            .set({ last_login_at: new Date() })
            .where(eq(app_users.id, user.id))
            .run()
        } catch {
          // ignore — login should not fail on this side effect
        }

        return {
          id: user.id,
          email: user.email,
          name: user.display_name,
          role: user.role,
          salonId: user.salon_id,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        const session = await createSession(user.id as string)
        token.sid = session.id
        token.uid = user.id as string
        token.role = (user as { role: 'admin' | 'staff' }).role
        token.salonId = (user as { salonId: number }).salonId
        return token
      }

      const sid = token.sid as string | undefined
      if (!sid) return null

      const dbSession = await validateSession(sid)
      if (!dbSession) return null

      token.uid = dbSession.userId
      token.role = dbSession.role
      token.salonId = dbSession.salonId
      return token
    },
  },
  events: {
    async signOut(message) {
      const sid = (message as { token?: { sid?: string } | null }).token?.sid
      if (sid) {
        try {
          await revokeSession(sid)
        } catch {
          // ignore
        }
      }
    },
  },
})
