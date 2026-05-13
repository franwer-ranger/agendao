import 'server-only'
import {
  getSalonNotificationConfig,
  loadBookingEmailContext,
} from '@/lib/email/load-context'
import { sendBookingEmail } from '@/lib/email/send'
import { BookingConfirmationEmail } from '@/lib/email/templates/booking-confirmation'
import { SalonNewBookingEmail } from '@/lib/email/templates/salon-new-booking'

// Dispara los emails que corresponden tras crear una reserva:
//   - Confirmación al cliente (si dio email).
//   - Aviso al salón (si flag activo y hay contact_email).
//
// Pensado para llamarse desde `after()` en una server action: no lanza, loguea
// fallos con tag y la idempotencia la garantiza `booking_notifications`.
export async function emitBookingCreatedEmails(
  bookingId: number,
): Promise<void> {
  try {
    const ctx = await loadBookingEmailContext(bookingId)
    if (!ctx) {
      console.error('[email:booking_created] context not found', { bookingId })
      return
    }

    const sends: Array<Promise<unknown>> = []

    if (ctx.client.email) {
      sends.push(
        sendBookingEmail({
          to: ctx.client.email,
          subject: `Confirmación de tu reserva en ${ctx.salon.name}`,
          react: BookingConfirmationEmail({ ctx }),
          kind: 'booking_confirmation',
          bookingId,
          salonId: ctx.salon.id,
        }).then((result) => {
          if (!result.ok) {
            console.error('[email:booking_confirmation] send failed', {
              bookingId,
              error: result.error,
            })
          }
        }),
      )
    }

    const salonConfig = await getSalonNotificationConfig(ctx.salon.id)
    if (salonConfig?.notifySalon && salonConfig.contactEmail) {
      sends.push(
        sendBookingEmail({
          to: salonConfig.contactEmail,
          subject: `Nueva reserva · ${ctx.client.displayName}`,
          react: SalonNewBookingEmail({ ctx }),
          kind: 'salon_new_booking',
          bookingId,
          salonId: ctx.salon.id,
        }).then((result) => {
          if (!result.ok) {
            console.error('[email:salon_new_booking] send failed', {
              bookingId,
              error: result.error,
            })
          }
        }),
      )
    }

    await Promise.all(sends)
  } catch (err) {
    // Nunca propagamos: la reserva ya está creada y el usuario ya tiene respuesta.
    console.error('[email:booking_created] unexpected error', {
      bookingId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
