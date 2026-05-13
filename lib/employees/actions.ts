'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentSalon } from '@/lib/salon'
import {
  parseEmployeeFormData,
  parseRecurringBreaksFormData,
  parseTimeOffCreateFormData,
  parseWeeklyScheduleFormData,
} from '@/lib/employees/schema'
import { resolveUniqueEmployeeSlug } from '@/lib/employees/slug'
import { addDaysIsoLocal, madridLocalDateToUtc } from '@/lib/time'

export type ActionState = {
  ok: boolean
  message?: string
  errors?: Record<string, string[]>
}

export type ConflictingBooking = {
  booking_id: number
  starts_at: string
  ends_at: string
  client_name: string
  service_name: string
}

export type TimeOffActionState = ActionState & {
  conflicts?: ConflictingBooking[]
}

// ─── Helpers internos ──────────────────────────────────────────────────────

async function assertEmployeeBelongsToSalon(
  supabase: SupabaseClient,
  employeeId: number,
  salonId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('salon_id', salonId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

// Sincroniza la lista de servicios que el empleado puede realizar.
// Mismo patrón que syncEmployeeAssignments en lib/services/actions.ts, invertido.
async function syncServiceAssignments(
  employeeId: number,
  salonId: number,
  desiredServiceIds: number[],
): Promise<void> {
  const supabase = createAdminClient()

  if (desiredServiceIds.length > 0) {
    const { data: validRows, error: vErr } = await supabase
      .from('services')
      .select('id')
      .eq('salon_id', salonId)
      .in('id', desiredServiceIds)
    if (vErr) throw vErr
    const validSet = new Set((validRows ?? []).map((r) => r.id))
    desiredServiceIds = desiredServiceIds.filter((id) => validSet.has(id))
  }

  const { data: existing, error: eErr } = await supabase
    .from('employee_services')
    .select('service_id')
    .eq('employee_id', employeeId)
  if (eErr) throw eErr

  const existingIds = new Set((existing ?? []).map((r) => r.service_id))
  const desiredSet = new Set(desiredServiceIds)

  const toAdd = [...desiredSet].filter((id) => !existingIds.has(id))
  const toRemove = [...existingIds].filter((id) => !desiredSet.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('employee_services')
      .delete()
      .eq('employee_id', employeeId)
      .in('service_id', toRemove)
    if (error) throw error
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('employee_services')
      .insert(
        toAdd.map((service_id) => ({ employee_id: employeeId, service_id })),
      )
    if (error) throw error
  }
}

// ─── CRUD básico del empleado ──────────────────────────────────────────────

export async function createEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseEmployeeFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()
  const slug = await resolveUniqueEmployeeSlug(
    supabase,
    salon.id,
    parsed.data.display_name,
  )

  const { data: created, error } = await supabase
    .from('employees')
    .insert({
      salon_id: salon.id,
      display_name: parsed.data.display_name,
      slug,
      bio: parsed.data.bio,
      is_active: parsed.data.is_active,
      display_order: parsed.data.display_order,
    })
    .select('id')
    .single()

  if (error || !created) {
    return {
      ok: false,
      message: error?.message ?? 'No se pudo crear el empleado',
    }
  }

  await syncServiceAssignments(created.id, salon.id, parsed.data.service_ids)

  revalidatePath('/admin/employees')
  redirect(`/admin/employees/${created.id}/edit`)
}

export async function updateEmployeeAction(
  employeeId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseEmployeeFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const { data: current, error: fetchErr } = await supabase
    .from('employees')
    .select('id, display_name, slug')
    .eq('id', employeeId)
    .eq('salon_id', salon.id)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!current) return { ok: false, message: 'Empleado no encontrado' }

  const slug =
    current.display_name === parsed.data.display_name
      ? current.slug
      : await resolveUniqueEmployeeSlug(
          supabase,
          salon.id,
          parsed.data.display_name,
          employeeId,
        )

  const { error: updErr } = await supabase
    .from('employees')
    .update({
      display_name: parsed.data.display_name,
      slug,
      bio: parsed.data.bio,
      is_active: parsed.data.is_active,
      display_order: parsed.data.display_order,
    })
    .eq('id', employeeId)
    .eq('salon_id', salon.id)

  if (updErr) {
    return { ok: false, message: updErr.message }
  }

  await syncServiceAssignments(employeeId, salon.id, parsed.data.service_ids)

  revalidatePath('/admin/employees')
  revalidatePath(`/admin/employees/${employeeId}/edit`)
  return { ok: true }
}

export async function setEmployeeActiveAction(
  formData: FormData,
): Promise<void> {
  const idRaw = formData.get('id')
  const activeRaw = formData.get('active')
  const id = Number(idRaw)
  const active = activeRaw === 'true'
  if (!Number.isFinite(id) || id <= 0) return

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('employees')
    .update({ is_active: active })
    .eq('id', id)
    .eq('salon_id', salon.id)

  if (error) throw error
  revalidatePath('/admin/employees')
  revalidatePath(`/admin/employees/${id}/edit`)
}

// ─── Horario semanal: replace-all ──────────────────────────────────────────

