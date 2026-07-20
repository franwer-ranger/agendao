import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { salon_lifecycle } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const SALON_BILLING_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
] as const

export type SalonBillingStatus = (typeof SALON_BILLING_STATUSES)[number]
export type SalonLifecycleStatus = SalonBillingStatus | 'suspended'

export type SalonAccessState = {
  status: SalonLifecycleStatus
  billingStatus: SalonBillingStatus
  trialEndsAt: Date | null
  suspendedAt: Date | null
}

// Garantiza el contrato inicial que usara signup: 14 dias de trial calculados
// por Postgres. Debe ejecutarse tras fijar el GUC del salon. Si el onboarding
// reintenta el provisioning, conserva intacto el ciclo de vida ya existente.
export async function createTrialLifecycle(
  salonId: number,
  tx?: TxDb,
): Promise<void> {
  const run = (t: TxDb) =>
    t
      .insert(salon_lifecycle)
      .values({ salon_id: salonId })
      .onConflictDoNothing({ target: salon_lifecycle.salon_id })

  if (tx) {
    await run(tx)
  } else {
    await withTenant(salonId, run)
  }
}

// Fuente comun de lectura para signup, gating, webhooks y superadmin. Nunca lee
// la tabla fuera del contexto RLS del tenant. La suspension operativa prevalece
// sin destruir el estado de billing que los webhooks mantienen por separado.
// AGE-005 debe descartar eventos repetidos o mas antiguos antes de actualizar;
// este contrato impone el grafo, pero no conoce el orden propio de Stripe.
export async function getSalonAccessState(
  salonId: number,
  tx?: TxDb,
): Promise<SalonAccessState | null> {
  const run = async (t: TxDb): Promise<SalonAccessState | null> => {
    const row = (
      await t
        .select({
          billingStatus: salon_lifecycle.billing_status,
          trialEndsAt: salon_lifecycle.trial_ends_at,
          suspendedAt: salon_lifecycle.suspended_at,
        })
        .from(salon_lifecycle)
        .where(eq(salon_lifecycle.salon_id, salonId))
        .limit(1)
    )[0]

    if (!row) return null

    const billingStatus = row.billingStatus as SalonBillingStatus
    return {
      status: row.suspendedAt ? 'suspended' : billingStatus,
      billingStatus,
      trialEndsAt: row.trialEndsAt,
      suspendedAt: row.suspendedAt,
    }
  }

  return tx ? run(tx) : withTenant(salonId, run)
}
