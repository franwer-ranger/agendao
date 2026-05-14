'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { mapBookingError } from '@/lib/availability/errors'
import { emitBookingRescheduledEmails } from '@/lib/email/triggers/on-booking-rescheduled'
import { getCurrentSalon } from '@/lib/salon'
import { createAdminClient } from '@/lib/supabase/admin'

export type MoveBookingResult =
  | { ok: true; previousStartsAt: string; newStartsAt: string }
  | { ok: false; code: string; message: string }

// Mueve la (única) tarjeta de calendario asociada a un booking: actualiza
// `booking_items.starts_at/ends_at` (y opcionalmente `employee_id`).
// La duración se mantiene — tomamos `ends_at - starts_at` del item actual.
// El trigger SQL recomputa `bookings.starts_at/ends_at` desde los items.
//
// La validación dura (overlap, fuera de horario, ausencia, descanso, cierre,
// capacidad) la hace Postgres vía triggers + EXCLUDE. Mapeamos los códigos
// con `mapBookingError` igual que `validateAndCreateBooking`.
export async function moveBookingAction(input: {
  bookingId: number
  newStartsAt: string // ISO UTC
  newEmployeeId?: number
  notifyClient?: boolean
}): Promise<MoveBookingResult> {
  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  // Solo movemos reservas activas; las terminales no se reabren.
  const { data: item, error: itemErr } = await supabase
    .from('booking_items')
    .select('id, booking_id, employee_id, starts_at, ends_at, booking_status')
    .eq('salon_id', salon.id)
    .eq('booking_id', input.bookingId)
    .eq('position', 0)
    .maybeSingle()
  if (itemErr) return { ok: false, code: 'UNKNOWN', message: itemErr.message }
  if (!item) {
    return { ok: false, code: 'UNKNOWN', message: 'Reserva no encontrada.' }
  }
  if (
    !['pending', 'confirmed', 'in_progress'].includes(
      item.booking_status as string,
    )
  ) {
    return {
      ok: false,
      code: 'INVALID_STATE',
      message: 'No se puede mover una reserva cerrada.',
    }
  }

  const durationMs =
    new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()
  const previousStartsAt = item.starts_at as string
  const newStarts = new Date(input.newStartsAt)
  const newEnds = new Date(newStarts.getTime() + durationMs)

  const patch: Record<string, unknown> = {
    starts_at: newStarts.toISOString(),
    ends_at: newEnds.toISOString(),
  }
  if (input.newEmployeeId && input.newEmployeeId !== item.employee_id) {
    patch.employee_id = input.newEmployeeId
  }

  const { error: updErr } = await supabase
    .from('booking_items')
    .update(patch)
    .eq('id', item.id)
    .eq('salon_id', salon.id)

  if (updErr) {
    const mapped = mapBookingError(updErr)
    return { ok: false, code: mapped.code, message: mapped.message }
  }

  if (input.notifyClient) {
    after(async () => {
      await emitBookingRescheduledEmails(input.bookingId, previousStartsAt)
    })
  }

  revalidatePath('/admin/calendar')
  return {
    ok: true,
    previousStartsAt,
    newStartsAt: newStarts.toISOString(),
  }
}
