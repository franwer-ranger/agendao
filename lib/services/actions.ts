'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentSalon } from '@/lib/salon'
import { parseServiceFormData } from '@/lib/services/schema'
import { resolveUniqueServiceSlug } from '@/lib/services/slug'

export type ActionState = {
  ok: boolean
  message?: string
  errors?: Record<string, string[]>
}

async function syncEmployeeAssignments(
  serviceId: number,
  salonId: number,
  desiredEmployeeIds: number[],
): Promise<void> {
  const supabase = createAdminClient()

  // Validate the IDs all belong to this salon (defense in depth — the form
  // only renders salon employees, but the action is the trust boundary).
  if (desiredEmployeeIds.length > 0) {
    const { data: validRows, error: vErr } = await supabase
      .from('employees')
      .select('id')
      .eq('salon_id', salonId)
      .in('id', desiredEmployeeIds)
    if (vErr) throw vErr
    const validSet = new Set((validRows ?? []).map((r) => r.id))
    desiredEmployeeIds = desiredEmployeeIds.filter((id) => validSet.has(id))
  }

  const { data: existing, error: eErr } = await supabase
    .from('employee_services')
    .select('employee_id')
    .eq('service_id', serviceId)
  if (eErr) throw eErr

  const existingIds = new Set((existing ?? []).map((r) => r.employee_id))
  const desiredSet = new Set(desiredEmployeeIds)

  const toAdd = [...desiredSet].filter((id) => !existingIds.has(id))
  const toRemove = [...existingIds].filter((id) => !desiredSet.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('employee_services')
      .delete()
      .eq('service_id', serviceId)
      .in('employee_id', toRemove)
    if (error) throw error
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from('employee_services').insert(
      toAdd.map((employee_id) => ({ employee_id, service_id: serviceId })),
    )
    if (error) throw error
  }
}

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseServiceFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()
  const slug = await resolveUniqueServiceSlug(supabase, salon.id, parsed.data.name)

  const { data: created, error } = await supabase
    .from('services')
    .insert({
      salon_id: salon.id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      duration_minutes: parsed.data.duration_minutes,
      price_cents: parsed.data.price_cents,
      max_concurrent: parsed.data.max_concurrent,
      is_active: parsed.data.is_active,
    })
    .select('id')
    .single()

  if (error || !created) {
    return { ok: false, message: error?.message ?? 'No se pudo crear el servicio' }
  }

  await syncEmployeeAssignments(created.id, salon.id, parsed.data.employee_ids)

  revalidatePath('/admin/services')
  redirect('/admin/services')
}

export async function updateServiceAction(
  serviceId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseServiceFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const { data: current, error: fetchErr } = await supabase
    .from('services')
    .select('id, name, slug')
    .eq('id', serviceId)
    .eq('salon_id', salon.id)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!current) return { ok: false, message: 'Servicio no encontrado' }

  const slug =
    current.name === parsed.data.name
      ? current.slug
      : await resolveUniqueServiceSlug(supabase, salon.id, parsed.data.name, serviceId)

  const { error: updErr } = await supabase
    .from('services')
    .update({
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      duration_minutes: parsed.data.duration_minutes,
      price_cents: parsed.data.price_cents,
      max_concurrent: parsed.data.max_concurrent,
      is_active: parsed.data.is_active,
    })
    .eq('id', serviceId)
    .eq('salon_id', salon.id)

  if (updErr) {
    return { ok: false, message: updErr.message }
  }

  await syncEmployeeAssignments(serviceId, salon.id, parsed.data.employee_ids)

  revalidatePath('/admin/services')
  redirect('/admin/services')
}

export async function setServiceActiveAction(formData: FormData): Promise<void> {
  const idRaw = formData.get('id')
  const activeRaw = formData.get('active')
  const id = Number(idRaw)
  const active = activeRaw === 'true'
  if (!Number.isFinite(id) || id <= 0) return

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('services')
    .update({ is_active: active })
    .eq('id', id)
    .eq('salon_id', salon.id)

  if (error) throw error
  revalidatePath('/admin/services')
}
