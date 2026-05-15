import { describe, expect, it } from 'vitest'
import { computeAvailability } from '../engine'
import { madridLocalDateTimeToUtc } from '../time'
import type {
  AvailabilityRawData,
  BookingItemRow,
  EmployeeRow,
  SalonRow,
  ServiceRow,
} from '../queries'

// ─── Fixtures base ─────────────────────────────────────────────────────────
// Replicamos el salón demo (Lun–Vie, 09:00–14:00 / 17:00–20:00) con dos
// empleados que pueden hacer todos los servicios. Los tests modifican esta
// base con `withOverrides()` para aislar la regla bajo prueba.

const SALON: SalonRow = {
  id: 1,
  timezone: 'Europe/Madrid',
  slot_granularity_minutes: 15,
  booking_min_hours_ahead: 2,
  booking_max_days_ahead: 60,
}

const SERVICE_60: ServiceRow = {
  id: 100,
  salon_id: 1,
  duration_minutes: 60,
  max_concurrent: null,
  is_active: true,
}

const MARINA: EmployeeRow = {
  id: 10,
  display_name: 'Marina',
  display_order: 0,
  is_active: true,
}

const ANA: EmployeeRow = {
  id: 11,
  display_name: 'Ana',
  display_order: 1,
  is_active: true,
}

// Lun–Vie, dos tramos: 09:00–14:00 y 17:00–20:00, sin expiración.
function weeklyMonFri(employeeId: number) {
  return [1, 2, 3, 4, 5].flatMap((weekday) => [
    {
      employee_id: employeeId,
      weekday,
      starts_at: '09:00',
      ends_at: '14:00',
      effective_from: '2020-01-01',
      effective_until: null,
    },
    {
      employee_id: employeeId,
      weekday,
      starts_at: '17:00',
      ends_at: '20:00',
      effective_from: '2020-01-01',
      effective_until: null,
    },
  ])
}

function baseRaw(): AvailabilityRawData {
  return {
    salon: SALON,
    service: SERVICE_60,
    employees: [MARINA, ANA],
    weeklyShifts: [...weeklyMonFri(MARINA.id), ...weeklyMonFri(ANA.id)],
    recurringBreaks: [],
    workingHours: [],
    timeOff: [],
    closures: [],
    bookingItems: [],
  }
}

// "now" determinista para todos los tests: lunes 18 mayo 2026, 10:00 Madrid.
// Está suficientemente lejos del viernes 22 mayo (4 días, dentro de 2h..60d).
const NOW = madridLocalDateTimeToUtc('2026-05-18', '10:00')

const FRIDAY = '2026-05-22'

// ─── Test 1: regresión bug viernes 19:00 ────────────────────────────────────

describe('computeAvailability — disparidad working_hours parcial (bug viernes 19:00)', () => {
  it('si el salón configura algunos días pero NO el viernes, el viernes no genera slots', () => {
    // Reproducción exacta del bug reportado en mayo 2026: el dueño tenía
    // configuradas working_hours para Lun–Jue pero faltaba la fila del
    // viernes. El motor antiguo "caía al horario del empleado" y devolvía
    // slots; el trigger SQL los rechazaba con `booking_outside_salon_hours`.
    const raw = baseRaw()
    raw.workingHours = [
      // 1=Lun, 2=Mar, 3=Mié, 4=Jue. Sin fila para 5=Vie ni 6/7=findesemana.
      { weekday: 1, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 2, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 3, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 4, opens_at: '09:00', closes_at: '20:00' },
    ]

    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: 'any' },
      NOW,
    )
    expect(slots).toEqual([])
  })

  it('un día con fila pero opens_at/closes_at NULL se trata como cerrado', () => {
    const raw = baseRaw()
    raw.workingHours = [
      { weekday: 1, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 5, opens_at: null, closes_at: null }, // viernes explícitamente cerrado
    ]
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: 'any' },
      NOW,
    )
    expect(slots).toEqual([])
  })

  it('si la tabla de working_hours está vacía, NO se aplica restricción del salón', () => {
    // Estado "instalación recién hecha, dueño todavía no ha configurado nada".
    // El motor usa solo el horario del empleado. Esto coincide con el trigger,
    // que en ese caso también se salta el check.
    const raw = baseRaw()
    raw.workingHours = []
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: 'any' },
      NOW,
    )
    expect(slots.length).toBeGreaterThan(0)
  })
})

