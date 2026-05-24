import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  sql,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  employee_recurring_breaks,
  employee_services,
  employee_time_off,
  employee_weekly_schedule,
  employees,
  services,
} from '@/lib/db/schema'

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type EmployeeListRow = {
  id: number
  display_name: string
  is_active: boolean
  display_order: number
  color_hex: string | null
  service_count: number
}

export type EmployeeDetail = {
  id: number
  salon_id: number
  display_name: string
  bio: string | null
  is_active: boolean
  display_order: number
  color_hex: string | null
  service_ids: number[]
}

export type WeeklyShift = {
  id: number
  weekday: number
  starts_at: string
  ends_at: string
}

export type RecurringBreak = {
  id: number
  weekday: number
  starts_at: string
  ends_at: string
  label: string | null
}

export type TimeOffReason =
  | 'vacation'
  | 'sick'
  | 'personal'
  | 'training'
  | 'other'

export type TimeOffEntry = {
  id: number
  starts_at: string
  ends_at: string
  reason: TimeOffReason
  note: string | null
}

export type ServiceOption = {
  id: number
  name: string
  is_active: boolean
}

export async function getPublicEmployeeName({
  salonId,
  employeeId,
}: {
  salonId: number
  employeeId: number
}): Promise<string | null> {
  const row = db
    .select({
      display_name: employees.display_name,
      is_active: employees.is_active,
    })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.salon_id, salonId)))
    .get()

  if (!row || !row.is_active) return null
  return row.display_name
}

export type PublicEmployeeRow = {
  id: number
  display_name: string
  bio: string | null
}

// Empleados visibles en el paso 2 del flujo público de reserva: activos y
// autorizados para el servicio elegido. Ordenados por display_order y nombre,
// como el listing admin, para que la fila "más arriba" sea consistente.
export async function listPublicEmployeesForService({
  salonId,
  serviceId,
}: {
  salonId: number
  serviceId: number
}): Promise<PublicEmployeeRow[]> {
  return db
    .select({
      id: employees.id,
      display_name: employees.display_name,
      bio: employees.bio,
    })
    .from(employees)
    .innerJoin(
      employee_services,
      eq(employee_services.employee_id, employees.id),
    )
    .where(
      and(
        eq(employees.salon_id, salonId),
        eq(employees.is_active, true),
        eq(employee_services.service_id, serviceId),
      ),
    )
    .orderBy(asc(employees.display_order), asc(employees.display_name))
    .all()
}

// ─── Listado ───────────────────────────────────────────────────────────────

export async function listEmployees({
  salonId,
  q,
}: {
  salonId: number
  q?: string
}): Promise<EmployeeListRow[]> {
  const trimmed = q?.trim()
  const where =
    trimmed && trimmed.length > 0
      ? and(
          eq(employees.salon_id, salonId),
          like(
            sql`lower(${employees.display_name})`,
            `%${trimmed.toLowerCase()}%`,
          ),
        )
      : eq(employees.salon_id, salonId)

  const rows = db
    .select({
      id: employees.id,
      display_name: employees.display_name,
      is_active: employees.is_active,
      display_order: employees.display_order,
      color_hex: employees.color_hex,
    })
    .from(employees)
    .where(where)
    .orderBy(
      desc(employees.is_active),
      asc(employees.display_order),
      asc(employees.display_name),
    )
    .all()

  if (rows.length === 0) return []

  const counts = db
    .select({
      employee_id: employee_services.employee_id,
      c: count(),
    })
    .from(employee_services)
    .where(
      inArray(
        employee_services.employee_id,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(employee_services.employee_id)
    .all()

  const countBy = new Map(counts.map((r) => [r.employee_id, r.c]))

  return rows.map((r) => ({
    ...r,
    service_count: countBy.get(r.id) ?? 0,
  }))
}

// ─── Ficha ─────────────────────────────────────────────────────────────────

export async function getEmployeeById(
  id: number,
  salonId: number,
): Promise<EmployeeDetail | null> {
  const row = db
    .select({
      id: employees.id,
      salon_id: employees.salon_id,
      display_name: employees.display_name,
      bio: employees.bio,
      is_active: employees.is_active,
      display_order: employees.display_order,
      color_hex: employees.color_hex,
    })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.salon_id, salonId)))
    .get()

  if (!row) return null

  const svcRows = db
    .select({ service_id: employee_services.service_id })
    .from(employee_services)
    .where(eq(employee_services.employee_id, id))
    .all()

  return {
    ...row,
    service_ids: svcRows.map((r) => r.service_id),
  }
}

