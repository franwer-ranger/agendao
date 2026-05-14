'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
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
  const supabase = createAdminClient()

  // Estado actual para saber el logo_path previo (lo borraremos si procede).
  const { data: current, error: fetchErr } = await supabase
    .from('salons')
    .select('logo_path')
    .eq('id', salon.id)
    .maybeSingle()
  if (fetchErr) return { ok: false, message: fetchErr.message }
  const previousLogoPath = (current?.logo_path as string | null) ?? null

  // Logo nuevo (si lo hay).
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

  const { error: updErr } = await supabase
    .from('salons')
    .update({
      name: parsed.data.name,
      address: parsed.data.address,
      phone: parsed.data.phone,
      contact_email: parsed.data.contact_email,
      logo_path: nextLogoPath,
    })
    .eq('id', salon.id)

  if (updErr) return { ok: false, message: updErr.message }

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
  const supabase = createAdminClient()

  // Borrar todas las filas existentes para este salón.
  const { error: delErr } = await supabase
    .from('salon_working_hours')
    .delete()
    .eq('salon_id', salon.id)
  if (delErr) return { ok: false, message: delErr.message }

  // Insertar solo días abiertos (no-fila = cerrado, consistente con el trigger).
  const rows = parsed.data.days
    .filter((d) => !d.closed && d.opens_at && d.closes_at)
    .map((d) => ({
      salon_id: salon.id,
      weekday: d.weekday,
      opens_at: d.opens_at,
      closes_at: d.closes_at,
    }))

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from('salon_working_hours')
      .insert(rows)
    if (insErr) return { ok: false, message: insErr.message }
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
  const supabase = createAdminClient()

  // Día completo en TZ Madrid: [starts_on 00:00, ends_on+1 00:00).
  const startUtc = salonDateToUtc(parsed.data.starts_on)
  const endUtc = salonDateToUtc(addDaysIsoLocal(parsed.data.ends_on, 1))
  const startIso = startUtc.toISOString()
  const endIso = endUtc.toISOString()

  const { error: insErr } = await supabase.from('salon_closures').insert({
    salon_id: salon.id,
    during: `[${startIso},${endIso})`,
    label: parsed.data.label,
  })

  if (insErr) {
    // El EXCLUDE GIST de la BD impide solapamientos. Mostramos un mensaje legible.
    const msg = /exclusion|overlap|conflict/i.test(insErr.message)
      ? 'Se solapa con otro cierre ya configurado.'
      : insErr.message
    return { ok: false, message: msg }
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
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('salon_closures')
    .delete()
    .eq('id', id)
    .eq('salon_id', salon.id)

  if (error) throw error
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
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('salons')
    .update({
      slot_granularity_minutes: parsed.data.slot_granularity_minutes,
      booking_min_hours_ahead: parsed.data.booking_min_hours_ahead,
      booking_max_days_ahead: parsed.data.booking_max_days_ahead,
    })
    .eq('id', salon.id)

  if (error) return { ok: false, message: error.message }
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
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('salons')
    .update({
      cancellation_min_hours: parsed.data.cancellation_min_hours,
      cancellation_policy_text: parsed.data.cancellation_policy_text,
    })
    .eq('id', salon.id)

  if (error) return { ok: false, message: error.message }
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
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('salons')
    .update({ terms_text: parsed.data.terms_text })
    .eq('id', salon.id)

  if (error) return { ok: false, message: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { ok: true }
}
