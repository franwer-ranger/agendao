'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { withTenant } from '@/lib/db/tenant'
import { booking_items, booking_status_events, bookings } from '@/lib/db/schema'
import type { BookingStatus } from '@/lib/bookings/status'
import { getCurrentSalon } from '@/lib/salon'

export type StatusActionResult = { ok: true } | { ok: false; message: string }

// Transiciones permitidas desde el dashboard admin.
// Coherente con bloque 8 del PLAN.md. `cancelled_client` no es accesible
// desde aquí — eso lo provoca el enlace mágico del cliente.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled_salon'],
  confirmed: ['in_progress', 'completed', 'no_show', 'cancelled_salon'],
  in_progress: ['completed', 'no_show'],
  completed: [],
  cancelled_client: [],
  cancelled_salon: [],
  no_show: [],
}

function isTransitionAllowed(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export async function setBookingStatusAction(input: {
  bookingId: number
  toStatus: BookingStatus
  reason?: string
}): Promise<StatusActionResult> {
  const salon = await getCurrentSalon()

  try {
    const handled = await withTenant(salon.id, async (tx) => {
      const current = (
        await tx
          .select({ id: bookings.id, status: bookings.status })
          .from(bookings)
          .where(
            and(
              eq(bookings.id, input.bookingId),
              eq(bookings.salon_id, salon.id),
            ),
          )
          .limit(1)
      )[0]
      if (!current) {
        return { ok: false as const, message: 'Reserva no encontrada.' }
      }

      const from = current.status as BookingStatus
      if (from === input.toStatus) return { ok: true as const }

      if (!isTransitionAllowed(from, input.toStatus)) {
        return {
          ok: false as const,
          message: `Transición no permitida: ${from} → ${input.toStatus}.`,
        }
      }

      // Campos derivados según el destino.
      const patch: {
        status: BookingStatus
        confirmed_at?: Date
        cancelled_at?: Date
        cancellation_reason?: string | null
      } = { status: input.toStatus }
      if (input.toStatus === 'confirmed' && from === 'pending') {
        patch.confirmed_at = new Date()
      }
      if (input.toStatus === 'cancelled_salon') {
        patch.cancelled_at = new Date()
        patch.cancellation_reason = input.reason ?? null
      }

      await tx
        .update(bookings)
        .set(patch)
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.salon_id, salon.id),
          ),
        )

      // Replica de `bookings_propagate_status_to_items`: cualquier
      // booking_item con booking_id = ? hereda el nuevo status.
      await tx
        .update(booking_items)
        .set({ booking_status: input.toStatus })
        .where(eq(booking_items.booking_id, input.bookingId))

      // Replica de `bookings_log_status_event`.
      await tx.insert(booking_status_events).values({
        booking_id: input.bookingId,
        salon_id: salon.id,
        from_status: from,
        to_status: input.toStatus,
        actor_type: 'system',
        reason:
          input.toStatus === 'cancelled_salon' ? (input.reason ?? null) : null,
      })

      return { ok: true as const }
    })

    if (handled.ok) revalidatePath('/admin/calendar')
    return handled
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
