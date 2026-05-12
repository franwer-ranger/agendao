// Helpers de fecha/hora para Europe/Madrid.
// El proyecto está fijado a `Europe/Madrid` (v1, ver PLAN.md).

const SALON_TZ = 'Europe/Madrid'

// Convierte una fecha local Madrid (YYYY-MM-DD a las 00:00) a su instante UTC.
// Resuelve DST consultando el offset real de Europe/Madrid en ese momento.
export function madridLocalDateToUtc(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number)
  const asIfUtc = Date.UTC(y, m - 1, d, 0, 0, 0)

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: SALON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(asIfUtc))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)

  const madridAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  const offsetMs = madridAsUtc - asIfUtc
  return new Date(asIfUtc - offsetMs)
}

export function addDaysIsoLocal(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + days)
  const yy = t.getUTCFullYear()
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(t.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
