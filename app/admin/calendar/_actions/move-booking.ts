'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { and, eq, max, min } from 'drizzle-orm'

import { db } from '@/lib/db'
import { booking_items, bookings } from '@/lib/db/schema'
import {
  BookingValidationError,
  mapBookingError,
} from '@/lib/availability/errors'
import { validateBookingItemInterval } from '@/lib/availability/booking'
import { emitBookingRescheduledEmails } from '@/lib/email/triggers/on-booking-rescheduled'
import { getCurrentSalon } from '@/lib/salon'

export type MoveBookingResult =
  | { ok: true; previousStartsAt: string; newStartsAt: string }
  | { ok: false; code: string; message: string }

const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
] as const

// Mueve la (única) tarjeta de calendario asociada a un booking: actualiza
// `booking_items.starts_at/ends_at` (y opcionalmente `employee_id`).
// La duración se mantiene — tomamos `ends_at - starts_at` del item actual.
// Tras el UPDATE recomputamos `bookings.starts_at/ends_at` (replica del
// trigger `bookings_recompute_window`).
//
// La validación (overlap, fuera de horario, ausencia, descanso, cierre,
// capacidad) la hace `validateBookingItemInterval` en TS. Como es una
// reescritura admin, no aplicamos la ventana TOO_CLOSE_TO_NOW.
export async function moveBookingAction(input: {
  bookingId: number
  newStartsAt: string // ISO UTC
  newEmployeeId?: number
  notifyClient?: boolean
}): Promise<MoveBookingResult> {
  const salon = await getCurrentSalon()

  let previousStartsAt: string
  let newStartsIso: string

  try {
    const out = db.transaction((tx) => {
      const item = tx
        .select({
          id: booking_items.id,
          booking_id: booking_items.booking_id,
          employee_id: booking_items.employee_id,
          service_id: booking_items.service_id,
          starts_at: booking_items.starts_at,
          ends_at: booking_items.ends_at,
          booking_status: booking_items.booking_status,
        })
        .from(booking_items)
        .where(
          and(
            eq(booking_items.salon_id, salon.id),
            eq(booking_items.booking_id, input.bookingId),
            eq(booking_items.position, 0),
          ),
        )
        .get()
      if (!item) {
        throw new BookingValidationError('UNKNOWN', 'Reserva no encontrada.')
      }
      if (!ACTIVE_BOOKING_STATUSES.includes(item.booking_status as never)) {
        throw new BookingValidationError(
          'UNKNOWN',
          'No se puede mover una reserva cerrada.',
        )
      }

      const durationMs = item.ends_at.getTime() - item.starts_at.getTime()
      const newStarts = new Date(input.newStartsAt)
      const newEnds = new Date(newStarts.getTime() + durationMs)
      const targetEmployeeId = input.newEmployeeId ?? item.employee_id

      previousStartsAt = item.starts_at.toISOString()
      newStartsIso = newStarts.toISOString()

      validateBookingItemInterval(tx, {
        salonId: salon.id,
        serviceId: item.service_id,
        employeeId: targetEmployeeId,
        startsAt: newStarts,
        endsAt: newEnds,
        source: 'admin',
        excludeItemId: item.id,
      })

      tx.update(booking_items)
        .set({
          starts_at: newStarts,
          ends_at: newEnds,
          employee_id: targetEmployeeId,
        })
        .where(eq(booking_items.id, item.id))
        .run()

      // Replica del trigger `bookings_recompute_window`: window del booking
      // = MIN/MAX de sus items.
      const windowRows = tx
        .select({
          min_starts: min(booking_items.starts_at),
          max_ends: max(booking_items.ends_at),
        })
        .from(booking_items)
        .where(eq(booking_items.booking_id, input.bookingId))
        .all()
      const win = windowRows[0]
      if (win?.min_starts && win.max_ends) {
        tx.update(bookings)
          .set({ starts_at: win.min_starts, ends_at: win.max_ends })
          .where(eq(bookings.id, input.bookingId))
          .run()
      }

      return { ok: true as const }
    })

    if (!out.ok) {
      // Inalcanzable: solo lanzamos errores arriba.
      return { ok: false, code: 'UNKNOWN', message: 'Error desconocido.' }
    }
  } catch (e) {
    const mapped = mapBookingError(e)
    return { ok: false, code: mapped.code, message: mapped.message }
  }

  if (input.notifyClient) {
    after(async () => {
      await emitBookingRescheduledEmails(input.bookingId, previousStartsAt!)
    })
  }

  revalidatePath('/admin/calendar')
  return {
    ok: true,
    previousStartsAt: previousStartsAt!,
    newStartsAt: newStartsIso!,
  }
}

