import { chunkBySlot, intersect, normalize, subtract } from './intervals'
import {
  iterateLocalDates,
  isoWeekdayFromLocalDate,
  madridLocalDateOf,
  madridLocalDateTimeToUtc,
} from './time'
import type { AvailableSlot, Interval } from './types'
import type {
  AvailabilityRawData,
  EmployeeRow,
  RecurringBreakRow,
  SalonWorkingHoursRow,
  WeeklyShiftRow,
} from './queries'

// Función pura: dado el snapshot crudo + "now", devuelve los slots disponibles.
// Sin I/O. Determinista. Se le inyecta `now` para poder probar a mano fechas raras.
export function computeAvailability(
  raw: AvailabilityRawData,
  input: { from: string; to: string; employeeFilter: number | 'any' },
  now: Date,
): AvailableSlot[] {
  if (raw.employees.length === 0) return []

  const days = iterateLocalDates(input.from, input.to)
  const granularity = raw.salon.slot_granularity_minutes
  const duration = raw.service.duration_minutes

  // Ventana válida por antelación: [now + min_hours, now + max_days)
  const minMs = raw.salon.booking_min_hours_ahead * 3_600_000
  const maxMs = raw.salon.booking_max_days_ahead * 86_400_000
  const anticipationWindow: Interval = {
    start: new Date(now.getTime() + minMs),
    end: new Date(now.getTime() + maxMs),
  }

  // Working hours del salón: indexado por weekday para reuso.
  // `hoursConfigured` replica el contrato del trigger `booking_items_validate`:
  // si existe al menos una fila para el salón, los días sin fila se consideran
  // CERRADOS. Si no hay ninguna, no aplicamos restricción del salón todavía.
  const workingHoursByDow = new Map<number, SalonWorkingHoursRow>()
  for (const wh of raw.workingHours) workingHoursByDow.set(wh.weekday, wh)
  const hoursConfigured = raw.workingHours.length > 0

  // Weekly shifts y breaks por empleado para evitar recorrer todo cada día.
  const shiftsByEmployee = groupBy(raw.weeklyShifts, (r) => r.employee_id)
  const breaksByEmployee = groupBy(raw.recurringBreaks, (r) => r.employee_id)
  const timeOffByEmployee = groupBy(raw.timeOff, (r) => r.employee_id)
  const bookingsByEmployee = groupBy(raw.bookingItems, (r) => r.employee_id)

  // Capa transversal (8): índice de booking_items por service_id para chequear
  // capacidad concurrente sin volver a la BD.
  const bookingsByService = groupBy(raw.bookingItems, (r) => r.service_id)

  // Modo "any": carga diaria por (employee, fecha local) — para repartir justo.
  const loadByEmployeeByDay = computeLoadByEmployeeByDay(raw.bookingItems)

  // Candidatos por empleado.
  type Candidate = Interval & { employeeId: number }
  const candidates: Candidate[] = []

  for (const emp of raw.employees) {
    const empShifts = shiftsByEmployee.get(emp.id) ?? []
    const empBreaks = breaksByEmployee.get(emp.id) ?? []
    const empTimeOff = (timeOffByEmployee.get(emp.id) ?? []).map(
      (r) => r.interval,
    )
    const empBookings = (bookingsByEmployee.get(emp.id) ?? []).map(
      (r) => r.interval,
    )

    // 1. Base: weekly schedule ∩ working hours del salón, día por día.
    const base: Interval[] = []
    for (const date of days) {
      const dow = isoWeekdayFromLocalDate(date)
      const shifts = expandWeeklyOnDate(empShifts, dow, date)
      if (shifts.length === 0) continue
      const wh = workingHoursByDow.get(dow)
      if (hoursConfigured) {
        if (!wh) continue // sin fila para este día → salón cerrado
        if (!wh.opens_at || !wh.closes_at) continue // día marcado como cerrado
        const whInterval: Interval = {
          start: madridLocalDateTimeToUtc(date, wh.opens_at),
          end: madridLocalDateTimeToUtc(date, wh.closes_at),
        }
        base.push(...intersect(shifts, [whInterval]))
      } else {
        base.push(...shifts)
      }
    }

    // 2. Restar descansos.
    const breaksIntervals = expandBreaks(empBreaks, days)
    let avail = subtract(base, breaksIntervals)

    // 3. Time-off.
    avail = subtract(avail, empTimeOff)

    // 4. Closures.
    avail = subtract(
      avail,
      raw.closures.map((c) => c.interval),
    )

    // 5. Reservas existentes del empleado.
    avail = subtract(avail, empBookings)

    // 6. Antelación min/max.
    avail = intersect(avail, [anticipationWindow])

    // 7. Trocear en slots.
    const slots = chunkBySlot(avail, duration, granularity)
    for (const s of slots) {
      candidates.push({ start: s.start, end: s.end, employeeId: emp.id })
    }
  }

  // 8. Capacidad concurrente: si max_concurrent != null, descartar slots que
  //    superan capacity al sumarles las reservas existentes del mismo servicio.
  const cap = raw.service.max_concurrent
  let filtered = candidates
  if (cap !== null) {
    const sameService = bookingsByService.get(raw.service.id) ?? []
    filtered = candidates.filter((c) => {
      const overlaps = countOverlaps(
        sameService.map((b) => b.interval),
        c,
      )
      return overlaps < cap
    })
  }

  // 9. Resolución "any": agrupar por (start,end) y elegir empleado.
  let finalSlots: AvailableSlot[]
  if (input.employeeFilter === 'any') {
    const employeeById = new Map(raw.employees.map((e) => [e.id, e]))
    const byKey = new Map<string, number[]>()
    for (const c of filtered) {
      const key = `${c.start.getTime()}|${c.end.getTime()}`
      const arr = byKey.get(key) ?? []
      arr.push(c.employeeId)
      byKey.set(key, arr)
    }
    finalSlots = []
    for (const [key, empIds] of byKey) {
      const [startMsStr] = key.split('|')
      const startMs = Number(startMsStr)
      const localDate = madridLocalDateOf(new Date(startMs))
      const picked = pickEmployee(
        empIds,
        employeeById,
        loadByEmployeeByDay,
        localDate,
      )
      const cand = filtered.find(
        (c) => c.start.getTime() === startMs && c.employeeId === picked,
      )!
      finalSlots.push({
        startsAt: cand.start.toISOString(),
        endsAt: cand.end.toISOString(),
        employeeId: picked,
      })
    }
  } else {
    finalSlots = filtered.map((c) => ({
      startsAt: c.start.toISOString(),
      endsAt: c.end.toISOString(),
      employeeId: c.employeeId,
    }))
  }

  // 10. Ordenar por startsAt.
  finalSlots.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return finalSlots
}

