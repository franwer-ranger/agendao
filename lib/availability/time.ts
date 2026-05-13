// Helpers de hora local Madrid → UTC, DST-aware, sin dependencias externas.
// Mismo patrón que lib/time.ts: resolvemos el offset real consultando
// Intl.DateTimeFormat sobre Europe/Madrid en el instante concreto.

const SALON_TZ = 'Europe/Madrid'

// Convierte 'YYYY-MM-DD' (fecha local Madrid) + 'HH:MM' (hora local Madrid) a Date UTC.
// Si la hora local no existe (salto de marzo) o existe dos veces (vuelta de octubre),
// Intl resuelve a una de ellas de forma determinista. En la práctica los horarios del
// salón empiezan a las 09:00+ así que esto no aplica.
export function madridLocalDateTimeToUtc(date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  const asIfUtc = Date.UTC(y, m - 1, d, hh, mm, 0)

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

// Día ISO de la semana (1..7, lunes=1) de una fecha local 'YYYY-MM-DD'.
// No depende de TZ: la fecha calendario coincide con la fecha local del salón.
export function isoWeekdayFromLocalDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return dow === 0 ? 7 : dow
}

// Devuelve 'YYYY-MM-DD' (fecha local Madrid) en la que cae un instante UTC.
export function madridLocalDateOf(instant: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(instant)
}

// Itera fechas 'YYYY-MM-DD' inclusivas desde `from` hasta `to`.
export function iterateLocalDates(from: string, to: string): string[] {
  const out: string[] = []
  let cursor = from
  while (cursor <= to) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + days)
  const yy = t.getUTCFullYear()
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(t.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
