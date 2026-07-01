import 'server-only'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { withTenant } from '@/lib/db/tenant'
import { booking_notifications } from '@/lib/db/schema'
import type { EmailKind } from './types'

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

function isPostgresUniqueError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  )
}

// Reserva la fila de idempotencia ANTES de enviar. Si ya existe (otra petición
// nos adelantó), devolvemos `false` y el caller no envía. Si la inserción
// triunfa, somos el único enviador autorizado para ese (booking, kind, version).
//
// `version` se usa solo para `booking_reschedule` (cada reprogramación es un
// evento nuevo). El resto de tipos lo deja en 0 y la unique key actúa como
// `(booking_id, kind)`.
export async function reserveNotificationSlot(
  params: {
    bookingId: number
    salonId: number
    kind: EmailKind
    version?: number
  },
  tx?: TxDb,
): Promise<{ reserved: boolean; rowId: number | null }> {
  const run = async (t: TxDb) => {
    const inserted = await t
      .insert(booking_notifications)
      .values({
        booking_id: params.bookingId,
        salon_id: params.salonId,
        kind: params.kind,
        version: params.version ?? 0,
      })
      .returning({ id: booking_notifications.id })
    const row = inserted[0]
    return { reserved: true, rowId: row?.id ?? null }
  }
  try {
    return await (tx ? run(tx) : withTenant(params.salonId, run))
  } catch (err) {
    // UNIQUE violation → otra petición ya reservó este slot.
    if (isPostgresUniqueError(err)) return { reserved: false, rowId: null }
    throw new Error(
      `reserveNotificationSlot: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

// Tras un envío correcto guardamos el message id devuelto por Resend. Útil
// para correlacionar quejas/bounces más adelante.
export async function recordProviderMessageId(
  rowId: number,
  providerMessageId: string,
  salonId: number,
  tx?: TxDb,
): Promise<void> {
  const run = async (t: TxDb) => {
    await t
      .update(booking_notifications)
      .set({ provider_message_id: providerMessageId })
      .where(eq(booking_notifications.id, rowId))
  }
  if (tx) await run(tx)
  else await withTenant(salonId, run)
}

// Si reservamos pero el envío falla, soltamos la fila para permitir reintentos
// manuales/futuros. No queremos dejar "fantasmas" que bloqueen reintentos.
export async function releaseNotificationSlot(
  rowId: number,
  salonId: number,
  tx?: TxDb,
): Promise<void> {
  const run = async (t: TxDb) => {
    await t
      .delete(booking_notifications)
      .where(eq(booking_notifications.id, rowId))
  }
  if (tx) await run(tx)
  else await withTenant(salonId, run)
}