// ─── Picking de empleado en modo "any" ─────────────────────────────────────
// Criterio: menos carga ese día local Madrid. Desempate determinista por
// display_order ASC, luego id ASC. Aislado para poder cambiarlo fácil
// (round-robin, priorizar al menos cargado del rango, etc.).
function pickEmployee(
  candidates: number[],
  employeeById: Map<number, EmployeeRow>,
  loadByEmployeeByDay: Map<string, number>,
  localDate: string,
): number {
  let bestId = -1
  let bestLoad = Number.POSITIVE_INFINITY
  let bestOrder = Number.POSITIVE_INFINITY
  for (const id of candidates) {
    const load = loadByEmployeeByDay.get(`${id}|${localDate}`) ?? 0
    const emp = employeeById.get(id)
    const order = emp?.display_order ?? Number.POSITIVE_INFINITY
    if (
      load < bestLoad ||
      (load === bestLoad && order < bestOrder) ||
      (load === bestLoad && order === bestOrder && id < bestId)
    ) {
      bestId = id
      bestLoad = load
      bestOrder = order
    }
  }
  return bestId
}

function computeLoadByEmployeeByDay(
  bookings: AvailabilityRawData['bookingItems'],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const b of bookings) {
    const localDate = madridLocalDateOf(b.interval.start)
    const key = `${b.employee_id}|${localDate}`
    out.set(key, (out.get(key) ?? 0) + 1)
  }
  return out
}

// ─── Helpers internos ──────────────────────────────────────────────────────

function expandWeeklyOnDate(
  shifts: WeeklyShiftRow[],
  dow: number,
  date: string,
): Interval[] {
  const out: Interval[] = []
  for (const s of shifts) {
    if (s.weekday !== dow) continue
    if (s.effective_from > date) continue
    if (s.effective_until && s.effective_until < date) continue
    out.push({
      start: madridLocalDateTimeToUtc(date, s.starts_at),
      end: madridLocalDateTimeToUtc(date, s.ends_at),
    })
  }
  return normalize(out)
}

function expandBreaks(breaks: RecurringBreakRow[], days: string[]): Interval[] {
  const out: Interval[] = []
  for (const date of days) {
    const dow = isoWeekdayFromLocalDate(date)
    for (const b of breaks) {
      if (b.weekday !== dow) continue
      if (b.effective_from > date) continue
      if (b.effective_until && b.effective_until < date) continue
      out.push({
        start: madridLocalDateTimeToUtc(date, b.starts_at),
        end: madridLocalDateTimeToUtc(date, b.ends_at),
      })
    }
  }
  return normalize(out)
}

function countOverlaps(holes: Interval[], slot: Interval): number {
  let n = 0
  const s = slot.start.getTime()
  const e = slot.end.getTime()
  for (const h of holes) {
    if (h.start.getTime() < e && h.end.getTime() > s) n++
  }
  return n
}

function groupBy<T, K>(list: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const item of list) {
    const k = keyFn(item)
    const arr = m.get(k) ?? []
    arr.push(item)
    m.set(k, arr)
  }
  return m
}
