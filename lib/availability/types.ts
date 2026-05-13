// Tipos públicos del motor de disponibilidad.
// Toda hora externa al motor se mueve como ISO UTC (string) o Date UTC.
// `Interval` es estructura interna: half-open [start, end), coherente con tstzrange '[)'.

export type Interval = {
  start: Date
  end: Date
}

export type AvailabilityInput = {
  salonId: number
  serviceId: number
  // Si es 'any', el motor elige el empleado por cada hueco según pickEmployee().
  employeeId: number | 'any'
  // Rango de búsqueda en fecha local del salón. 'to' es inclusive a nivel de día.
  from: string // 'YYYY-MM-DD'
  to: string // 'YYYY-MM-DD'
}

export type AvailableSlot = {
  startsAt: string // ISO UTC
  endsAt: string // ISO UTC
  employeeId: number
}
