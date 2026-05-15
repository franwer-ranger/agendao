import 'server-only'
import { getLogoPublicUrl } from '@/lib/salons/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BookingEmailContext } from './types'

// Carga todo lo que necesita una plantilla a partir del id interno de reserva.
// Una sola función: las plantillas son consistentes entre eventos (creación,
// recordatorio, cancelación), así que el view-model es el mismo.
export async function loadBookingEmailContext(
  bookingId: number,
): Promise<BookingEmailContext | null> {
  const supabase = createAdminClient()

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select(
      `
      id,
      public_id,
      starts_at,
      ends_at,
      salon_id,
      client:clients!inner (
        display_name,
        email
      ),
      salon:salons!inner (
        id,
        name,
        timezone,
        address,
        phone,
        contact_email,
        logo_path,
        cancellation_min_hours,
        cancellation_policy_text
      ),
      items:booking_items (
        position,
        starts_at,
        service_snapshot,
        employee:employees!inner (
          display_name
        )
      )
      `,
    )
    .eq('id', bookingId)
    .order('position', { foreignTable: 'booking_items', ascending: true })
    .maybeSingle()

  if (bookingErr) {
    throw new Error(`loadBookingEmailContext: ${bookingErr.message}`)
  }
  if (!booking) return null

  // Supabase devuelve relaciones como objeto (cuando la columna es FK única) o
  // array. Aquí client y salon son uno-a-uno y items es 1:N.
  const client = Array.isArray(booking.client)
    ? booking.client[0]
    : booking.client
  const salon = Array.isArray(booking.salon) ? booking.salon[0] : booking.salon
  const itemsRaw = booking.items as Array<{
    position: number
    starts_at: string
    service_snapshot: {
      name: string
      duration_minutes: number
      price_cents: number
    }
    employee: { display_name: string } | { display_name: string }[]
  }>

  const items = itemsRaw
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((it) => {
      const emp = Array.isArray(it.employee) ? it.employee[0] : it.employee
      return {
        serviceName: it.service_snapshot.name,
        employeeName: emp?.display_name ?? '',
        durationMinutes: it.service_snapshot.duration_minutes,
        priceCents: it.service_snapshot.price_cents,
      }
    })

  const totalCents = items.reduce((acc, i) => acc + i.priceCents, 0)

  return {
    salon: {
      id: salon.id,
      name: salon.name,
      timezone: salon.timezone,
      address: salon.address,
      phone: salon.phone,
      contactEmail: salon.contact_email,
      logoUrl: getLogoPublicUrl(salon.logo_path),
      cancellationMinHours: salon.cancellation_min_hours,
      cancellationPolicyText: salon.cancellation_policy_text,
    },
    client: {
      displayName: client.display_name,
      email: client.email ?? '',
    },
    booking: {
      publicId: booking.public_id,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      totalCents,
      items,
    },
  }
}

// Carga solo lo mínimo del salón para tomar la decisión de notificación. Útil
// cuando solo necesitas saber si el flag está activo, sin pagar la query
// completa.
export async function getSalonNotificationConfig(salonId: number): Promise<{
  notifySalon: boolean
  contactEmail: string | null
} | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('salons')
    .select('notify_salon_on_new_booking, contact_email')
    .eq('id', salonId)
    .maybeSingle()
  if (error || !data) return null
  return {
    notifySalon: data.notify_salon_on_new_booking,
    contactEmail: data.contact_email,
  }
}
