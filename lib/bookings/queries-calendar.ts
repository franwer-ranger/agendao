import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  booking_items,
  bookings,
  clients,
  employee_time_off,
  services,
} from '@/lib/db/schema'
import type { BookingStatus } from '@/lib/bookings/status'

// Una "tarjeta" en el calendario corresponde a un `booking_items.position = 0`
// con los datos enriquecidos para pintar. Si una reserva tiene varios items
// (servicios encadenados), cada item es una tarjeta independiente porque cada
// uno puede ir con empleado distinto y se mueve de forma independiente.
export type CalendarBookingItem = {
  itemId: number
  bookingId: number
  publicId: string
  position: number
  employeeId: number
  serviceId: number
  serviceName: string
  startsAt: string // ISO UTC
  endsAt: string
  status: BookingStatus
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  clientId: number
  internalNote: string | null
}

export type CalendarBlock = {
  id: number
  employeeId: number
  startsAt: string
  endsAt: string
  reason: string
  note: string | null
}

// Trae todas las "tarjetas" de calendario (booking_items activos o
// históricos) cuya ventana solape `[rangeStartUtc, rangeEndUtc)`. Incluimos
// los estados terminales (completed / cancelled_* / no_show) para poder
// enseñar el histórico del día — la UI los pinta atenuados.
export async function listBookingsInRange({
  salonId,
  rangeStartUtc,
  rangeEndUtc,
}: {
  salonId: number
  rangeStartUtc: Date
  rangeEndUtc: Date
}): Promise<CalendarBookingItem[]> {
  const rows = db
    .select({
      id: booking_items.id,
      booking_id: booking_items.booking_id,
      position: booking_items.position,
      employee_id: booking_items.employee_id,
      service_id: booking_items.service_id,
      starts_at: booking_items.starts_at,
      ends_at: booking_items.ends_at,
      booking_status: booking_items.booking_status,
      service_name: services.name,
      public_id: bookings.public_id,
      internal_note: bookings.internal_note,
      client_id: clients.id,
      client_name: clients.display_name,
      client_phone: clients.phone,
      client_email: clients.email,
    })
    .from(booking_items)
    .innerJoin(services, eq(services.id, booking_items.service_id))
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
    .all()

  return rows.map((r) => ({
    itemId: r.id,
    bookingId: r.booking_id,
    publicId: r.public_id,
    position: r.position,
    employeeId: r.employee_id,
    serviceId: r.service_id,
    serviceName: r.service_name,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    status: r.booking_status as BookingStatus,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    clientEmail: r.client_email,
    clientId: r.client_id,
    internalNote: r.internal_note,
  }))
}

// Bloqueos = `employee_time_off` que solape la ventana. Sirve tanto para
// vacaciones largas como para los huecos puntuales que admin crea desde el
// calendario (Bloque 6 los reusa: ver plan).
export async function listBlocksInRange({
  employeeIds,
  rangeStartUtc,
  rangeEndUtc,
}: {
  employeeIds: number[]
  rangeStartUtc: Date
  rangeEndUtc: Date
}): Promise<CalendarBlock[]> {
  if (employeeIds.length === 0) return []

  const rows = db
    .select({
      id: employee_time_off.id,
      employee_id: employee_time_off.employee_id,
      starts_at: employee_time_off.starts_at,
      ends_at: employee_time_off.ends_at,
      reason: employee_time_off.reason,
      note: employee_time_off.note,
    })
    .from(employee_time_off)
    .where(
      and(
        inArray(employee_time_off.employee_id, employeeIds),
        lt(employee_time_off.starts_at, rangeEndUtc),
        gt(employee_time_off.ends_at, rangeStartUtc),
      ),
    )
    .all()

  const out: CalendarBlock[] = rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    reason: r.reason,
    note: r.note,
  }))
  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return out
}
