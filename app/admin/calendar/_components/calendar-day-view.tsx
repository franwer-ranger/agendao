'use client'

import type {
  CalendarBlock,
  CalendarBookingItem,
  CalendarBookingStatus,
} from '@/lib/bookings/queries-calendar'
import {
  formatSalonTime,
  minutesFromSalonMidnight,
  salonToday,
} from '@/lib/time'
import type { EmployeeOption } from './calendar-shell'
import { NowMarker } from './now-marker'
import { useCurrentMinute } from './use-current-minute'

// Rango horario visible. Coincide con un horario realista de salón.
// Cuando conectemos `salon_working_hours` se podrá ajustar dinámicamente.
const DAY_START_MIN = 8 * 60 // 08:00
const DAY_END_MIN = 23.5 * 60 // 23:30
const PX_PER_MIN = 1.2 // 60min ≈ 72px

const ACTIVE_STATUSES: CalendarBookingStatus[] = [
  'pending',
  'confirmed',
  'in_progress',
]

// Padding superior dentro del rail / columnas para que el primer label de
// horas no se solape con el header.
const TOP_PAD_PX = 16

export function CalendarDayView({
  date,
  employees,
  bookings,
  blocks,
  onBookingClick,
  salonTimezone,
}: {
  date: string
  employees: EmployeeOption[]
  bookings: CalendarBookingItem[]
  blocks: CalendarBlock[]
  onBookingClick: (bookingId: number) => void
  salonTimezone: string
}) {
  const totalMin = DAY_END_MIN - DAY_START_MIN
  const gridHeight = totalMin * PX_PER_MIN + TOP_PAD_PX

  // Tick por minuto para que la "línea ahora" siga al reloj sin recarga.
  useCurrentMinute()
  const now = new Date()
  const showNow = salonToday(now, salonTimezone) === date
  const nowOffset = showNow ? computeNowOffset(date, salonTimezone, now) : null
  const nowLabel = showNow
    ? formatSalonTime(now.toISOString(), salonTimezone)
    : ''

  // Hours rail: una línea cada hora.
  const hourLines: number[] = []
  for (
    let h = Math.floor(DAY_START_MIN / 60);
    h <= Math.floor(DAY_END_MIN / 60);
    h++
  ) {
    hourLines.push(h)
  }

  if (employees.length === 0) {
    return (
      <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        Selecciona al menos un empleado para ver el calendario.
      </p>
    )
  }

  const gridTemplateColumns = `4rem repeat(${employees.length}, minmax(180px, 1fr))`

  return (
    <div>
      {/* Encabezado: empleados (grid separado para que el NowMarker pueda
          extenderse a lo ancho del body sin pisar el header). */}
      <div className="grid border-b" style={{ gridTemplateColumns }}>
        <div className="sticky left-0 z-10 bg-card" />
        {employees.map((e) => (
          <div key={e.id} className="flex items-center gap-2 border-l p-2">
            <span
              aria-hidden
              className="size-2.5 rounded-full border"
              style={{ backgroundColor: e.color_hex ?? 'transparent' }}
            />
            <span className="text-sm font-medium truncate">
              {e.display_name}
            </span>
          </div>
        ))}
      </div>

      {/* Body: rail + columnas. Relative para alojar el NowMarker. */}
      <div className="relative grid" style={{ gridTemplateColumns }}>
        {/* Hours rail */}
        <div
          className="sticky left-0 z-10 bg-card"
          style={{ height: gridHeight, paddingTop: TOP_PAD_PX }}
        >
          {hourLines.map((h) => (
            <div
              key={h}
              className="absolute -translate-y-1/2 pr-2 text-right text-[10px] text-muted-foreground tabular-nums"
              style={{
                top: TOP_PAD_PX + (h * 60 - DAY_START_MIN) * PX_PER_MIN,
                right: 0,
              }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Columnas por empleado */}
        {employees.map((e) => {
          const employeeBookings = bookings.filter((b) => b.employeeId === e.id)
          const employeeBlocks = blocks.filter((b) => b.employeeId === e.id)
          return (
            <div
              key={e.id}
              className="relative border-l"
              style={{ height: gridHeight, paddingTop: TOP_PAD_PX }}
            >
              {/* Líneas horizontales */}
              {hourLines.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{
                    top: TOP_PAD_PX + (h * 60 - DAY_START_MIN) * PX_PER_MIN,
                  }}
                />
              ))}

              {/* Bloques (employee_time_off) */}
              {employeeBlocks.map((b) => {
                const pos = positionInDay(b.startsAt, b.endsAt, date)
                if (!pos) return null
                return (
                  <div
                    key={`block-${b.id}`}
                    className="absolute inset-x-1 rounded-sm border border-muted-foreground/30 bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,transparent_6px_12px)] p-1 text-[10px] text-muted-foreground"
                    style={{ top: pos.top, height: pos.height }}
                    title={b.reason + (b.note ? ` — ${b.note}` : '')}
                  >
                    <div className="font-medium">Bloqueo</div>
                    <div className="opacity-80">{b.reason}</div>
                  </div>
                )
              })}

              {/* Eventos */}
              {employeeBookings.map((b) => {
                const pos = positionInDay(b.startsAt, b.endsAt, date)
                if (!pos) return null
                return (
                  <BookingBlock
                    key={`b-${b.itemId}`}
                    booking={b}
                    color={e.color_hex}
                    top={pos.top}
                    height={pos.height}
                    onClick={() => onBookingClick(b.bookingId)}
                  />
                )
              })}
            </div>
          )
        })}

        {/* Línea "ahora": cruza todo el body, con pill sobre el rail. */}
        {nowOffset !== null ? (
          <NowMarker top={nowOffset} label={nowLabel} />
        ) : null}
      </div>
    </div>
  )
}

