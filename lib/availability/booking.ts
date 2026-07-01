import 'server-only'
import {
  and,
  count,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  booking_items,
  booking_status_events,
  bookings,
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
import { BookingValidationError, type BookingErrorCode } from './errors'
import { madridLocalDateOf, madridLocalTimeOf } from './time'

export type CreateBookingInput = {
  salonId: number
  serviceId: number
  employeeId: number
  clientId: number
  // Instante UTC del inicio del servicio.
  startsAt: string
  source?: 'web' | 'admin' | 'phone' | 'walk_in'
  clientNote?: string | null
  idempotencyKey?: string | null
}

export type CreateBookingResult =
  | { ok: true; bookingId: number; publicId: string }
  | { ok: false; code: BookingErrorCode; message: string }

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress'] as const

type ValidatedSnapshot = {
  service: {
    id: number
    salon_id: number
    name: string
    duration_minutes: number
    price_cents: number
    color_hex: string | null
    max_concurrent: number | null
    is_active: boolean
  }
  salon: {
    id: number
    timezone: string
    booking_min_hours_ahead: number
  }
}

export type ValidateBookingItemIntervalInput = {
  salonId: number
  serviceId: number
  employeeId: number
  startsAt: Date
  endsAt: Date
  source: 'web' | 'admin' | 'phone' | 'walk_in'
  excludeItemId?: number
  now?: Date
}

// Replica TS de los triggers de Postgres `booking_items_validate`,
// `booking_items_check_capacity`, `booking_items_check_min_hours_ahead` y
// del EXCLUDE GIST por empleado activo. Lanza BookingValidationError con el
// código del contrato. Devuelve service+salon ya cargados para que el caller
// no los relea.
export async function validateBookingItemInterval(
  tx: TxDb,
  input: ValidateBookingItemIntervalInput,
): Promise<ValidatedSnapshot> {
  // 1. service en el salón.
  const service = (
    await tx
      .select({
        id: services.id,
        salon_id: services.salon_id,
        name: services.name,
        duration_minutes: services.duration_minutes,
        price_cents: services.price_cents,
        color_hex: services.color_hex,
        max_concurrent: services.max_concurrent,
        is_active: services.is_active,
      })
      .from(services)
      .where(
        and(
          eq(services.id, input.serviceId),
          eq(services.salon_id, input.salonId),
        ),
      )
      .limit(1)
  )[0]
  if (!service) {
    throw new BookingValidationError(
      'SALON_MISMATCH',
      'Servicio no encontrado en este salón.',
    )
  }
  if (!service.is_active) {
    throw new BookingValidationError(
      'SALON_MISMATCH',
      'Servicio no disponible.',
    )
  }

  // 2. salón.
  const salon = (
    await tx
      .select({
        id: salons.id,
        timezone: salons.timezone,
        booking_min_hours_ahead: salons.booking_min_hours_ahead,
      })
      .from(salons)
      .where(eq(salons.id, input.salonId))
      .limit(1)
  )[0]
  if (!salon) {
    throw new BookingValidationError('SALON_MISMATCH', 'Salón no encontrado.')
  }

  // 3. empleado pertenece al salón.
  const emp = (
    await tx
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.id, input.employeeId),
          eq(employees.salon_id, input.salonId),
        ),
      )
      .limit(1)
  )[0]
  if (!emp) {
    throw new BookingValidationError(
      'SALON_MISMATCH',
      'Empleado no encontrado en este salón.',
    )
  }

  // 4. employee autorizado para el servicio.
  const auth = (
    await tx
      .select({ employee_id: employee_services.employee_id })
      .from(employee_services)
      .where(
        and(
          eq(employee_services.employee_id, input.employeeId),
          eq(employee_services.service_id, input.serviceId),
        ),
      )
      .limit(1)
  )[0]
  if (!auth) {
    throw new BookingValidationError(
      'EMPLOYEE_NOT_AUTHORIZED',
      'Ese empleado no realiza este servicio.',
    )
  }

  // 5. Magnitudes locales.
  const localStartDate = madridLocalDateOf(input.startsAt)
  const localEndDate = madridLocalDateOf(input.endsAt)
  const localStartTime = madridLocalTimeOf(input.startsAt)
  const localEndTime = madridLocalTimeOf(input.endsAt)

  // 6. No cruza medianoche local.
  if (localStartDate !== localEndDate) {
    throw new BookingValidationError(
      'SPANS_MULTIPLE_DAYS',
      'La reserva no puede cruzar de un día al siguiente.',
    )
  }

  // 7. Ventana de antelación mínima (solo source='web').
  if (input.source === 'web' && salon.booking_min_hours_ahead > 0) {
    const now = input.now ?? new Date()
    const minStart =
      now.getTime() + salon.booking_min_hours_ahead * 60 * 60 * 1000
    if (input.startsAt.getTime() < minStart) {
      throw new BookingValidationError(
        'TOO_CLOSE_TO_NOW',
        'Ese horario ya está demasiado cerca para reservar online.',
      )
    }
  }

  // 8. Día ISO 1..7.
  const weekday = isoWeekdayFromYmd(localStartDate)

  // 9. Horario semanal del empleado cubre el intervalo.
  const wsHit = (
    await tx
      .select({ id: employee_weekly_schedule.id })
      .from(employee_weekly_schedule)
      .where(
        and(
          eq(employee_weekly_schedule.employee_id, input.employeeId),
          eq(employee_weekly_schedule.weekday, weekday),
          lte(employee_weekly_schedule.starts_at, localStartTime),
          gte(employee_weekly_schedule.ends_at, localEndTime),
          lte(employee_weekly_schedule.effective_from, localStartDate),
          or(
            isNull(employee_weekly_schedule.effective_until),
            gte(employee_weekly_schedule.effective_until, localStartDate),
          ),
        ),
      )
      .limit(1)
  )[0]
  if (!wsHit) {
    throw new BookingValidationError(
      'OUTSIDE_SCHEDULE',
      'Fuera del horario del empleado.',
    )
  }

  // 10. Horario del salón (si está configurado para este salón).
  const swhRows = await tx
    .select({
      opens_at: salon_working_hours.opens_at,
      closes_at: salon_working_hours.closes_at,
      weekday: salon_working_hours.weekday,
    })
    .from(salon_working_hours)
    .where(eq(salon_working_hours.salon_id, input.salonId))
  if (swhRows.length > 0) {
    const day = swhRows.find((r) => r.weekday === weekday)
    if (!day || day.opens_at === null || day.closes_at === null) {
      throw new BookingValidationError(
        'OUTSIDE_SALON_HOURS',
        'El salón está cerrado ese día.',
      )
    }
    if (localStartTime < day.opens_at || localEndTime > day.closes_at) {
      throw new BookingValidationError(
        'OUTSIDE_SALON_HOURS',
        'La hora elegida está fuera del horario del salón.',
      )
    }
  }

  // 11. Descansos recurrentes (no solape).
  const breakHit = (
    await tx
      .select({ id: employee_recurring_breaks.id })
      .from(employee_recurring_breaks)
      .where(
        and(
          eq(employee_recurring_breaks.employee_id, input.employeeId),
          eq(employee_recurring_breaks.weekday, weekday),
          lte(employee_recurring_breaks.effective_from, localStartDate),
          or(
            isNull(employee_recurring_breaks.effective_until),
            gte(employee_recurring_breaks.effective_until, localStartDate),
          ),
          lt(employee_recurring_breaks.starts_at, localEndTime),
          gt(employee_recurring_breaks.ends_at, localStartTime),
        ),
      )
      .limit(1)
  )[0]
  if (breakHit) {
    throw new BookingValidationError(
      'OVERLAPS_BREAK',
      'Coincide con un descanso.',
    )
  }

  // 12. Time-off del empleado (no solape).
  const timeOffHit = (
    await tx
      .select({ id: employee_time_off.id })
      .from(employee_time_off)
      .where(
        and(
          eq(employee_time_off.employee_id, input.employeeId),
          lt(employee_time_off.starts_at, input.endsAt),
          gt(employee_time_off.ends_at, input.startsAt),
        ),
      )
      .limit(1)
  )[0]
  if (timeOffHit) {
    throw new BookingValidationError(
      'OVERLAPS_TIME_OFF',
      'El empleado está ausente.',
    )
  }

  // 13. Cierres del salón (no solape).
  const closureHit = (
    await tx
      .select({ id: salon_closures.id })
      .from(salon_closures)
      .where(
        and(
          eq(salon_closures.salon_id, input.salonId),
          lt(salon_closures.starts_at, input.endsAt),
          gt(salon_closures.ends_at, input.startsAt),
        ),
      )
      .limit(1)
  )[0]
  if (closureHit) {
    throw new BookingValidationError(
      'OVERLAPS_CLOSURE',
      'El salón está cerrado.',
    )
  }

  // 14. Replica del EXCLUDE GIST: otro booking_item activo del mismo empleado
  //     no puede solapar. excludeItemId permite mover un item sin chocar consigo mismo.
  const employeeOverlapBaseWhere = and(
    eq(booking_items.employee_id, input.employeeId),
    inArray(booking_items.booking_status, [...ACTIVE_BOOKING_STATUSES]),
    lt(booking_items.starts_at, input.endsAt),
    gt(booking_items.ends_at, input.startsAt),
  )
  const employeeOverlapWhere =
    input.excludeItemId === undefined
      ? employeeOverlapBaseWhere
      : and(employeeOverlapBaseWhere, ne(booking_items.id, input.excludeItemId))
  const employeeOverlap = (
    await tx
      .select({ id: booking_items.id })
      .from(booking_items)
      .where(employeeOverlapWhere)
      .limit(1)
  )[0]
  if (employeeOverlap) {
    throw new BookingValidationError(
      'EMPLOYEE_OVERLAP',
      'Ese empleado ya tiene una reserva en ese horario.',
    )
  }

  // 15. Capacidad concurrente del servicio.
  if (service.max_concurrent !== null) {
    const capacityBaseWhere = and(
      eq(booking_items.service_id, input.serviceId),
      inArray(booking_items.booking_status, [...ACTIVE_BOOKING_STATUSES]),
      lt(booking_items.starts_at, input.endsAt),
      gt(booking_items.ends_at, input.startsAt),
    )
    const capacityWhere =
      input.excludeItemId === undefined
        ? capacityBaseWhere
        : and(capacityBaseWhere, ne(booking_items.id, input.excludeItemId))
    const [{ c: cnt = 0 } = { c: 0 }] = await tx
      .select({ c: count() })
      .from(booking_items)
      .where(capacityWhere)
    if (cnt >= service.max_concurrent) {
      throw new BookingValidationError(
        'CAPACITY_EXCEEDED',
        'No hay disponibilidad para ese servicio en ese horario.',
      )
    }
  }

  return { service, salon }
}

function isoWeekdayFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 0 ? 7 : dow
}

function pgErrCode(e: unknown): string | undefined {
  return e instanceof Error && 'code' in e
    ? (e as { code?: string }).code
    : undefined
}

// Crea reserva + booking_item dentro de una transacción única, replicando
// las validaciones que antes hacían los triggers de Postgres.
//
// Idempotency: si `idempotencyKey` está repetida, el INSERT choca con la
// UNIQUE constraint; lo capturamos fuera de la tx y devolvemos la reserva
// original con `ok: true`.
export async function validateAndCreateBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const source = input.source ?? 'web'
  const startsAt = new Date(input.startsAt)

  try {
    const result = await db.transaction(async (tx) => {
      // Necesitamos la duración del servicio antes de validar, así la
      // validación corre el ciclo completo de SELECTs sin race.
      const svc = (
        await tx
          .select({ duration_minutes: services.duration_minutes })
          .from(services)
          .where(
            and(
              eq(services.id, input.serviceId),
              eq(services.salon_id, input.salonId),
            ),
          )
          .limit(1)
      )[0]
      if (!svc) {
        throw new BookingValidationError(
          'SALON_MISMATCH',
          'Servicio no encontrado en este salón.',
        )
      }
      const endsAt = new Date(
        startsAt.getTime() + svc.duration_minutes * 60_000,
      )

      const { service } = await validateBookingItemInterval(tx, {
        salonId: input.salonId,
        serviceId: input.serviceId,
        employeeId: input.employeeId,
        startsAt,
        endsAt,
        source,
      })

      // INSERT bookings (status pending).
      const insertedBookings = await tx
        .insert(bookings)
        .values({
          salon_id: input.salonId,
          client_id: input.clientId,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'pending',
          source,
          client_note: input.clientNote ?? null,
          idempotency_key: input.idempotencyKey ?? null,
        })
        .returning({ id: bookings.id, public_id: bookings.public_id })
      const booking = insertedBookings[0]
      if (!booking) throw new Error('No se pudo crear la reserva.')

      // INSERT booking_items (position 0).
      await tx.insert(booking_items).values({
        booking_id: booking.id,
        salon_id: input.salonId,
        position: 0,
        service_id: input.serviceId,
        employee_id: input.employeeId,
        starts_at: startsAt,
        ends_at: endsAt,
        service_snapshot: {
          name: service.name,
          duration_minutes: service.duration_minutes,
          price_cents: service.price_cents,
          color_hex: service.color_hex,
        },
        booking_status: 'pending',
      })

      // Replica de `bookings_log_status_event` en INSERT.
      await tx.insert(booking_status_events).values({
        booking_id: booking.id,
        salon_id: input.salonId,
        from_status: null,
        to_status: 'pending',
        actor_type: 'system',
        reason: null,
      })

      return { bookingId: booking.id, publicId: booking.public_id }
    })

    return { ok: true, bookingId: result.bookingId, publicId: result.publicId }
  } catch (e) {
    if (e instanceof BookingValidationError) {
      return { ok: false, code: e.code, message: e.message }
    }
    const code = pgErrCode(e)
    // EXCLUDE GIST por empleado activo (concurrencia): el pre-check TS del
    // paso 14 puede pasar y aun así chocar contra otra transacción concurrente.
    if (code === '23P01') {
      return {
        ok: false,
        code: 'EMPLOYEE_OVERLAP',
        message: 'Ese empleado ya tiene una reserva en ese horario.',
      }
    }
    // Trigger de capacidad concurrente del servicio (concurrencia): idem, el
    // pre-check TS del paso 15 puede pasar y aun así chocar bajo carrera.
    if (code === '23514') {
      return {
        ok: false,
        code: 'CAPACITY_EXCEEDED',
        message: 'No hay disponibilidad para ese servicio en ese horario.',
      }
    }
    // Idempotency replay: si el INSERT chocó con la UNIQUE de idempotency_key,
    // devolvemos la reserva original creada antes con la misma key.
    if (code === '23505' && input.idempotencyKey) {
      const existing = (
        await db
          .select({ id: bookings.id, public_id: bookings.public_id })
          .from(bookings)
          .where(eq(bookings.idempotency_key, input.idempotencyKey))
          .limit(1)
      )[0]
      if (existing) {
        return {
          ok: true,
          bookingId: existing.id,
          publicId: existing.public_id,
        }
      }
    }
    return {
      ok: false,
      code: 'UNKNOWN',
      message: (e as Error).message ?? 'Error desconocido al crear la reserva.',
    }
  }
}
