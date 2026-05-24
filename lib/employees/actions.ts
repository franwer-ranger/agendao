'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  booking_items,
  bookings,
  clients,
  employee_recurring_breaks,
  employee_services,
  employee_time_off,
  employee_weekly_schedule,
  employees,
  services,
} from '@/lib/db/schema'
import {
  parseEmployeeFormData,
  parseRecurringBreaksFormData,
  parseTimeOffCreateFormData,
  parseWeeklyScheduleFormData,
} from '@/lib/employees/schema'
import { resolveUniqueEmployeeSlug } from '@/lib/employees/slug'
import { getCurrentSalon } from '@/lib/salon'
import { addDaysIsoLocal, salonDateToUtc } from '@/lib/time'

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

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]
type TxLike = Pick<typeof db, 'select'>

// ─── Helpers internos ──────────────────────────────────────────────────────

function assertEmployeeBelongsToSalon(
  employeeId: number,
  salonId: number,
  txDb: TxLike = db,
): boolean {
  const hit = txDb
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.salon_id, salonId)))
    .limit(1)
    .get()
  return Boolean(hit)
}

// Sincroniza la lista de servicios que el empleado puede realizar.
// Mismo patrón que syncEmployeeAssignments en lib/services/actions.ts, invertido.
function syncServiceAssignments(
  employeeId: number,
  salonId: number,
  desiredServiceIds: number[],
  tx: TxDb,
): void {
  let desired = desiredServiceIds
  if (desired.length > 0) {
    const validRows = tx
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.salon_id, salonId), inArray(services.id, desired)))
      .all()
    const validSet = new Set(validRows.map((r) => r.id))
    desired = desired.filter((id) => validSet.has(id))
  }

  const existing = tx
    .select({ service_id: employee_services.service_id })
    .from(employee_services)
    .where(eq(employee_services.employee_id, employeeId))
    .all()

  const existingIds = new Set(existing.map((r) => r.service_id))
  const desiredSet = new Set(desired)

  const toAdd = [...desiredSet].filter((id) => !existingIds.has(id))
  const toRemove = [...existingIds].filter((id) => !desiredSet.has(id))

  if (toRemove.length > 0) {
    tx.delete(employee_services)
      .where(
        and(
          eq(employee_services.employee_id, employeeId),
          inArray(employee_services.service_id, toRemove),
        ),
      )
      .run()
  }

  if (toAdd.length > 0) {
    tx.insert(employee_services)
      .values(
        toAdd.map((service_id) => ({ employee_id: employeeId, service_id })),
      )
      .run()
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

  let createdId: number
  try {
    createdId = db.transaction((tx) => {
      const slug = resolveUniqueEmployeeSlug(
        salon.id,
        parsed.data.display_name,
        undefined,
        tx,
      )
      const inserted = tx
        .insert(employees)
        .values({
          salon_id: salon.id,
          display_name: parsed.data.display_name,
          slug,
          bio: parsed.data.bio,
          color_hex: parsed.data.color_hex,
          is_active: parsed.data.is_active,
          display_order: parsed.data.display_order,
        })
        .returning({ id: employees.id })
        .all()
      const created = inserted[0]
      if (!created) throw new Error('No se pudo crear el empleado')

      syncServiceAssignments(
        created.id,
        salon.id,
        parsed.data.service_ids,
        tx,
      )
      return created.id
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath('/admin/employees')
  redirect(`/admin/employees/${createdId}/edit`)
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

  try {
    db.transaction((tx) => {
      const current = tx
        .select({
          id: employees.id,
          display_name: employees.display_name,
          slug: employees.slug,
        })
        .from(employees)
        .where(
          and(eq(employees.id, employeeId), eq(employees.salon_id, salon.id)),
        )
        .get()
      if (!current) throw new Error('Empleado no encontrado')

      const slug =
        current.display_name === parsed.data.display_name
          ? current.slug
          : resolveUniqueEmployeeSlug(
              salon.id,
              parsed.data.display_name,
              employeeId,
              tx,
            )

      tx.update(employees)
        .set({
          display_name: parsed.data.display_name,
          slug,
          bio: parsed.data.bio,
          color_hex: parsed.data.color_hex,
          is_active: parsed.data.is_active,
          display_order: parsed.data.display_order,
        })
        .where(
          and(eq(employees.id, employeeId), eq(employees.salon_id, salon.id)),
        )
        .run()

      syncServiceAssignments(
        employeeId,
        salon.id,
        parsed.data.service_ids,
        tx,
      )
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

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

  db.update(employees)
    .set({ is_active: active })
    .where(and(eq(employees.id, id), eq(employees.salon_id, salon.id)))
    .run()

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

  try {
    db.transaction((tx) => {
      if (!assertEmployeeBelongsToSalon(employeeId, salon.id, tx)) {
        throw new Error('Empleado no encontrado')
      }

      // Reemplazo total: borramos las filas "vivas" (effective_until is null)
      // y metemos las nuevas. No tocamos versiones históricas.
      tx.delete(employee_weekly_schedule)
        .where(
          and(
            eq(employee_weekly_schedule.employee_id, employeeId),
            isNull(employee_weekly_schedule.effective_until),
          ),
        )
        .run()

      if (parsed.data.shifts.length > 0) {
        tx.insert(employee_weekly_schedule)
          .values(
            parsed.data.shifts.map((s) => ({
              employee_id: employeeId,
              weekday: s.weekday,
              starts_at: s.starts_at,
              ends_at: s.ends_at,
            })),
          )
          .run()
      }
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
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

  try {
    db.transaction((tx) => {
      if (!assertEmployeeBelongsToSalon(employeeId, salon.id, tx)) {
        throw new Error('Empleado no encontrado')
      }

      tx.delete(employee_recurring_breaks)
        .where(
          and(
            eq(employee_recurring_breaks.employee_id, employeeId),
            isNull(employee_recurring_breaks.effective_until),
          ),
        )
        .run()

      if (parsed.data.breaks.length > 0) {
        tx.insert(employee_recurring_breaks)
          .values(
            parsed.data.breaks.map((b) => ({
              employee_id: employeeId,
              weekday: b.weekday,
              starts_at: b.starts_at,
              ends_at: b.ends_at,
              label: b.label,
            })),
          )
          .run()
      }
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
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

  if (!assertEmployeeBelongsToSalon(employeeId, salon.id)) {
    return { ok: false, message: 'Empleado no encontrado' }
  }

  // Día completo: [starts_on 00:00 Madrid, ends_on+1 00:00 Madrid)
  const startUtc = salonDateToUtc(parsed.data.starts_on)
  const endUtc = salonDateToUtc(addDaysIsoLocal(parsed.data.ends_on, 1))

  const confirm = formData.get('confirm') === 'true'

  if (!confirm) {
    const conflicts = findBookingConflicts(
      employeeId,
      salon.id,
      startUtc,
      endUtc,
    )
    if (conflicts.length > 0) {
      return { ok: false, conflicts }
    }
  }

  try {
    db.transaction((tx) => {
      // Replica del EXCLUDE GIST de Postgres: rechazar si solapa con otro
      // time-off del mismo empleado. Half-open: start < otherEnd AND end > otherStart.
      const overlap = tx
        .select({ id: employee_time_off.id })
        .from(employee_time_off)
        .where(
          and(
            eq(employee_time_off.employee_id, employeeId),
            lt(employee_time_off.starts_at, endUtc),
            gt(employee_time_off.ends_at, startUtc),
          ),
        )
        .limit(1)
        .get()
      if (overlap) {
        throw new Error('Ya existe un bloqueo que solapa con ese rango.')
      }

      tx.insert(employee_time_off)
        .values({
          employee_id: employeeId,
          starts_at: startUtc,
          ends_at: endUtc,
          reason: parsed.data.reason,
          note: parsed.data.note,
        })
        .run()
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
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

  if (!assertEmployeeBelongsToSalon(employeeId, salon.id)) return

  db.delete(employee_time_off)
    .where(
      and(
        eq(employee_time_off.id, id),
        eq(employee_time_off.employee_id, employeeId),
      ),
    )
    .run()

  revalidatePath(`/admin/employees/${employeeId}/edit`)
}

// ─── Detección de reservas afectadas por un time-off propuesto ─────────────

function findBookingConflicts(
  employeeId: number,
  salonId: number,
  start: Date,
  end: Date,
): ConflictingBooking[] {
  // Solapan ⇔ item.starts_at < end AND item.ends_at > start
  const rows = db
    .select({
      booking_id: booking_items.booking_id,
      starts_at: booking_items.starts_at,
      ends_at: booking_items.ends_at,
      service_name: services.name,
      client_name: clients.display_name,
    })
    .from(booking_items)
    .innerJoin(bookings, eq(booking_items.booking_id, bookings.id))
    .innerJoin(clients, eq(bookings.client_id, clients.id))
    .innerJoin(services, eq(booking_items.service_id, services.id))
    .where(
      and(
        eq(booking_items.employee_id, employeeId),
        eq(booking_items.salon_id, salonId),
        inArray(booking_items.booking_status, [
          'pending',
          'confirmed',
          'in_progress',
        ]),
        lt(booking_items.starts_at, end),
        gt(booking_items.ends_at, start),
      ),
    )
    .orderBy(asc(booking_items.starts_at))
    .all()

  return rows.map((r) => ({
    booking_id: r.booking_id,
    starts_at: r.starts_at.toISOString(),
    ends_at: r.ends_at.toISOString(),
    client_name: r.client_name,
    service_name: r.service_name,
  }))
}
