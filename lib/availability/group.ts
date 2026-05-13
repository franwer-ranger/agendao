import type { AvailableSlot } from './types'

// Agrupa slots por fecha local del salón ('YYYY-MM-DD'). Las claves del Map
// están ordenadas por fecha ascendente (insertion order). El consumidor habitual
// es la UI pública de reserva: el motor devuelve un array plano de slots y la
// vista los pinta por día. La timezone se pasa explícita para no asumir Madrid.
export function groupSlotsByLocalDate(
  slots: AvailableSlot[],
  timezone: string,
): Map<string, AvailableSlot[]> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const byDate = new Map<string, AvailableSlot[]>()
  for (const slot of slots) {
    const date = fmt.format(new Date(slot.startsAt))
    const bucket = byDate.get(date)
    if (bucket) bucket.push(slot)
    else byDate.set(date, [slot])
  }
  return byDate
}
