import { createAdminClient } from '@/lib/supabase/admin'
import 'server-only'
import { mapBookingError, type BookingErrorCode } from './errors'

export type CreateBookingInput = {
  salonId: number
  serviceId: number
  employeeId: number
  clientId: number
  // Instante UTC del inicio del servicio.
  startsAt: string
  source?: 'web' | 'admin' | 'phone' | 'walk_in'
  clientNote?: string | null
  idempotencyKey?: string | null
}

export type CreateBookingResult =
  | { ok: true; bookingId: number; publicId: string }
  | { ok: false; code: BookingErrorCode; message: string }

// Crea reserva + booking_item dentro de una "transacción" en dos pasos:
// 1) INSERT bookings
// 2) INSERT booking_items — aquí disparan triggers y EXCLUDE; si falla, borramos
//    el booking padre para no dejar huérfanos sin items.
//
// La atomicidad real (sin TOCTOU) la da Postgres con los triggers + advisory
// lock + EXCLUDE. Esta función solo INSERTA y mapea errores a códigos claros.
export async function validateAndCreateBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const supabase = createAdminClient()

  // Necesitamos duration + snapshot del servicio. Una sola query.
  const { data: svc, error: svcErr } = await supabase
    .from('services')
    .select('id, salon_id, name, duration_minutes, price_cents, color_hex')
    .eq('id', input.serviceId)
    .eq('salon_id', input.salonId)
    .maybeSingle()
  if (svcErr) return { ok: false, code: 'UNKNOWN', message: svcErr.message }
  if (!svc) {
    return {
      ok: false,
      code: 'SALON_MISMATCH',
      message: 'Servicio no encontrado en este salón.',
    }
  }

  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60_000)

  // 1) Insertar el booking padre.
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      salon_id: input.salonId,
      client_id: input.clientId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'pending',
      source: input.source ?? 'web',
      client_note: input.clientNote ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id, public_id')
    .single()

  if (bookingErr) return { ok: false, ...mapBookingError(bookingErr) }
  if (!booking) {
    return {
      ok: false,
      code: 'UNKNOWN',
      message: 'No se pudo crear la reserva.',
    }
  }

  // 2) Insertar el booking_item — aquí saltan los triggers de validación
  //    y la EXCLUDE constraint.
  const snapshot = {
    name: svc.name,
    duration_minutes: svc.duration_minutes,
    price_cents: svc.price_cents,
    color_hex: svc.color_hex,
  }

  const { error: itemErr } = await supabase.from('booking_items').insert({
    booking_id: booking.id,
    salon_id: input.salonId,
    position: 0,
    service_id: input.serviceId,
    employee_id: input.employeeId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    service_snapshot: snapshot,
    booking_status: 'pending',
  })

  if (itemErr) {
    // Compensar: borrar el booking padre para no dejar reservas sin items.
    await supabase.from('bookings').delete().eq('id', booking.id)
    return { ok: false, ...mapBookingError(itemErr) }
  }

  return { ok: true, bookingId: booking.id, publicId: booking.public_id }
}
