import { and, eq, gt, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  booking_items,
  employee_recurring_breaks,
  employee_services,
  employee_time_off,
  employee_weekly_schedule,
  employees,
  salon_closures,
  salon_working_hours,
  salons,
  services,
} from '@/lib/db/schema'
import type { Interval } from './types'

// ─── Tipos de datos crudos consumidos por el engine ───────────────────────

export type SalonRow = {
  id: number
  timezone: string
  slot_granularity_minutes: number
  booking_min_hours_ahead: number
  booking_max_days_ahead: number
}

export type ServiceRow = {
  id: number
  salon_id: number
  duration_minutes: number
  max_concurrent: number | null
  is_active: boolean
}

export type EmployeeRow = {
  id: number
  display_name: string
  display_order: number
  is_active: boolean
}

export type WeeklyShiftRow = {
  employee_id: number
  weekday: number // 1..7 ISO
  starts_at: string // 'HH:MM'
  ends_at: string
  effective_from: string // 'YYYY-MM-DD'
  effective_until: string | null
}

export type RecurringBreakRow = {
  employee_id: number
  weekday: number
  starts_at: string
  ends_at: string
  effective_from: string
  effective_until: string | null
}

export type SalonWorkingHoursRow = {
  weekday: number
  opens_at: string | null
  closes_at: string | null
}

export type TimeOffRow = {
  employee_id: number
  interval: Interval
}

export type ClosureRow = {
  interval: Interval
}

export type BookingItemRow = {
  id: number
  employee_id: number
  service_id: number
  interval: Interval
}

export type AvailabilityRawData = {
  salon: SalonRow
  service: ServiceRow
  employees: EmployeeRow[]
  weeklyShifts: WeeklyShiftRow[]
  recurringBreaks: RecurringBreakRow[]
  workingHours: SalonWorkingHoursRow[]
  timeOff: TimeOffRow[]
  closures: ClosureRow[]
  bookingItems: BookingItemRow[]
}

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress'] as const

// ─── Bulk fetch ───────────────────────────────────────────────────────────

