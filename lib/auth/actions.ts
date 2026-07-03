'use server'

import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { app_users } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'

export async function dismissWelcomeAction(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return

  // app_users UPDATE está scoped por GUC bajo RLS → hay que fijar el tenant del
  // usuario (session.user.salonId) o el UPDATE afectaría 0 filas.
  await withTenant(session.user.salonId, (tx) =>
    tx
      .update(app_users)
      .set({ welcome_seen_at: new Date() })
      .where(eq(app_users.id, session.user.id)),
  )
}
