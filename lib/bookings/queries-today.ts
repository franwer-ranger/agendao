import type { BookingStatus } from '@/lib/bookings/status'
import { createAdminClient } from '@/lib/supabase/admin'

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
        starts_at,
        ends_at,
        booking_status,
        services!inner(name),
        employees!inner(display_name, color_hex),
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
    starts_at: string
    ends_at: string
    booking_status: string
    services: { name: string } | { name: string }[] | null
    employees:
      | { display_name: string; color_hex: string | null }
      | { display_name: string; color_hex: string | null }[]
      | null
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
    const employee = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees
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
      serviceName: service?.name ?? '—',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.booking_status as BookingStatus,
      employeeId: row.employee_id,
      employeeName: employee?.display_name ?? '—',
      employeeColorHex: employee?.color_hex ?? null,
      clientId: client?.id ?? 0,
      clientName: client?.display_name ?? '—',
      clientPhone: client?.phone ?? null,
      clientEmail: client?.email ?? null,
      internalNote: booking?.internal_note ?? null,
    }
  })
}
