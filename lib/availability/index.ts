import 'server-only'
import { computeAvailability } from './engine'
import { fetchAvailabilityData } from './queries'
import { madridLocalDateTimeToUtc } from './time'
import type { AvailabilityInput, AvailableSlot } from './types'

export type { AvailabilityInput, AvailableSlot } from './types'
export { groupSlotsByLocalDate } from './group'

// Punto de entrada del motor. Devuelve los slots disponibles para el input dado.
// `opts.now` es inyectable para QA manual de casos con fechas concretas (p.ej. DST).
export async function getAvailableSlots(
  input: AvailabilityInput,
  opts?: { now?: Date },
): Promise<AvailableSlot[]> {
  if (input.to < input.from) return []

  // Rango UTC absoluto del intervalo [00:00 local from, 00:00 local (to+1día)).
  // Es el filtro `during && rango` para reservas, time-off y closures.
  const rangeStartUtc = madridLocalDateTimeToUtc(input.from, '00:00')
  const dayAfterTo = nextDay(input.to)
  const rangeEndUtc = madridLocalDateTimeToUtc(dayAfterTo, '00:00')

  const raw = await fetchAvailabilityData({
    salonId: input.salonId,
    serviceId: input.serviceId,
    employeeFilter: input.employeeId,
    from: input.from,
    to: input.to,
    rangeStartUtc,
    rangeEndUtc,
  })
  if (!raw) return []

  const now = opts?.now ?? new Date()
  return computeAvailability(
    raw,
    { from: input.from, to: input.to, employeeFilter: input.employeeId },
    now,
  )
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + 1)
  const yy = t.getUTCFullYear()
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(t.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
