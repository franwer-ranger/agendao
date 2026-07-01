import 'server-only'
import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { booking_items, bookings, clients, employees } from '@/lib/db/schema'

export type PublicBookingSummary = {
  publicId: string
  startsAt: string
  endsAt: string
  status: string
  clientHasEmail: boolean
  serviceName: string
  durationMinutes: number
  priceCents: number
  employeeName: string
}

// Resuelve una reserva por (salonId, publicId) para la pantalla pública de
// confirmación. Filtra siempre por salonId aunque publicId sea único globalmente:
// así un publicId de otro salón no se cruza con el slug equivocado en la URL.
export async function getPublicBookingByPublicId({
  salonId,
  publicId,
}: {
  salonId: number
  publicId: string
}): Promise<PublicBookingSummary | null> {
  const booking = (
    await db
      .select({
        id: bookings.id,
        public_id: bookings.public_id,
        starts_at: bookings.starts_at,
        ends_at: bookings.ends_at,
        status: bookings.status,
        client_email: clients.email,
      })
      .from(bookings)
      .innerJoin(clients, eq(clients.id, bookings.client_id))
      .where(
        and(eq(bookings.salon_id, salonId), eq(bookings.public_id, publicId)),
      )
      .limit(1)
  )[0]
  if (!booking) return null

  const item = (
    await db
      .select({
        position: booking_items.position,
        service_snapshot: booking_items.service_snapshot,
        employee_name: employees.display_name,
      })
      .from(booking_items)
      .innerJoin(employees, eq(employees.id, booking_items.employee_id))
      .where(eq(booking_items.booking_id, booking.id))
      .orderBy(asc(booking_items.position))
      .limit(1)
  )[0]
  if (!item) return null

  const snapshot = item.service_snapshot as {
    name?: string
    duration_minutes?: number
    price_cents?: number
  }

  return {
    publicId: booking.public_id,
    startsAt: booking.starts_at.toISOString(),
    endsAt: booking.ends_at.toISOString(),
    status: booking.status,
    clientHasEmail: !!booking.client_email,
    serviceName: snapshot.name ?? 'Servicio',
    durationMinutes: snapshot.duration_minutes ?? 0,
    priceCents: snapshot.price_cents ?? 0,
    employeeName: item.employee_name,
  }
}
