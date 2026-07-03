import 'server-only'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { bookings, clients, salons } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { loadBookingEmailContext } from '@/lib/email/load-context'
import { sendBookingEmail } from '@/lib/email/send'
import { BookingReminderEmail } from '@/lib/email/templates/booking-reminder'

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
  const result: ReminderRunResult = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // Bajo RLS, un barrido cross-tenant de `bookings` sin GUC devuelve 0 filas.
  // Enumeramos salones (policy SELECT pública `using(true)`, sin GUC) y hacemos
  // el scan de cada uno dentro de su propio withTenant.
  let salonRows: Array<{ id: number }> = []
  try {
    salonRows = await db.select({ id: salons.id }).from(salons)
  } catch (err) {
    result.errors.push(
      `salon enumeration failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return result
  }

  for (const { id: salonId } of salonRows) {
    let scanned: Array<{
      id: number
      client_email: string | null
    }> = []
    try {
      scanned = await withTenant(salonId, (tx) =>
        tx
          .select({
            id: bookings.id,
            client_email: clients.email,
          })
          .from(bookings)
          .innerJoin(clients, eq(clients.id, bookings.client_id))
          .where(
            and(
              inArray(bookings.status, ['pending', 'confirmed']),
              gte(bookings.starts_at, windowStart),
              lte(bookings.starts_at, windowEnd),
            ),
          ),
      )
    } catch (err) {
      result.errors.push(
        `salon ${salonId} query failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      continue
    }

    result.scanned += scanned.length

    for (const booking of scanned) {
      if (!booking.client_email) {
        result.skipped += 1
        continue
      }

      try {
        // loadBookingEmailContext se auto-envuelve con este salonId; el envío
        // (sendBookingEmail) reserva el slot de booking_notifications (unique
        // key) → idempotencia aunque dos crons coincidan.
        const ctx = await loadBookingEmailContext(booking.id, salonId)
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
          salonId,
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
  }

  return result
}