// `rangeStartUtc` y `rangeEndUtc` son los extremos absolutos del rango a calcular
// (medianoche local de `from` a medianoche local del día siguiente a `to`).
// Solapamiento half-open: `start < rangeEnd AND end > rangeStart`.
//
// `from` / `to` son fechas locales 'YYYY-MM-DD' usadas para filtrar
// effective_from / effective_until en weekly_schedule y recurring_breaks.
export async function fetchAvailabilityData(args: {
  salonId: number
  serviceId: number
  employeeFilter: number | 'any'
  from: string
  to: string
  rangeStartUtc: Date
  rangeEndUtc: Date
}): Promise<AvailabilityRawData | null> {
  // Q1: salón
  const salon = (
    await db
      .select({
        id: salons.id,
        timezone: salons.timezone,
        slot_granularity_minutes: salons.slot_granularity_minutes,
        booking_min_hours_ahead: salons.booking_min_hours_ahead,
        booking_max_days_ahead: salons.booking_max_days_ahead,
      })
      .from(salons)
      .where(eq(salons.id, args.salonId))
      .limit(1)
  )[0]
  if (!salon) return null

  // Q2: servicio
  const service = (
    await db
      .select({
        id: services.id,
        salon_id: services.salon_id,
        duration_minutes: services.duration_minutes,
        max_concurrent: services.max_concurrent,
        is_active: services.is_active,
      })
      .from(services)
      .where(
        and(eq(services.id, args.serviceId), eq(services.salon_id, args.salonId)),
      )
      .limit(1)
  )[0]
  if (!service || !service.is_active) return null

  // Q3: empleados activos del salón autorizados para el servicio.
  const empWhere =
    args.employeeFilter === 'any'
      ? and(
          eq(employees.salon_id, args.salonId),
          eq(employees.is_active, true),
          eq(employee_services.service_id, args.serviceId),
        )
      : and(
          eq(employees.salon_id, args.salonId),
          eq(employees.is_active, true),
          eq(employee_services.service_id, args.serviceId),
          eq(employees.id, args.employeeFilter),
        )
  const employeeRows = await db
    .select({
      id: employees.id,
      display_name: employees.display_name,
      display_order: employees.display_order,
      is_active: employees.is_active,
    })
    .from(employees)
    .innerJoin(
      employee_services,
      eq(employee_services.employee_id, employees.id),
    )
    .where(empWhere)

  const employeeIds = employeeRows.map((e) => e.id)

  // Q6: working hours del salón (no depende de los empleados)
  const workingHoursRows = await db
    .select({
      weekday: salon_working_hours.weekday,
      opens_at: salon_working_hours.opens_at,
      closes_at: salon_working_hours.closes_at,
    })
    .from(salon_working_hours)
    .where(eq(salon_working_hours.salon_id, args.salonId))

  // Q8: closures del salón que solapan el rango
  const closureRows = await db
    .select({
      starts_at: salon_closures.starts_at,
      ends_at: salon_closures.ends_at,
    })
    .from(salon_closures)
    .where(
      and(
        eq(salon_closures.salon_id, args.salonId),
        lt(salon_closures.starts_at, args.rangeEndUtc),
        gt(salon_closures.ends_at, args.rangeStartUtc),
      ),
    )

  // Q9: booking_items activos del salón en el rango.
  // Lo sigue cargando aunque no haya empleados elegibles, por consistencia
  // del shape devuelto. El engine también consulta capacidad concurrente
  // del servicio en su totalidad, no solo de los empleados del filtro.
  const bookingItemRows = await db
    .select({
      id: booking_items.id,
      employee_id: booking_items.employee_id,
      service_id: booking_items.service_id,
      starts_at: booking_items.starts_at,
      ends_at: booking_items.ends_at,
    })
    .from(booking_items)
    .where(
      and(
        eq(booking_items.salon_id, args.salonId),
        inArray(booking_items.booking_status, [...ACTIVE_BOOKING_STATUSES]),
        lt(booking_items.starts_at, args.rangeEndUtc),
        gt(booking_items.ends_at, args.rangeStartUtc),
      ),
    )

  // Si no hay empleados elegibles, los conjuntos dependientes son vacíos.
  if (employeeIds.length === 0) {
    return {
      salon,
      service,
      employees: [],
      weeklyShifts: [],
      recurringBreaks: [],
      workingHours: workingHoursRows.map((r) => ({
        weekday: r.weekday,
        opens_at: r.opens_at ? trimTime(r.opens_at) : null,
        closes_at: r.closes_at ? trimTime(r.closes_at) : null,
      })),
      timeOff: [],
      closures: closureRows.map((r) => ({
        interval: { start: r.starts_at, end: r.ends_at },
      })),
      bookingItems: bookingItemRows.map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        service_id: r.service_id,
        interval: { start: r.starts_at, end: r.ends_at },
      })),
    }
  }

  // Q4: horario semanal de los empleados elegibles, válido en el rango.
  // effective_from <= to AND (effective_until IS NULL OR effective_until >= from)
  const weeklyRows = await db
    .select({
      employee_id: employee_weekly_schedule.employee_id,
      weekday: employee_weekly_schedule.weekday,
      starts_at: employee_weekly_schedule.starts_at,
      ends_at: employee_weekly_schedule.ends_at,
      effective_from: employee_weekly_schedule.effective_from,
      effective_until: employee_weekly_schedule.effective_until,
    })
    .from(employee_weekly_schedule)
    .where(
      and(
        inArray(employee_weekly_schedule.employee_id, employeeIds),
        lte(employee_weekly_schedule.effective_from, args.to),
        or(
          isNull(employee_weekly_schedule.effective_until),
          gte(employee_weekly_schedule.effective_until, args.from),
        ),
      ),
    )

  // Q5: descansos recurrentes con el mismo criterio.
  const breakRows = await db
    .select({
      employee_id: employee_recurring_breaks.employee_id,
      weekday: employee_recurring_breaks.weekday,
      starts_at: employee_recurring_breaks.starts_at,
      ends_at: employee_recurring_breaks.ends_at,
      effective_from: employee_recurring_breaks.effective_from,
      effective_until: employee_recurring_breaks.effective_until,
    })
    .from(employee_recurring_breaks)
    .where(
      and(
        inArray(employee_recurring_breaks.employee_id, employeeIds),
        lte(employee_recurring_breaks.effective_from, args.to),
        or(
          isNull(employee_recurring_breaks.effective_until),
          gte(employee_recurring_breaks.effective_until, args.from),
        ),
      ),
    )

  // Q7: time-off de los empleados que solapa el rango
  const timeOffRows = await db
    .select({
      employee_id: employee_time_off.employee_id,
      starts_at: employee_time_off.starts_at,
      ends_at: employee_time_off.ends_at,
    })
    .from(employee_time_off)
    .where(
      and(
        inArray(employee_time_off.employee_id, employeeIds),
        lt(employee_time_off.starts_at, args.rangeEndUtc),
        gt(employee_time_off.ends_at, args.rangeStartUtc),
      ),
    )

  return {
    salon,
    service,
    employees: employeeRows,
    weeklyShifts: weeklyRows.map((r) => ({
      employee_id: r.employee_id,
      weekday: r.weekday,
      starts_at: trimTime(r.starts_at),
      ends_at: trimTime(r.ends_at),
      effective_from: r.effective_from,
      effective_until: r.effective_until,
    })),
    recurringBreaks: breakRows.map((r) => ({
      employee_id: r.employee_id,
      weekday: r.weekday,
      starts_at: trimTime(r.starts_at),
      ends_at: trimTime(r.ends_at),
      effective_from: r.effective_from,
      effective_until: r.effective_until,
    })),
    workingHours: workingHoursRows.map((r) => ({
      weekday: r.weekday,
      opens_at: r.opens_at ? trimTime(r.opens_at) : null,
      closes_at: r.closes_at ? trimTime(r.closes_at) : null,
    })),
    timeOff: timeOffRows.map((r) => ({
      employee_id: r.employee_id,
      interval: { start: r.starts_at, end: r.ends_at },
    })),
    closures: closureRows.map((r) => ({
      interval: { start: r.starts_at, end: r.ends_at },
    })),
    bookingItems: bookingItemRows.map((r) => ({
      id: r.id,
      employee_id: r.employee_id,
      service_id: r.service_id,
      interval: { start: r.starts_at, end: r.ends_at },
    })),
  }
}

// Defensa: si alguna fila vieja conserva 'HH:MM:SS' en lugar de 'HH:MM',
// la recortamos para uniformidad con el motor.
function trimTime(t: string): string {
  return t.slice(0, 5)
}
