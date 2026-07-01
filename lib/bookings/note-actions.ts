'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { bookings } from '@/lib/db/schema'
import { getCurrentSalon } from '@/lib/salon'

export type NoteActionResult = { ok: true } | { ok: false; message: string }

const MAX_NOTE_LENGTH = 500

export async function updateBookingInternalNoteAction(input: {
  bookingId: number
  internalNote: string
}): Promise<NoteActionResult> {
  const salon = await getCurrentSalon()

  const trimmed = input.internalNote.trim()
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      message: `La nota no puede superar ${MAX_NOTE_LENGTH} caracteres.`,
    }
  }

  try {
    await db.update(bookings)
      .set({ internal_note: trimmed === '' ? null : trimmed })
      .where(
        and(eq(bookings.id, input.bookingId), eq(bookings.salon_id, salon.id)),
      )
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath('/admin/calendar')
  revalidatePath('/admin/today')
  return { ok: true }
}
