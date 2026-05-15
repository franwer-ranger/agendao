'use client'

import type {
  CalendarBlock,
  CalendarBookingItem,
} from '@/lib/bookings/queries-calendar'
import type { BookingStatus } from '@/lib/bookings/status'
import {
  addDaysIsoLocal,
  formatSalonTime,
  minutesFromSalonMidnight,
  salonDateToUtc,
  salonToday,
} from '@/lib/time'
import type { EmployeeOption } from './calendar-shell'
import { NowMarker } from './now-marker'
import { useCurrentMinute } from './use-current-minute'

const DAY_START_MIN = 8 * 60
const DAY_END_MIN = 22 * 60
const PX_PER_MIN = 1.2
const TOP_PAD_PX = 12

const WD_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_FMT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
})

export function CalendarWeekView({
  startDate,
  employee,
  bookings,
  blocks,
  onBookingClick,
  salonTimezone,
}: {
  startDate: string
  employee: EmployeeOption | null
  bookings: CalendarBookingItem[]
  blocks: CalendarBlock[]
  onBookingClick: (bookingId: number) => void
  salonTimezone: string
}) {
  useCurrentMinute()

  if (!employee) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        Selecciona un empleado en el filtro para ver su semana.
      </p>
    )
  }

  const totalMin = DAY_END_MIN - DAY_START_MIN
  const gridHeight = totalMin * PX_PER_MIN + TOP_PAD_PX

  const now = new Date()
  const today = salonToday(now, salonTimezone)
  const nowLabel = formatSalonTime(now.toISOString(), salonTimezone)
  const nowMinAbsolute = minutesFromSalonMidnight(
    now.toISOString(),
    today,
    salonTimezone,
  )
  const nowOffset =
    nowMinAbsolute >= DAY_START_MIN && nowMinAbsolute <= DAY_END_MIN
      ? TOP_PAD_PX + (nowMinAbsolute - DAY_START_MIN) * PX_PER_MIN
      : null

  const days = Array.from({ length: 7 }, (_, i) =>
    addDaysIsoLocal(startDate, i),
  )

  const employeeBookings = bookings.filter((b) => b.employeeId === employee.id)
  const employeeBlocks = blocks.filter((b) => b.employeeId === employee.id)

  const hourLines: number[] = []
  for (
    let h = Math.floor(DAY_START_MIN / 60);
    h <= Math.floor(DAY_END_MIN / 60);
    h++
  ) {
    hourLines.push(h)
  }

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: '4rem repeat(7, minmax(140px, 1fr))' }}
    >
      {/* Header */}
      <div className="sticky left-0 z-10 border-b bg-card" />
      {days.map((d, i) => {
        const [y, m, dd] = d.split('-').map(Number)
        const isToday = d === today
        return (
          <div
            key={d}
            className={`flex flex-col items-center gap-0.5 border-b border-l p-2 ${isToday ? 'bg-accent/40' : ''}`}
          >
            <span className="text-[10px] uppercase text-muted-foreground">
              {WD_LABEL[i]}
            </span>
            <span
              className={`text-sm tabular-nums ${isToday ? 'font-semibold' : ''}`}
            >
              {DAY_FMT.format(new Date(y, m - 1, dd))}
            </span>
          </div>
        )
      })}

      {/* Hours rail */}
      <div
        className="sticky left-0 z-10 border-r bg-card"
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

      {/* Columnas por día */}
      {days.map((d) => {
        const isToday = d === today
        const dayStart = salonDateToUtc(d, salonTimezone).getTime()
        const dayEnd = salonDateToUtc(
          addDaysIsoLocal(d, 1),
          salonTimezone,
        ).getTime()
        const dayBookings = employeeBookings.filter((b) => {
          const s = new Date(b.startsAt).getTime()
          return s >= dayStart && s < dayEnd
        })
        const dayBlocks = employeeBlocks.filter((b) => {
          const s = new Date(b.startsAt).getTime()
          const e = new Date(b.endsAt).getTime()
          return e > dayStart && s < dayEnd
        })

        return (
          <div
            key={d}
            className={`relative border-l ${isToday ? 'bg-accent/10' : ''}`}
            style={{ height: gridHeight, paddingTop: TOP_PAD_PX }}
          >
            {hourLines.map((h) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/60"
                style={{
                  top: TOP_PAD_PX + (h * 60 - DAY_START_MIN) * PX_PER_MIN,
                }}
              />
            ))}

            {dayBlocks.map((b) => {
              const pos = positionInDay(b.startsAt, b.endsAt, d)
              if (!pos) return null
              return (
                <div
                  key={`block-${b.id}-${d}`}
                  className="absolute inset-x-1 select-none rounded-sm border border-muted-foreground/30 bg-[repeating-linear-gradient(45deg,_var(--muted)_0_6px,_transparent_6px_12px)] p-1 text-[10px] text-muted-foreground"
                  style={{ top: pos.top, height: pos.height }}
                  title={b.reason + (b.note ? ` — ${b.note}` : '')}
                >
                  Bloqueo
                </div>
              )
            })}

            {dayBookings.map((b) => {
              const pos = positionInDay(b.startsAt, b.endsAt, d)
              if (!pos) return null
              return (
                <BookingMini
                  key={`b-${b.itemId}`}
                  booking={b}
                  color={employee.color_hex}
                  top={pos.top}
                  height={pos.height}
                  onClick={() => onBookingClick(b.bookingId)}
                />
              )
            })}

            {/* Línea "ahora" solo en la columna del día actual. El pill se
                muestra aquí también, sobre la línea, para no depender del
                rail (que ya tiene su propia escala). */}
            {isToday && nowOffset !== null ? (
              <NowMarker top={nowOffset} label={nowLabel} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function BookingMini({
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
  const bg = color ?? '#64748b'
  const opacity = statusOpacity(booking.status)
  const striped =
    booking.status === 'cancelled_client' ||
    booking.status === 'cancelled_salon' ||
    booking.status === 'no_show'

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-x-1 select-none overflow-hidden rounded-sm border px-1 py-0.5 text-left text-[10px] leading-tight text-white shadow-sm transition hover:brightness-110"
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
      <div className="font-semibold truncate">
        {formatSalonTime(booking.startsAt)} {booking.serviceName}
      </div>
      <div className="truncate opacity-90">{booking.clientName}</div>
    </button>
  )
}

function statusOpacity(s: BookingStatus): number {
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
    height: Math.max(14, (visibleEnd - visibleStart) * PX_PER_MIN),
  }
}
