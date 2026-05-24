import 'server-only'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { booking_notifications } from '@/lib/db/schema'
import type { EmailKind } from './types'

function isSqliteUniqueError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}

// Reserva la fila de idempotencia ANTES de enviar. Si ya existe (otra petición
// nos adelantó), devolvemos `false` y el caller no envía. Si la inserción
// triunfa, somos el único enviador autorizado para ese (booking, kind, version).
//
// `version` se usa solo para `booking_reschedule` (cada reprogramación es un
// evento nuevo). El resto de tipos lo deja en 0 y la unique key actúa como
// `(booking_id, kind)`.
export async function reserveNotificationSlot(params: {
  bookingId: number
  salonId: number
  kind: EmailKind
  version?: number
}): Promise<{ reserved: boolean; rowId: number | null }> {
  try {
    const inserted = db
      .insert(booking_notifications)
      .values({
        booking_id: params.bookingId,
        salon_id: params.salonId,
        kind: params.kind,
        version: params.version ?? 0,
      })
      .returning({ id: booking_notifications.id })
      .all()
    const row = inserted[0]
    return { reserved: true, rowId: row?.id ?? null }
  } catch (err) {
    // UNIQUE violation → otra petición ya reservó este slot.
    if (isSqliteUniqueError(err)) return { reserved: false, rowId: null }
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
): Promise<void> {
  db.update(booking_notifications)
    .set({ provider_message_id: providerMessageId })
    .where(eq(booking_notifications.id, rowId))
    .run()
}

// Si reservamos pero el envío falla, soltamos la fila para permitir reintentos
// manuales/futuros. No queremos dejar "fantasmas" que bloqueen reintentos.
export async function releaseNotificationSlot(rowId: number): Promise<void> {
  db.delete(booking_notifications)
    .where(eq(booking_notifications.id, rowId))
    .run()
}
