'use server'

import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { app_users } from '@/lib/db/schema'

export async function dismissWelcomeAction(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return

  db.update(app_users)
    .set({ welcome_seen_at: new Date() })
    .where(eq(app_users.id, session.user.id))
    .run()
}
