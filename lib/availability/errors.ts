// Códigos estables que la UI traduce. Los lanza la capa de validación TS
// (replica de los antiguos triggers de Postgres) y los consume mapBookingError.

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

export class BookingValidationError extends Error {
  code: BookingErrorCode

  constructor(code: BookingErrorCode, message: string) {
    super(message)
    this.name = 'BookingValidationError'
    this.code = code
  }
}

export function mapBookingError(err: unknown): BookingError {
  if (err instanceof BookingValidationError) {
    return { code: err.code, message: err.message }
  }
  return {
    code: 'UNKNOWN',
    message:
      err instanceof Error ? err.message : 'Error desconocido al crear la reserva.',
  }
}
