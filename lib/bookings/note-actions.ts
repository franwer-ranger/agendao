'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentSalon } from '@/lib/salon'
import { createAdminClient } from '@/lib/supabase/admin'

export type NoteActionResult = { ok: true } | { ok: false; message: string }

const MAX_NOTE_LENGTH = 500

export async function updateBookingInternalNoteAction(input: {
  bookingId: number
  internalNote: string
}): Promise<NoteActionResult> {
  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const trimmed = input.internalNote.trim()
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      message: `La nota no puede superar ${MAX_NOTE_LENGTH} caracteres.`,
    }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ internal_note: trimmed === '' ? null : trimmed })
    .eq('id', input.bookingId)
    .eq('salon_id', salon.id)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin/calendar')
  revalidatePath('/admin/today')
  return { ok: true }
}
