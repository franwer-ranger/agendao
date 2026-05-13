import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EmailKind } from './types'

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
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('booking_notifications')
    .insert({
      booking_id: params.bookingId,
      salon_id: params.salonId,
      kind: params.kind,
      version: params.version ?? 0,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    // 23505 = unique_violation → otra petición ya reservó este slot.
    if (error.code === '23505') return { reserved: false, rowId: null }
    // Cualquier otro error lo propagamos al caller, que lo loguea y aborta.
    throw new Error(`reserveNotificationSlot: ${error.message}`)
  }
  return { reserved: true, rowId: data?.id ?? null }
}

// Tras un envío correcto guardamos el message id devuelto por Resend. Útil
// para correlacionar quejas/bounces más adelante.
export async function recordProviderMessageId(
  rowId: number,
  providerMessageId: string,
): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('booking_notifications')
    .update({ provider_message_id: providerMessageId })
    .eq('id', rowId)
}

// Si reservamos pero el envío falla, soltamos la fila para permitir reintentos
// manuales/futuros. No queremos dejar "fantasmas" que bloqueen reintentos.
export async function releaseNotificationSlot(rowId: number): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('booking_notifications').delete().eq('id', rowId)
}
