import 'server-only'
import { loadBookingEmailContext } from '@/lib/email/load-context'
import { sendBookingEmail } from '@/lib/email/send'
import { BookingRescheduleEmail } from '@/lib/email/templates/booking-reschedule'

// Dispara el email de reprogramación al cliente con el horario nuevo
// (`ctx.starts_at`) y referencia al anterior (`previousStartsAt`).
// Pensado para llamarse desde `after()` en una server action. Nunca lanza:
// la idempotencia la garantiza la tabla `booking_notifications` mediante
// (booking_id, kind, version).
export async function emitBookingRescheduledEmails(
  bookingId: number,
  previousStartsAt: string,
): Promise<void> {
  try {
    const ctx = await loadBookingEmailContext(bookingId)
    if (!ctx) {
      console.error('[email:booking_reschedule] context not found', {
        bookingId,
      })
      return
    }
    if (!ctx.client.email) return

    const result = await sendBookingEmail({
      to: ctx.client.email,
      subject: `Reserva reprogramada en ${ctx.salon.name}`,
      react: BookingRescheduleEmail({ ctx, previousStartsAt }),
      kind: 'booking_reschedule',
      bookingId,
      salonId: ctx.salon.id,
    })
    if (!result.ok) {
      console.error('[email:booking_reschedule] send failed', {
        bookingId,
        error: result.error,
      })
    }
  } catch (err) {
    console.error('[email:booking_reschedule] unexpected error', {
      bookingId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