// ─── Test 2: el slot del filo del cierre se genera ─────────────────────────

describe('computeAvailability — slot que termina exactamente al cierre', () => {
  it('servicio 60min con turno 17:00–20:00 incluye el slot 19:00 (último)', () => {
    const raw = baseRaw()
    raw.workingHours = [
      // Configuración completa para no entrar en el caso "salón cerrado".
      { weekday: 1, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 2, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 3, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 4, opens_at: '09:00', closes_at: '20:00' },
      { weekday: 5, opens_at: '09:00', closes_at: '20:00' },
    ]
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: MARINA.id },
      NOW,
    )

    // 19:00 Madrid (verano) = 17:00 UTC. Verificamos que está en la lista.
    const has1900 = slots.some(
      (s) => s.startsAt === '2026-05-22T17:00:00.000Z',
    )
    expect(has1900).toBe(true)
    // Y que su `endsAt` cae justo al cierre (20:00 Madrid = 18:00 UTC).
    const slot1900 = slots.find((s) => s.startsAt === '2026-05-22T17:00:00.000Z')!
    expect(slot1900.endsAt).toBe('2026-05-22T18:00:00.000Z')
  })

  it('si working_hours cierra a las 19:00, el slot 19:00 NO se genera', () => {
    const raw = baseRaw()
    raw.workingHours = [{ weekday: 5, opens_at: '09:00', closes_at: '19:00' }]
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: MARINA.id },
      NOW,
    )
    const has1900 = slots.some(
      (s) => s.startsAt === '2026-05-22T17:00:00.000Z',
    )
    expect(has1900).toBe(false)
    // El último slot que cabe (60min) empieza a las 18:00 Madrid = 16:00 UTC.
    const last = slots.at(-1)
    expect(last?.startsAt).toBe('2026-05-22T16:00:00.000Z')
  })
})

// ─── Test 3: reserva existente bloquea el slot ─────────────────────────────

describe('computeAvailability — solape con reservas existentes', () => {
  it('un booking existente del empleado quita ese hueco', () => {
    const raw = baseRaw()
    // Simulamos lo que hace `fetchAvailabilityData` cuando se filtra por
    // empleado concreto: el motor recibe solo ese empleado en `raw.employees`.
    raw.employees = [MARINA]
    raw.weeklyShifts = weeklyMonFri(MARINA.id)
    const booking: BookingItemRow = {
      id: 999,
      employee_id: MARINA.id,
      service_id: SERVICE_60.id,
      interval: {
        start: madridLocalDateTimeToUtc(FRIDAY, '17:00'),
        end: madridLocalDateTimeToUtc(FRIDAY, '18:00'),
      },
    }
    raw.bookingItems = [booking]

    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: MARINA.id },
      NOW,
    )
    // El slot 17:00–18:00 ya no aparece para Marina.
    const has1700 = slots.some(
      (s) => s.startsAt === '2026-05-22T15:00:00.000Z',
    )
    expect(has1700).toBe(false)
  })

  it('en modo "any", si Marina tiene el slot ocupado, Ana cubre el hueco', () => {
    const raw = baseRaw()
    raw.bookingItems = [
      {
        id: 1,
        employee_id: MARINA.id,
        service_id: SERVICE_60.id,
        interval: {
          start: madridLocalDateTimeToUtc(FRIDAY, '17:00'),
          end: madridLocalDateTimeToUtc(FRIDAY, '18:00'),
        },
      },
    ]
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: 'any' },
      NOW,
    )
    const slot1700 = slots.find(
      (s) => s.startsAt === '2026-05-22T15:00:00.000Z',
    )
    expect(slot1700).toBeDefined()
    expect(slot1700!.employeeId).toBe(ANA.id)
  })
})

// ─── Test 4: ventana de antelación ─────────────────────────────────────────