export async function updateEmployeeWeeklyScheduleAction(
  employeeId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseWeeklyScheduleFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const ok = await assertEmployeeBelongsToSalon(supabase, employeeId, salon.id)
  if (!ok) return { ok: false, message: 'Empleado no encontrado' }

  // Reemplazo total: borramos las filas "vivas" (effective_until is null) y
  // metemos las nuevas. No tocamos versiones históricas.
  const { error: delErr } = await supabase
    .from('employee_weekly_schedule')
    .delete()
    .eq('employee_id', employeeId)
    .is('effective_until', null)
  if (delErr) return { ok: false, message: delErr.message }

  if (parsed.data.shifts.length > 0) {
    const rows = parsed.data.shifts.map((s) => ({
      employee_id: employeeId,
      weekday: s.weekday,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
    }))
    const { error: insErr } = await supabase
      .from('employee_weekly_schedule')
      .insert(rows)
    if (insErr) return { ok: false, message: insErr.message }
  }

  revalidatePath(`/admin/employees/${employeeId}/edit`)
  return { ok: true }
}

// ─── Descansos recurrentes: replace-all ────────────────────────────────────

export async function updateEmployeeRecurringBreaksAction(
  employeeId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseRecurringBreaksFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const ok = await assertEmployeeBelongsToSalon(supabase, employeeId, salon.id)
  if (!ok) return { ok: false, message: 'Empleado no encontrado' }

  const { error: delErr } = await supabase
    .from('employee_recurring_breaks')
    .delete()
    .eq('employee_id', employeeId)
    .is('effective_until', null)
  if (delErr) return { ok: false, message: delErr.message }

  if (parsed.data.breaks.length > 0) {
    const rows = parsed.data.breaks.map((b) => ({
      employee_id: employeeId,
      weekday: b.weekday,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      label: b.label,
    }))
    const { error: insErr } = await supabase
      .from('employee_recurring_breaks')
      .insert(rows)
    if (insErr) return { ok: false, message: insErr.message }
  }

  revalidatePath(`/admin/employees/${employeeId}/edit`)
  return { ok: true }
}

// ─── Time-off: crear (con confirmación si pisa reservas) ───────────────────

export async function createEmployeeTimeOffAction(
  employeeId: number,
  _prev: TimeOffActionState,
  formData: FormData,
): Promise<TimeOffActionState> {
  const parsed = parseTimeOffCreateFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const ok = await assertEmployeeBelongsToSalon(supabase, employeeId, salon.id)
  if (!ok) return { ok: false, message: 'Empleado no encontrado' }

  // Día completo: [starts_on 00:00 Madrid, ends_on+1 00:00 Madrid)
  const startUtc = madridLocalDateToUtc(parsed.data.starts_on)
  const endUtc = madridLocalDateToUtc(addDaysIsoLocal(parsed.data.ends_on, 1))
  const startIso = startUtc.toISOString()
  const endIso = endUtc.toISOString()

  const confirm = formData.get('confirm') === 'true'

  if (!confirm) {
    const conflicts = await findBookingConflicts(
      supabase,
      employeeId,
      salon.id,
      startIso,
      endIso,
    )
    if (conflicts.length > 0) {
      return { ok: false, conflicts }
    }
  }

  const { error: insErr } = await supabase.from('employee_time_off').insert({
    employee_id: employeeId,
    during: `[${startIso},${endIso})`,
    reason: parsed.data.reason,
    note: parsed.data.note,
  })

  if (insErr) {
    // El EXCLUDE de la BD impide solapes con otros time-offs del mismo empleado.
    return { ok: false, message: insErr.message }
  }

  revalidatePath(`/admin/employees/${employeeId}/edit`)
  return { ok: true }
}

export async function deleteEmployeeTimeOffAction(
  formData: FormData,
): Promise<void> {
  const idRaw = formData.get('id')
  const employeeIdRaw = formData.get('employee_id')
  const id = Number(idRaw)
  const employeeId = Number(employeeIdRaw)
  if (!Number.isFinite(id) || id <= 0) return
  if (!Number.isFinite(employeeId) || employeeId <= 0) return

  const salon = await getCurrentSalon()
  const supabase = createAdminClient()

  const ok = await assertEmployeeBelongsToSalon(supabase, employeeId, salon.id)
  if (!ok) return

  const { error } = await supabase
    .from('employee_time_off')
    .delete()
    .eq('id', id)
    .eq('employee_id', employeeId)

  if (error) throw error
  revalidatePath(`/admin/employees/${employeeId}/edit`)
}

// ─── Detección de reservas afectadas por un time-off propuesto ─────────────

async function findBookingConflicts(
  supabase: SupabaseClient,
  employeeId: number,
  salonId: number,
  startIso: string,
  endIso: string,
): Promise<ConflictingBooking[]> {
  // Solapan ⇔ item.starts_at < endIso AND item.ends_at > startIso
  const { data, error } = await supabase
    .from('booking_items')
    .select(
      `
        booking_id,
        starts_at,
        ends_at,
        services!inner(name),
        bookings!inner(
          clients!inner(display_name)
        )
      `,
    )
    .eq('employee_id', employeeId)
    .eq('salon_id', salonId)
    .in('booking_status', ['pending', 'confirmed', 'in_progress'])
    .lt('starts_at', endIso)
    .gt('ends_at', startIso)
    .order('starts_at', { ascending: true })

  if (error) throw error

  type Row = {
    booking_id: number
    starts_at: string
    ends_at: string
    services: { name: string } | { name: string }[] | null
    bookings:
      | {
          clients: { display_name: string } | { display_name: string }[] | null
        }
      | {
          clients: { display_name: string } | { display_name: string }[] | null
        }[]
      | null
  }

  return ((data ?? []) as Row[]).map((row) => {
    const service = Array.isArray(row.services) ? row.services[0] : row.services
    const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
    const client = booking
      ? Array.isArray(booking.clients)
        ? booking.clients[0]
        : booking.clients
      : null
    return {
      booking_id: row.booking_id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      client_name: client?.display_name ?? '—',
      service_name: service?.name ?? '—',
    }
  })
}
