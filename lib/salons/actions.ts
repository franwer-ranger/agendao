'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, gt, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import { salon_closures, salon_working_hours, salons } from '@/lib/db/schema'
import { getCurrentSalon } from '@/lib/salon'
import {
  parseBookingsFormData,
  parseCancellationFormData,
  parseClosureCreateFormData,
  parseIdentityFormData,
  parseLegalFormData,
  parseWorkingHoursFormData,
  validateLogoFile,
} from '@/lib/salons/schema'
import { deleteSalonLogo, uploadSalonLogo } from '@/lib/salons/storage'
import { addDaysIsoLocal, salonDateToUtc } from '@/lib/time'

export type ActionState = {
  ok: boolean
  message?: string
  errors?: Record<string, string[]>
}

const REVALIDATE_PATH = '/admin/salon'

// ─── Identidad (datos del salón + logo) ────────────────────────────────────

export async function updateIdentityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseIdentityFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  // Estado actual para saber el logo_path previo (lo borraremos si procede).
  const current = db
    .select({ logo_path: salons.logo_path })
    .from(salons)
    .where(eq(salons.id, salon.id))
    .get()
  const previousLogoPath = current?.logo_path ?? null

  // Logo nuevo (si lo hay). Sigue usando Supabase Storage en M2; se reemplaza en M3.
  let nextLogoPath: string | null = previousLogoPath
  const logoFile = formData.get('logo')
  if (logoFile instanceof File && logoFile.size > 0) {
    const fileErr = validateLogoFile(logoFile)
    if (fileErr) {
      return { ok: false, errors: { logo: [fileErr] } }
    }
    try {
      nextLogoPath = await uploadSalonLogo(salon.id, logoFile)
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
  } else if (parsed.data.remove_logo) {
    nextLogoPath = null
  }

  try {
    db.update(salons)
      .set({
        name: parsed.data.name,
        address: parsed.data.address,
        phone: parsed.data.phone,
        contact_email: parsed.data.contact_email,
        logo_path: nextLogoPath,
      })
      .where(eq(salons.id, salon.id))
      .run()
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  // Limpiar el logo antiguo si lo hemos reemplazado o eliminado.
  if (previousLogoPath && previousLogoPath !== nextLogoPath) {
    try {
      await deleteSalonLogo(previousLogoPath)
    } catch {
      // No bloquea el guardado; quedaría un archivo huérfano en el bucket.
    }
  }

  revalidatePath(REVALIDATE_PATH)
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

// ─── Horario semanal (replace-all) ─────────────────────────────────────────

export async function replaceWorkingHoursAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseWorkingHoursFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  // Solo días abiertos (no-fila = cerrado, consistente con la lógica del motor).
  const rows = parsed.data.days
    .filter((d) => !d.closed && d.opens_at && d.closes_at)
    .map((d) => ({
      salon_id: salon.id,
      weekday: d.weekday,
      opens_at: d.opens_at as string,
      closes_at: d.closes_at as string,
    }))

  try {
    db.transaction((tx) => {
      tx.delete(salon_working_hours)
        .where(eq(salon_working_hours.salon_id, salon.id))
        .run()
      if (rows.length > 0) {
        tx.insert(salon_working_hours).values(rows).run()
      }
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { ok: true }
}

// ─── Cierres puntuales del salón ───────────────────────────────────────────

export async function createSalonClosureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseClosureCreateFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  // Día completo en TZ Madrid: [starts_on 00:00, ends_on+1 00:00).
  const startUtc = salonDateToUtc(parsed.data.starts_on)
  const endUtc = salonDateToUtc(addDaysIsoLocal(parsed.data.ends_on, 1))

  try {
    db.transaction((tx) => {
      // Replica del EXCLUDE GIST de Postgres: rechazar si solapa con otro cierre
      // del mismo salón. Overlap half-open: start < otherEnd AND end > otherStart.
      const overlap = tx
        .select({ id: salon_closures.id })
        .from(salon_closures)
        .where(
          and(
            eq(salon_closures.salon_id, salon.id),
            lt(salon_closures.starts_at, endUtc),
            gt(salon_closures.ends_at, startUtc),
          ),
        )
        .limit(1)
        .get()

      if (overlap) {
        throw new Error('Se solapa con otro cierre ya configurado.')
      }

      tx.insert(salon_closures)
        .values({
          salon_id: salon.id,
          starts_at: startUtc,
          ends_at: endUtc,
          label: parsed.data.label,
        })
        .run()
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { ok: true }
}

export async function deleteSalonClosureAction(
  formData: FormData,
): Promise<void> {
  const idRaw = formData.get('id')
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) return

  const salon = await getCurrentSalon()

  db.delete(salon_closures)
    .where(
      and(eq(salon_closures.id, id), eq(salon_closures.salon_id, salon.id)),
    )
    .run()

  revalidatePath(REVALIDATE_PATH)
}

// ─── Reservas (granularidad, antelación min/max) ───────────────────────────

export async function updateBookingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseBookingsFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  try {
    db.update(salons)
      .set({
        slot_granularity_minutes: parsed.data.slot_granularity_minutes,
        booking_min_hours_ahead: parsed.data.booking_min_hours_ahead,
        booking_max_days_ahead: parsed.data.booking_max_days_ahead,
      })
      .where(eq(salons.id, salon.id))
      .run()
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { ok: true }
}

// ─── Política de cancelación ───────────────────────────────────────────────

export async function updateCancellationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseCancellationFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  try {
    db.update(salons)
      .set({
        cancellation_min_hours: parsed.data.cancellation_min_hours,
        cancellation_policy_text: parsed.data.cancellation_policy_text,
      })
      .where(eq(salons.id, salon.id))
      .run()
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { ok: true }
}

// ─── Aviso legal ───────────────────────────────────────────────────────────

export async function updateLegalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseLegalFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  try {
    db.update(salons)
      .set({ terms_text: parsed.data.terms_text })
      .where(eq(salons.id, salon.id))
      .run()
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { ok: true }
}
