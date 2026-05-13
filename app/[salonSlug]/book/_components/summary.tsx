import {
  formatDuration,
  formatLocalDateLong,
  formatLocalTime,
  formatPriceEUR,
} from '../_lib/format'

type Props = {
  serviceName: string
  durationMinutes: number
  priceCents: number
  employeeName: string
  startsAt: string
  timezone: string
  /** Si vino de "cualquier profesional" mostramos por qué le ha tocado este. */
  fromAnyChoice?: boolean
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}

export function BookingSummary({
  serviceName,
  durationMinutes,
  priceCents,
  employeeName,
  startsAt,
  timezone,
  fromAnyChoice,
}: Props) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl border bg-card p-4 text-sm">
      <dt className="font-medium text-muted-foreground">Servicio</dt>
      <dd className="text-right font-semibold">{serviceName}</dd>

      <dt className="font-medium text-muted-foreground">Duración</dt>
      <dd className="text-right tabular-nums">
        {formatDuration(durationMinutes)}
      </dd>

      <dt className="font-medium text-muted-foreground">Precio</dt>
      <dd className="text-right font-semibold tabular-nums">
        {formatPriceEUR(priceCents)}
      </dd>

      <dt className="font-medium text-muted-foreground">Profesional</dt>
      <dd className="text-right">
        {employeeName}
        {fromAnyChoice ? (
          <span className="ml-1 text-xs text-muted-foreground">(asignado)</span>
        ) : null}
      </dd>

      <dt className="font-medium text-muted-foreground">Cuándo</dt>
      <dd className="text-right">
        {capitalize(formatLocalDateLong(startsAt, timezone))}
        <br />
        <span className="font-semibold tabular-nums">
          {formatLocalTime(startsAt, timezone)}
        </span>
      </dd>
    </dl>
  )
}
