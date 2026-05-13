// Helpers de formato para el flujo público de reserva. La TZ del salón se
// pasa explícita para evitar asumir Madrid en componentes reusables.

export function formatPriceEUR(cents: number, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export function formatLocalTime(
  isoUtc: string,
  timezone: string,
  locale = 'es-ES',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoUtc))
}

export function formatLocalDateLong(
  date: Date | string,
  timezone: string,
  locale = 'es-ES',
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
}

// 'YYYY-MM-DD' en la TZ del salón. Útil para sincronizar el day-picker con
// los buckets que devuelve groupSlotsByLocalDate.
export function isoDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
