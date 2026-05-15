import { createAdminClient } from '@/lib/supabase/admin'
import { parseTstzRange } from '@/lib/availability/intervals'
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
// históricos) cuya ventana solape `[from, to)`. Incluimos los estados
// terminales (completed / cancelled_* / no_show) para poder enseñar el
// histórico del día — la UI los pinta atenuados.
export async function listBookingsInRange({
  salonId,
  rangeStartUtc,
  rangeEndUtc,
}: {
  salonId: number
  rangeStartUtc: Date
  rangeEndUtc: Date
}): Promise<CalendarBookingItem[]> {
  const supabase = createAdminClient()
  const rangeLiteral = `[${rangeStartUtc.toISOString()},${rangeEndUtc.toISOString()})`

  const { data, error } = await supabase
    .from('booking_items')
    .select(
      `
        id,
        booking_id,
        position,
        employee_id,
        service_id,
        starts_at,
        ends_at,
        booking_status,
        services!inner(name),
        bookings!inner(
          public_id,
          internal_note,
          clients!inner(id, display_name, phone, email)
        )
      `,
    )
    .eq('salon_id', salonId)
    .overlaps('during', rangeLiteral)
    .order('starts_at', { ascending: true })

  if (error) throw error

  type Row = {
    id: number
    booking_id: number
    position: number
    employee_id: number
    service_id: number
    starts_at: string
    ends_at: string
    booking_status: string
    services: { name: string } | { name: string }[] | null
    bookings:
      | {
          public_id: string
          internal_note: string | null
          clients:
            | {
                id: number
                display_name: string
                phone: string | null
                email: string | null
              }
            | {
                id: number
                display_name: string
                phone: string | null
                email: string | null
              }[]
            | null
        }
      | null
  }

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const service = Array.isArray(row.services) ? row.services[0] : row.services
    const booking = row.bookings
    const client = booking
      ? Array.isArray(booking.clients)
        ? booking.clients[0]
        : booking.clients
      : null
    return {
      itemId: row.id,
      bookingId: row.booking_id,
      publicId: booking?.public_id ?? '',
      position: row.position,
      employeeId: row.employee_id,
      serviceId: row.service_id,
      serviceName: service?.name ?? '—',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.booking_status as BookingStatus,
      clientName: client?.display_name ?? '—',
      clientPhone: client?.phone ?? null,
      clientEmail: client?.email ?? null,
      clientId: client?.id ?? 0,
      internalNote: booking?.internal_note ?? null,
    }
  })
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
  const supabase = createAdminClient()
  const rangeLiteral = `[${rangeStartUtc.toISOString()},${rangeEndUtc.toISOString()})`

  const { data, error } = await supabase
    .from('employee_time_off')
    .select('id, employee_id, during, reason, note')
    .in('employee_id', employeeIds)
    .overlaps('during', rangeLiteral)

  if (error) throw error

  const out: CalendarBlock[] = []
  for (const r of data ?? []) {
    const range = parseTstzRange(String(r.during))
    if (!range) continue
    out.push({
      id: r.id,
      employeeId: r.employee_id,
      startsAt: range.starts_at,
      endsAt: range.ends_at,
      reason: r.reason,
      note: r.note,
    })
  }
  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return out
}
