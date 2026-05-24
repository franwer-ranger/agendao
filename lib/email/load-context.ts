import 'server-only'
import { asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  booking_items,
  bookings,
  clients,
  employees,
  salons,
} from '@/lib/db/schema'
import { getLogoPublicUrl } from '@/lib/salons/queries'
import type { BookingEmailContext } from './types'

// Carga todo lo que necesita una plantilla a partir del id interno de reserva.
// Una sola función: las plantillas son consistentes entre eventos (creación,
// recordatorio, cancelación), así que el view-model es el mismo.
export async function loadBookingEmailContext(
  bookingId: number,
): Promise<BookingEmailContext | null> {
  const head = db
    .select({
      booking_id: bookings.id,
      booking_public_id: bookings.public_id,
      booking_starts_at: bookings.starts_at,
      booking_ends_at: bookings.ends_at,
      salon_id: salons.id,
      salon_name: salons.name,
      salon_timezone: salons.timezone,
      salon_address: salons.address,
      salon_phone: salons.phone,
      salon_contact_email: salons.contact_email,
      salon_logo_path: salons.logo_path,
      salon_cancellation_min_hours: salons.cancellation_min_hours,
      salon_cancellation_policy_text: salons.cancellation_policy_text,
      client_display_name: clients.display_name,
      client_email: clients.email,
    })
    .from(bookings)
    .innerJoin(clients, eq(clients.id, bookings.client_id))
    .innerJoin(salons, eq(salons.id, bookings.salon_id))
    .where(eq(bookings.id, bookingId))
    .get()
  if (!head) return null

  const itemRows = db
    .select({
      position: booking_items.position,
      service_snapshot: booking_items.service_snapshot,
      employee_name: employees.display_name,
    })
    .from(booking_items)
    .innerJoin(employees, eq(employees.id, booking_items.employee_id))
    .where(eq(booking_items.booking_id, bookingId))
    .orderBy(asc(booking_items.position))
    .all()

  const items = itemRows.map((it) => {
    const snap = it.service_snapshot as {
      name?: string
      duration_minutes?: number
      price_cents?: number
    }
    return {
      serviceName: snap.name ?? '',
      employeeName: it.employee_name,
      durationMinutes: snap.duration_minutes ?? 0,
      priceCents: snap.price_cents ?? 0,
    }
  })

  const totalCents = items.reduce((acc, i) => acc + i.priceCents, 0)

  return {
    salon: {
      id: head.salon_id,
      name: head.salon_name,
      timezone: head.salon_timezone,
      address: head.salon_address,
      phone: head.salon_phone,
      contactEmail: head.salon_contact_email,
      logoUrl: getLogoPublicUrl(head.salon_logo_path),
      cancellationMinHours: head.salon_cancellation_min_hours,
      cancellationPolicyText: head.salon_cancellation_policy_text,
    },
    client: {
      displayName: head.client_display_name,
      email: head.client_email ?? '',
    },
    booking: {
      publicId: head.booking_public_id,
      startsAt: head.booking_starts_at.toISOString(),
      endsAt: head.booking_ends_at.toISOString(),
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
  const row = db
    .select({
      notifySalon: salons.notify_salon_on_new_booking,
      contactEmail: salons.contact_email,
    })
    .from(salons)
    .where(eq(salons.id, salonId))
    .get()
  return row ?? null
}
