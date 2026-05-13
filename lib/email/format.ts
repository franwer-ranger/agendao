import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

// Formato largo es-ES para emails: "lunes, 15 de junio · 10:30"
export function formatBookingDateTime(
  isoUtc: string,
  timezone: string,
): string {
  const date = formatInTimeZone(isoUtc, timezone, 'EEEE, d \'de\' MMMM', {
    locale: es,
  })
  const time = formatInTimeZone(isoUtc, timezone, 'HH:mm', { locale: es })
  return `${capitalize(date)} · ${time}`
}

export function formatBookingDate(isoUtc: string, timezone: string): string {
  return capitalize(
    formatInTimeZone(isoUtc, timezone, 'EEEE, d \'de\' MMMM \'de\' yyyy', {
      locale: es,
    }),
  )
}

export function formatBookingTime(isoUtc: string, timezone: string): string {
  return formatInTimeZone(isoUtc, timezone, 'HH:mm', { locale: es })
}

export function formatPriceEur(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}
