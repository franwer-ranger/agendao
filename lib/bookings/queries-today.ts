import { and, asc, eq, gt, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  booking_items,
  bookings,
  clients,
  employees,
  services,
} from '@/lib/db/schema'
import type { BookingStatus } from '@/lib/bookings/status'

// Card del panel "Hoy". Una `booking_items` (position 0 o encadenadas) se
// renderiza como una tarjeta en la lista cronológica. Si una reserva tiene
// varios items (servicios encadenados) cada item es una tarjeta — coherente
// con cómo lo pinta el calendario.
export type TodayBookingItem = {
  itemId: number
  bookingId: number
  publicId: string
  position: number
  serviceName: string
  startsAt: string // ISO UTC
  endsAt: string
  status: BookingStatus
  employeeId: number
  employeeName: string
  employeeColorHex: string | null
  clientId: number
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  internalNote: string | null
}

// Devuelve los items que solapan con `[rangeStartUtc, rangeEndUtc)`,
// ordenados cronológicamente. Incluye estados terminales para que la UI
// pueda enseñar el día completo con un toggle "ver todas".
export async function listTodaysBookings({
  salonId,
  rangeStartUtc,
  rangeEndUtc,
}: {
  salonId: number
  rangeStartUtc: Date
  rangeEndUtc: Date
}): Promise<TodayBookingItem[]> {
  const rows = await db
    .select({
      id: booking_items.id,
      booking_id: booking_items.booking_id,
      position: booking_items.position,
      employee_id: booking_items.employee_id,
      starts_at: booking_items.starts_at,
      ends_at: booking_items.ends_at,
      booking_status: booking_items.booking_status,
      service_name: services.name,
      employee_name: employees.display_name,
      employee_color_hex: employees.color_hex,
      public_id: bookings.public_id,
      internal_note: bookings.internal_note,
      client_id: clients.id,
      client_name: clients.display_name,
      client_phone: clients.phone,
      client_email: clients.email,
    })
    .from(booking_items)
    .innerJoin(services, eq(services.id, booking_items.service_id))
    .innerJoin(employees, eq(employees.id, booking_items.employee_id))
    .innerJoin(bookings, eq(bookings.id, booking_items.booking_id))
    .innerJoin(clients, eq(clients.id, bookings.client_id))
    .where(
      and(
        eq(booking_items.salon_id, salonId),
        lt(booking_items.starts_at, rangeEndUtc),
        gt(booking_items.ends_at, rangeStartUtc),
      ),
    )
    .orderBy(asc(booking_items.starts_at))

  return rows.map((r) => ({
    itemId: r.id,
    bookingId: r.booking_id,
    publicId: r.public_id,
    position: r.position,
    serviceName: r.service_name,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    status: r.booking_status as BookingStatus,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    employeeColorHex: r.employee_color_hex,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    clientEmail: r.client_email,
    internalNote: r.internal_note,
  }))
}
