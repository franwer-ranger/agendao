'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentSalon } from '@/lib/salon'
import { createAdminClient } from '@/lib/supabase/admin'

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled_client'
  | 'cancelled_salon'
  | 'no_show'

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

function isTransitionAllowed(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export async function setBookingStatusAction(input: {
  bookingId: number
  toStatus: BookingStatus
  reason?: string
}): Promise<StatusActionResult> {
  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const { data: current, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', input.bookingId)
    .eq('salon_id', salon.id)
    .maybeSingle()
  if (fetchErr) return { ok: false, message: fetchErr.message }
  if (!current) return { ok: false, message: 'Reserva no encontrada.' }

  const from = current.status as BookingStatus
  if (from === input.toStatus) return { ok: true }

  if (!isTransitionAllowed(from, input.toStatus)) {
    return {
      ok: false,
      message: `Transición no permitida: ${from} → ${input.toStatus}.`,
    }
  }

  // Campos derivados según el destino. Los triggers SQL ya propagan
  // `status` a `booking_items` y dejan rastro en `booking_status_events`.
  const patch: Record<string, unknown> = { status: input.toStatus }
  if (input.toStatus === 'confirmed' && from === 'pending') {
    patch.confirmed_at = new Date().toISOString()
  }
  if (input.toStatus === 'cancelled_salon') {
    patch.cancelled_at = new Date().toISOString()
    patch.cancellation_reason = input.reason ?? null
  }

  const { error: updErr } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', input.bookingId)
    .eq('salon_id', salon.id)

  if (updErr) return { ok: false, message: updErr.message }

  revalidatePath('/admin/calendar')
  return { ok: true }
}