describe('computeAvailability — ventana min/max de antelación', () => {
  it('slots dentro de booking_min_hours_ahead se descartan', () => {
    // Hoy 18 mayo a las 10:00 Madrid; min=2h. Buscamos slots para HOY.
    const raw = baseRaw()
    const slots = computeAvailability(
      raw,
      { from: '2026-05-18', to: '2026-05-18', employeeFilter: MARINA.id },
      NOW,
    )
    // Cualquier slot que empiece antes de 12:00 Madrid (10:00 UTC) está fuera.
    const tooEarly = slots.filter(
      (s) => new Date(s.startsAt).getTime() < NOW.getTime() + 2 * 3_600_000,
    )
    expect(tooEarly).toEqual([])
  })

  it('slots más allá de booking_max_days_ahead se descartan', () => {
    const raw = baseRaw()
    raw.salon = { ...SALON, booking_max_days_ahead: 3 } // ventana corta
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: MARINA.id },
      NOW,
    )
    // NOW = 18 mayo 10:00 Madrid; +3 días = 21 mayo 10:00 Madrid.
    // El viernes 22 está fuera del rango → cero slots.
    expect(slots).toEqual([])
  })
})

// ─── Test 5: descansos y time-off ──────────────────────────────────────────

describe('computeAvailability — descansos recurrentes y time-off', () => {
  it('un descanso recurrente quita el tramo de cada semana', () => {
    const raw = baseRaw()
    raw.employees = [MARINA]
    raw.weeklyShifts = weeklyMonFri(MARINA.id)
    raw.recurringBreaks = [
      {
        employee_id: MARINA.id,
        weekday: 5, // viernes
        starts_at: '18:00',
        ends_at: '18:30',
        effective_from: '2020-01-01',
        effective_until: null,
      },
    ]
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: MARINA.id },
      NOW,
    )
    // Ningún slot puede solapar con [18:00, 18:30) Madrid = [16:00, 16:30) UTC.
    const overlaps = slots.filter((s) => {
      const start = new Date(s.startsAt).getTime()
      const end = new Date(s.endsAt).getTime()
      const breakStart = new Date('2026-05-22T16:00:00Z').getTime()
      const breakEnd = new Date('2026-05-22T16:30:00Z').getTime()
      return start < breakEnd && end > breakStart
    })
    expect(overlaps).toEqual([])
  })

  it('time-off del empleado bloquea todo su tramo', () => {
    const raw = baseRaw()
    raw.employees = [MARINA]
    raw.weeklyShifts = weeklyMonFri(MARINA.id)
    raw.timeOff = [
      {
        employee_id: MARINA.id,
        interval: {
          start: madridLocalDateTimeToUtc(FRIDAY, '00:00'),
          end: madridLocalDateTimeToUtc('2026-05-23', '00:00'),
        },
      },
    ]
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: MARINA.id },
      NOW,
    )
    expect(slots).toEqual([])
  })
})

// ─── Test 6: capacidad concurrente ─────────────────────────────────────────

describe('computeAvailability — max_concurrent', () => {
  it('servicio con max_concurrent=1 saturado por una reserva quita ese slot incluso a otro empleado', () => {
    const raw = baseRaw()
    raw.service = { ...SERVICE_60, max_concurrent: 1 }
    // Marina YA tiene una reserva del servicio a las 17:00 → capacidad llena.
    // Ana sigue libre pero no debe ofrecerse ese slot.
    raw.bookingItems = [
      {
        id: 1,
        employee_id: MARINA.id,
        service_id: SERVICE_60.id,
        interval: {
          start: madridLocalDateTimeToUtc(FRIDAY, '17:00'),
          end: madridLocalDateTimeToUtc(FRIDAY, '18:00'),
        },
      },
    ]
    const slots = computeAvailability(
      raw,
      { from: FRIDAY, to: FRIDAY, employeeFilter: 'any' },
      NOW,
    )
    const slot1700 = slots.find(
      (s) => s.startsAt === '2026-05-22T15:00:00.000Z',
    )
    expect(slot1700).toBeUndefined()
  })
})
