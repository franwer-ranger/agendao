// Helpers de fecha/hora para la zona horaria del salón.
// En v1 está fijada a `Europe/Madrid` (ver PLAN.md). Si en un futuro
// necesitamos soportar otras zonas (Canarias, otro país), las funciones que
// aceptan un argumento `tz` lo hacen explícito y la constante deja de ser
// global; sin cambiar las firmas.

const SALON_TZ = 'Europe/Madrid'

// Convierte una fecha local (YYYY-MM-DD a las 00:00 en la zona del salón) a
// su instante UTC. Resuelve DST consultando el offset real de la zona en ese
// momento.
export function salonDateToUtc(localDate: string, tz: string = SALON_TZ): Date {
  const [y, m, d] = localDate.split('-').map(Number)
  const asIfUtc = Date.UTC(y, m - 1, d, 0, 0, 0)

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
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

  const tzAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  const offsetMs = tzAsUtc - asIfUtc
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

// Fecha actual (YYYY-MM-DD) en la zona del salón. Útil para defaults del
// calendario sin arrastrar la TZ del servidor donde corra Next.
export function salonToday(
  now: Date = new Date(),
  tz: string = SALON_TZ,
): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(now)
}

// Día de la semana ISO (1=Lunes … 7=Domingo) de una fecha local.
export function isoWeekday(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number)
  // getUTCDay devuelve 0=Domingo … 6=Sábado; lo trasladamos a ISO.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 0 ? 7 : dow
}

// Lunes (YYYY-MM-DD) de la semana ISO que contiene `localDate`.
export function startOfIsoWeek(localDate: string): string {
  const wd = isoWeekday(localDate)
  return addDaysIsoLocal(localDate, -(wd - 1))
}

// "HH:MM" en la zona del salón a partir de un ISO UTC.
export function formatSalonTime(iso: string, tz: string = SALON_TZ): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

// "weekday, día de mes" en la zona del salón. Útil para títulos de citas.
export function formatSalonDate(iso: string, tz: string = SALON_TZ): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

// Minutos desde la medianoche local del día indicado. Para posicionar
// eventos en la grid vertical del calendario.
export function minutesFromSalonMidnight(
  iso: string,
  localDate: string,
  tz: string = SALON_TZ,
): number {
  const dayStart = salonDateToUtc(localDate, tz)
  return Math.round((new Date(iso).getTime() - dayStart.getTime()) / 60_000)
}
