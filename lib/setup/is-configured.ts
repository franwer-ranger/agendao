import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { salons } from '@/lib/db/schema'

// Gating de onboarding por-tenant. Sustituye al antiguo `isInstanceConfigured`
// global (single-tenant, cache de módulo). Cada salón tiene su propio estado de
// onboarding en `salons.onboarding_completed_at`. La policy RLS `salons_select`
// es `using (true)`, así que esta lectura no necesita fijar tenant.
export async function isSalonOnboarded(salonId: number): Promise<boolean> {
  const row = (
    await db
      .select({ done: salons.onboarding_completed_at })
      .from(salons)
      .where(eq(salons.id, salonId))
      .limit(1)
  )[0]
  return row?.done != null
}
