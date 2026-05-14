// Mapeo de errores de Postgres (triggers + EXCLUDE constraint) a códigos
// estables que la UI puede traducir. El mensaje por defecto está en español
// porque es la lengua del producto; si más adelante hacemos i18n, lo movemos.

export type BookingErrorCode =
  | 'EMPLOYEE_OVERLAP'
  | 'OUTSIDE_SCHEDULE'
  | 'OVERLAPS_BREAK'
  | 'OVERLAPS_TIME_OFF'
  | 'OVERLAPS_CLOSURE'
  | 'OUTSIDE_SALON_HOURS'
  | 'EMPLOYEE_NOT_AUTHORIZED'
  | 'SPANS_MULTIPLE_DAYS'
  | 'CAPACITY_EXCEEDED'
  | 'SALON_MISMATCH'
  | 'WORKING_HOURS'
  | 'TOO_CLOSE_TO_NOW'
  | 'UNKNOWN'

export type BookingError = {
  code: BookingErrorCode
  message: string
}

// Supabase JS devuelve PostgrestError con `code` (SQLSTATE) y `message`.
// Los triggers de bloque 1 hacen RAISE EXCEPTION con texto fijo; ese texto
// aparece en `message` cuando code = 'P0001'.
type PgLikeError = { code?: string | null; message?: string | null }

export function mapBookingError(err: PgLikeError): BookingError {
  const code = err.code ?? ''
  const msg = err.message ?? ''

  // 23P01 — exclusion_violation: EXCLUDE constraint del booking_items.
  if (code === '23P01') {
    return {
      code: 'EMPLOYEE_OVERLAP',
      message: 'Ese empleado ya tiene una reserva en ese horario.',
    }
  }

  // 23514 — check_violation: lo usa booking_items_check_capacity.
  if (code === '23514' && /capacity_exceeded/i.test(msg)) {
    return {
      code: 'CAPACITY_EXCEEDED',
      message: 'No hay disponibilidad para ese servicio en ese horario.',
    }
  }

  // P0001 — RAISE EXCEPTION del trigger booking_items_validate.
  if (code === 'P0001') {
    if (/booking_outside_schedule/i.test(msg))
      return {
        code: 'OUTSIDE_SCHEDULE',
        message: 'Fuera del horario del empleado.',
      }
    if (/booking_overlaps_break/i.test(msg))
      return { code: 'OVERLAPS_BREAK', message: 'Coincide con un descanso.' }
    if (/booking_overlaps_time_off/i.test(msg))
      return { code: 'OVERLAPS_TIME_OFF', message: 'El empleado está ausente.' }
    if (/booking_overlaps_closure/i.test(msg))
      return { code: 'OVERLAPS_CLOSURE', message: 'El salón está cerrado.' }
    if (/booking_outside_salon_hours/i.test(msg))
      return {
        code: 'OUTSIDE_SALON_HOURS',
        message: 'La hora elegida está fuera del horario del salón.',
      }
    if (/employee_not_authorized_for_service/i.test(msg))
      return {
        code: 'EMPLOYEE_NOT_AUTHORIZED',
        message: 'Ese empleado no realiza este servicio.',
      }
    if (/booking_spans_multiple_days/i.test(msg))
      return {
        code: 'SPANS_MULTIPLE_DAYS',
        message: 'La reserva no puede cruzar de un día al siguiente.',
      }
    if (/booking_too_close_to_now/i.test(msg))
      return {
        code: 'TOO_CLOSE_TO_NOW',
        message: 'Ese horario ya está demasiado cerca para reservar online.',
      }
    if (/_salon_mismatch/i.test(msg))
      return {
        code: 'SALON_MISMATCH',
        message: 'Datos inconsistentes (empleado/servicio de otro salón).',
      }
    if (/service_capacity_exceeded/i.test(msg))
      return {
        code: 'CAPACITY_EXCEEDED',
        message: 'No hay disponibilidad para ese servicio en ese horario.',
      }
  }

  return {
    code: 'UNKNOWN',
    message: msg || 'Error desconocido al crear la reserva.',
  }
}