// ─── Horario semanal (filas vivas: effective_until is null) ────────────────

export async function getWeeklySchedule(
  employeeId: number,
): Promise<WeeklyShift[]> {
  const rows = db
    .select({
      id: employee_weekly_schedule.id,
      weekday: employee_weekly_schedule.weekday,
      starts_at: employee_weekly_schedule.starts_at,
      ends_at: employee_weekly_schedule.ends_at,
    })
    .from(employee_weekly_schedule)
    .where(
      and(
        eq(employee_weekly_schedule.employee_id, employeeId),
        isNull(employee_weekly_schedule.effective_until),
      ),
    )
    .orderBy(
      asc(employee_weekly_schedule.weekday),
      asc(employee_weekly_schedule.starts_at),
    )
    .all()

  return rows.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    // En SQLite guardamos 'HH:MM' directamente; .slice defensivo por si
    // alguna fila histórica trajera segundos.
    starts_at: r.starts_at.slice(0, 5),
    ends_at: r.ends_at.slice(0, 5),
  }))
}

// ─── Descansos recurrentes ─────────────────────────────────────────────────

export async function getRecurringBreaks(
  employeeId: number,
): Promise<RecurringBreak[]> {
  const rows = db
    .select({
      id: employee_recurring_breaks.id,
      weekday: employee_recurring_breaks.weekday,
      starts_at: employee_recurring_breaks.starts_at,
      ends_at: employee_recurring_breaks.ends_at,
      label: employee_recurring_breaks.label,
    })
    .from(employee_recurring_breaks)
    .where(
      and(
        eq(employee_recurring_breaks.employee_id, employeeId),
        isNull(employee_recurring_breaks.effective_until),
      ),
    )
    .orderBy(
      asc(employee_recurring_breaks.weekday),
      asc(employee_recurring_breaks.starts_at),
    )
    .all()

  return rows.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    starts_at: r.starts_at.slice(0, 5),
    ends_at: r.ends_at.slice(0, 5),
    label: r.label,
  }))
}

// ─── Time-off ──────────────────────────────────────────────────────────────

export async function getTimeOff(
  employeeId: number,
  opts?: { includePast?: boolean },
): Promise<TimeOffEntry[]> {
  const where = opts?.includePast
    ? eq(employee_time_off.employee_id, employeeId)
    : and(
        eq(employee_time_off.employee_id, employeeId),
        gte(employee_time_off.ends_at, new Date()),
      )

  const rows = db
    .select({
      id: employee_time_off.id,
      starts_at: employee_time_off.starts_at,
      ends_at: employee_time_off.ends_at,
      reason: employee_time_off.reason,
      note: employee_time_off.note,
    })
    .from(employee_time_off)
    .where(where)
    .orderBy(desc(employee_time_off.id))
    .all()

  const out: TimeOffEntry[] = rows.map((r) => ({
    id: r.id,
    starts_at: r.starts_at.toISOString(),
    ends_at: r.ends_at.toISOString(),
    reason: r.reason as TimeOffReason,
    note: r.note,
  }))
  out.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return out
}

// ─── Servicios disponibles del salón (para el multiselect) ─────────────────

export async function listServicesForSalon(
  salonId: number,
): Promise<ServiceOption[]> {
  return db
    .select({
      id: services.id,
      name: services.name,
      is_active: services.is_active,
    })
    .from(services)
    .where(eq(services.salon_id, salonId))
    .orderBy(asc(services.display_order), asc(services.name))
    .all()
}