function BookingBlock({
  booking,
  color,
  top,
  height,
  onClick,
}: {
  booking: CalendarBookingItem
  color: string | null
  top: number
  height: number
  onClick: () => void
}) {
  const isActive = ACTIVE_STATUSES.includes(booking.status)
  const fallback = '#64748b'
  const bg = color ?? fallback
  const opacity = statusOpacity(booking.status)
  const striped =
    booking.status === 'cancelled_client' ||
    booking.status === 'cancelled_salon' ||
    booking.status === 'no_show'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute inset-x-1 overflow-hidden rounded-sm border px-1.5 py-1 text-left text-[11px] leading-tight text-white shadow-sm transition hover:brightness-110 ${
        booking.status === 'in_progress'
          ? 'ring-2 ring-offset-1 ring-amber-300 animate-pulse'
          : ''
      }`}
      style={{
        top,
        height,
        backgroundColor: bg,
        opacity,
        backgroundImage: striped
          ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.25) 0 4px, transparent 4px 8px)'
          : undefined,
        borderColor: 'rgba(0,0,0,0.15)',
      }}
      title={`${booking.serviceName} — ${booking.clientName}\n${formatSalonTime(booking.startsAt)}–${formatSalonTime(booking.endsAt)}`}
    >
      <div className="font-semibold truncate">{booking.serviceName}</div>
      <div className="truncate opacity-90">{booking.clientName}</div>
      {height > 30 ? (
        <div className="opacity-80 tabular-nums">
          {formatSalonTime(booking.startsAt)}–{formatSalonTime(booking.endsAt)}
        </div>
      ) : null}
      {!isActive ? (
        <div className="opacity-90 italic">
          {STATUS_LABEL[booking.status] ?? booking.status}
        </div>
      ) : null}
    </button>
  )
}

const STATUS_LABEL: Partial<Record<CalendarBookingStatus, string>> = {
  completed: 'Completada',
  cancelled_client: 'Cancelada (cliente)',
  cancelled_salon: 'Cancelada (salón)',
  no_show: 'No-show',
  in_progress: 'En curso',
  pending: 'Pendiente',
}

function statusOpacity(s: CalendarBookingStatus): number {
  switch (s) {
    case 'completed':
      return 0.65
    case 'cancelled_client':
    case 'cancelled_salon':
    case 'no_show':
      return 0.45
    default:
      return 1
  }
}

// Calcula top/height en px dentro de la grid del día.
// Si el evento empieza antes del rango visible o termina después, se recorta.
function positionInDay(
  startsAt: string,
  endsAt: string,
  date: string,
): { top: number; height: number } | null {
  const startMin = minutesFromSalonMidnight(startsAt, date)
  const endMin = minutesFromSalonMidnight(endsAt, date)
  const visibleStart = Math.max(startMin, DAY_START_MIN)
  const visibleEnd = Math.min(endMin, DAY_END_MIN)
  if (visibleEnd <= visibleStart) return null
  return {
    top: TOP_PAD_PX + (visibleStart - DAY_START_MIN) * PX_PER_MIN,
    height: Math.max(18, (visibleEnd - visibleStart) * PX_PER_MIN),
  }
}

function computeNowOffset(date: string, tz: string, now: Date): number | null {
  const nowMin = minutesFromSalonMidnight(now.toISOString(), date, tz)
  if (nowMin < DAY_START_MIN || nowMin > DAY_END_MIN) return null
  return TOP_PAD_PX + (nowMin - DAY_START_MIN) * PX_PER_MIN
}
