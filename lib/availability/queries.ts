import { createAdminClient } from '@/lib/supabase/admin'
import { tstzRangeToInterval } from './intervals'
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
  starts_at: string // 'HH:MM[:SS]'
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

// ─── Bulk fetch ───────────────────────────────────────────────────────────

// `rangeStartUtc` y `rangeEndUtc` son los extremos absolutos del rango a calcular
// (medianoche local de `from` a medianoche local del día siguiente a `to`).
// Se usan en los filtros `during && tstzrange` para reservas, time-off y closures.
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
  const supabase = createAdminClient()
  const rangeLiteral = `[${args.rangeStartUtc.toISOString()},${args.rangeEndUtc.toISOString()})`

  // Q1: salón
  const salonP = supabase
    .from('salons')
    .select(
      'id, timezone, slot_granularity_minutes, booking_min_hours_ahead, booking_max_days_ahead',
    )
    .eq('id', args.salonId)
    .maybeSingle()

  // Q2: servicio
  const serviceP = supabase
    .from('services')
    .select('id, salon_id, duration_minutes, max_concurrent, is_active')
    .eq('id', args.serviceId)
    .eq('salon_id', args.salonId)
    .maybeSingle()

  // Q3: empleados activos del salón que pueden hacer el servicio.
  // `employee_services!inner` actúa como filtro de pertenencia.
  let employeesQuery = supabase
    .from('employees')
    .select(
      'id, display_name, display_order, is_active, employee_services!inner(service_id)',
    )
    .eq('salon_id', args.salonId)
    .eq('is_active', true)
    .eq('employee_services.service_id', args.serviceId)

  if (args.employeeFilter !== 'any') {
    employeesQuery = employeesQuery.eq('id', args.employeeFilter)
  }
  const employeesP = employeesQuery

  // Q4: horario semanal de esos empleados, válido en el rango de fechas.
  // effective_from <= to AND (effective_until IS NULL OR effective_until >= from)
  const weeklyP = supabase
    .from('employee_weekly_schedule')
    .select(
      'employee_id, weekday, starts_at, ends_at, effective_from, effective_until',
    )
    .lte('effective_from', args.to)
    .or(`effective_until.is.null,effective_until.gte.${args.from}`)

  // Q5: descansos recurrentes con el mismo criterio.
  const breaksP = supabase
    .from('employee_recurring_breaks')
    .select(
      'employee_id, weekday, starts_at, ends_at, effective_from, effective_until',
    )
    .lte('effective_from', args.to)
    .or(`effective_until.is.null,effective_until.gte.${args.from}`)

  // Q6: working hours del salón
  const workingHoursP = supabase
    .from('salon_working_hours')
    .select('weekday, opens_at, closes_at')
    .eq('salon_id', args.salonId)

  // Q7: time-off de los empleados que solapa el rango
  const timeOffP = supabase
    .from('employee_time_off')
    .select('employee_id, during')
    .overlaps('during', rangeLiteral)

  // Q8: closures del salón que solapan el rango
  const closuresP = supabase
    .from('salon_closures')
    .select('during')
    .eq('salon_id', args.salonId)
    .overlaps('during', rangeLiteral)

  // Q9: booking_items activos del salón en el rango (sirve para capas 5, 8 y 9)
  const bookingsP = supabase
    .from('booking_items')
    .select('id, employee_id, service_id, starts_at, ends_at, during')
    .eq('salon_id', args.salonId)
    .in('booking_status', ['pending', 'confirmed', 'in_progress'])
    .overlaps('during', rangeLiteral)

  const [
    { data: salonData, error: salonErr },
    { data: serviceData, error: serviceErr },
    { data: employeesData, error: employeesErr },
    { data: weeklyData, error: weeklyErr },
    { data: breaksData, error: breaksErr },
    { data: workingHoursData, error: workingHoursErr },
    { data: timeOffData, error: timeOffErr },
    { data: closuresData, error: closuresErr },
    { data: bookingsData, error: bookingsErr },
  ] = await Promise.all([
    salonP,
    serviceP,
    employeesP,
    weeklyP,
    breaksP,
    workingHoursP,
    timeOffP,
    closuresP,
    bookingsP,
  ])

  const firstError =
    salonErr ||
    serviceErr ||
    employeesErr ||
    weeklyErr ||
    breaksErr ||
    workingHoursErr ||
    timeOffErr ||
    closuresErr ||
    bookingsErr
  if (firstError) throw firstError
  if (!salonData || !serviceData) return null
  if (!serviceData.is_active) return null

  const employees: EmployeeRow[] = (employeesData ?? []).map((e) => ({
    id: e.id,
    display_name: e.display_name,
    display_order: e.display_order,
    is_active: e.is_active,
  }))
  const employeeIds = new Set(employees.map((e) => e.id))

  return {
    salon: salonData as SalonRow,
    service: serviceData as ServiceRow,
    employees,
    weeklyShifts: (weeklyData ?? [])
      .filter((r) => employeeIds.has(r.employee_id))
      .map((r) => ({
        employee_id: r.employee_id,
        weekday: r.weekday,
        starts_at: trimTime(r.starts_at),
        ends_at: trimTime(r.ends_at),
        effective_from: r.effective_from,
        effective_until: r.effective_until,
      })),
    recurringBreaks: (breaksData ?? [])
      .filter((r) => employeeIds.has(r.employee_id))
      .map((r) => ({
        employee_id: r.employee_id,
        weekday: r.weekday,
        starts_at: trimTime(r.starts_at),
        ends_at: trimTime(r.ends_at),
        effective_from: r.effective_from,
        effective_until: r.effective_until,
      })),
    workingHours: (workingHoursData ?? []).map((r) => ({
      weekday: r.weekday,
      opens_at: r.opens_at ? trimTime(r.opens_at) : null,
      closes_at: r.closes_at ? trimTime(r.closes_at) : null,
    })),
    timeOff: (timeOffData ?? [])
      .filter((r) => employeeIds.has(r.employee_id))
      .map((r) => ({
        employee_id: r.employee_id,
        interval: tstzRangeToInterval(String(r.during))!,
      }))
      .filter((r) => r.interval !== null),
    closures: (closuresData ?? [])
      .map((r) => ({ interval: tstzRangeToInterval(String(r.during))! }))
      .filter((r) => r.interval !== null),
    bookingItems: (bookingsData ?? []).map((r) => ({
      id: r.id,
      employee_id: r.employee_id,
      service_id: r.service_id,
      interval: {
        start: new Date(r.starts_at),
        end: new Date(r.ends_at),
      },
    })),
  }
}

// Postgres devuelve `time` como 'HH:MM:SS'. Para el motor usamos 'HH:MM'.
function trimTime(t: string): string {
  return t.slice(0, 5)
}
