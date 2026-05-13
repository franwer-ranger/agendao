import 'server-only'
import { loadBookingEmailContext } from '@/lib/email/load-context'
import { sendBookingEmail } from '@/lib/email/send'
import { BookingReminderEmail } from '@/lib/email/templates/booking-reminder'
import { createAdminClient } from '@/lib/supabase/admin'

export type ReminderRunResult = {
  scanned: number
  sent: number
  skipped: number
  failed: number
  errors: string[]
}

// Selecciona reservas confirmadas que empiezan entre 23h y 25h en el futuro y
// aún no han recibido recordatorio. Ventana en lugar de punto exacto para
// tolerar retrasos del cron y mantener idempotencia natural cuando se vuelva
// a ejecutar.
//
// El filtro de "ya enviado" lo da la unique key de `booking_notifications`:
// el envío reservará el slot y, si está ocupado, no se envía dos veces aunque
// dos crons coincidan o se ejecuten manualmente seguidos.
export async function runReminderBatch(): Promise<ReminderRunResult> {
  const supabase = createAdminClient()
  const result: ReminderRunResult = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, salon_id, starts_at, client:clients!inner(email)')
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd)

  if (error) {
    result.errors.push(`query failed: ${error.message}`)
    return result
  }

  result.scanned = bookings?.length ?? 0

  for (const booking of bookings ?? []) {
    const client = Array.isArray(booking.client)
      ? booking.client[0]
      : booking.client
    if (!client?.email) {
      result.skipped += 1
      continue
    }

    try {
      const ctx = await loadBookingEmailContext(booking.id)
      if (!ctx) {
        result.failed += 1
        result.errors.push(`booking ${booking.id}: context not found`)
        continue
      }

      const sendResult = await sendBookingEmail({
        to: ctx.client.email,
        subject: `Recordatorio: mañana tienes cita en ${ctx.salon.name}`,
        react: BookingReminderEmail({ ctx }),
        kind: 'booking_reminder',
        bookingId: booking.id,
        salonId: booking.salon_id,
      })

      if (sendResult.ok) {
        if ('skipped' in sendResult && sendResult.skipped) {
          result.skipped += 1
        } else {
          result.sent += 1
        }
      } else {
        result.failed += 1
        result.errors.push(`booking ${booking.id}: ${sendResult.error}`)
      }
    } catch (err) {
      result.failed += 1
      result.errors.push(
        `booking ${booking.id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return result
}
