'use client'

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import type {
  CalendarBlock,
  CalendarBookingItem,
} from '@/lib/bookings/queries-calendar'
import {
  ACTIVE_BOOKING_STATUSES,
  type BookingStatus,
} from '@/lib/bookings/status'
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

const ACTIVE_STATUSES = ACTIVE_BOOKING_STATUSES

// Padding superior dentro del rail / columnas para que el primer label de
// horas no se solape con el header.
const TOP_PAD_PX = 16

export type MoveRequest = {
  bookingId: number
  newStartsAt: string
  newEmployeeId?: number
}

export function CalendarDayView({
  date,
  employees,
  bookings,
  blocks,
  onBookingClick,
  onMoveRequest,
  salonTimezone,
  slotGranularityMinutes,
}: {
  date: string
  employees: EmployeeOption[]
  bookings: CalendarBookingItem[]
  blocks: CalendarBlock[]
  onBookingClick: (bookingId: number) => void
  onMoveRequest: (req: MoveRequest) => void
  salonTimezone: string
  slotGranularityMinutes: number
}) {
  const totalMin = DAY_END_MIN - DAY_START_MIN
  const gridHeight = totalMin * PX_PER_MIN + TOP_PAD_PX

  useCurrentMinute()
  const now = new Date()
  const showNow = salonToday(now, salonTimezone) === date
  const nowOffset = showNow ? computeNowOffset(date, salonTimezone, now) : null
  const nowLabel = showNow
    ? formatSalonTime(now.toISOString(), salonTimezone)
    : ''

  const hourLines: number[] = []
  for (
    let h = Math.floor(DAY_START_MIN / 60);
    h <= Math.floor(DAY_END_MIN / 60);
    h++
  ) {
    hourLines.push(h)
  }

  // PointerSensor con distancia corta: lo justo para que un click no se lea
  // como drag, sin que el bloque pegue un salto al cruzar el umbral.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  // Cálculo del nuevo horario tras un drop. `delta.y` es la diferencia px
  // desde el punto de origen; lo convertimos a minutos y snap a la
  // granularidad del salón.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event
    const data = active.data.current as
      | {
          bookingId: number
          employeeId: number
          startsAt: string
        }
      | undefined
    if (!data) return

    const droppedEmployeeId =
      (over?.data.current as { employeeId?: number } | undefined)?.employeeId ??
      data.employeeId

    const granMin = slotGranularityMinutes
    const deltaMinutesRaw = delta.y / PX_PER_MIN
    const deltaMinutes = Math.round(deltaMinutesRaw / granMin) * granMin

    if (deltaMinutes === 0 && droppedEmployeeId === data.employeeId) {
      return
    }

    const newStartsAt = new Date(
      new Date(data.startsAt).getTime() + deltaMinutes * 60_000,
    ).toISOString()

    onMoveRequest({
      bookingId: data.bookingId,
      newStartsAt,
      newEmployeeId:
        droppedEmployeeId !== data.employeeId ? droppedEmployeeId : undefined,
    })
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
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div>
        {/* Encabezado: empleados */}
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
          {employees.map((e) => (
            <EmployeeColumn
              key={e.id}
              employee={e}
              date={date}
              gridHeight={gridHeight}
              hourLines={hourLines}
              bookings={bookings.filter((b) => b.employeeId === e.id)}
              blocks={blocks.filter((b) => b.employeeId === e.id)}
              onBookingClick={onBookingClick}
            />
          ))}

          {/* Línea "ahora": cruza todo el body, con pill sobre el rail. */}
          {nowOffset !== null ? (
            <NowMarker top={nowOffset} label={nowLabel} />
          ) : null}
        </div>
      </div>
    </DndContext>
  )
}

// ─── Columna droppable ─────────────────────────────────────────────────────

function EmployeeColumn({
  employee,
  date,
  gridHeight,
  hourLines,
  bookings,
  blocks,
  onBookingClick,
}: {
  employee: EmployeeOption
  date: string
  gridHeight: number
  hourLines: number[]
  bookings: CalendarBookingItem[]
  blocks: CalendarBlock[]
  onBookingClick: (bookingId: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${employee.id}`,
    data: { employeeId: employee.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={`relative border-l transition-colors ${
        isOver ? 'bg-accent/30' : ''
      }`}
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

      {blocks.map((b) => {
        const pos = positionInDay(b.startsAt, b.endsAt, date)
        if (!pos) return null
        return (
          <div
            key={`block-${b.id}`}
            className="absolute inset-x-1 select-none rounded-sm border border-muted-foreground/30 bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,transparent_6px_12px)] p-1 text-[10px] text-muted-foreground"
            style={{ top: pos.top, height: pos.height }}
            title={b.reason + (b.note ? ` — ${b.note}` : '')}
          >
            <div className="font-medium">Bloqueo</div>
            <div className="opacity-80">{b.reason}</div>
          </div>
        )
      })}

      {bookings.map((b) => {
        const pos = positionInDay(b.startsAt, b.endsAt, date)
        if (!pos) return null
        const draggable = ACTIVE_STATUSES.includes(b.status)
        return (
          <BookingBlock
            key={`b-${b.itemId}`}
            booking={b}
            color={employee.color_hex}
            top={pos.top}
            height={pos.height}
            draggable={draggable}
            onClick={() => onBookingClick(b.bookingId)}
          />
        )
      })}
    </div>
  )
}

// ─── Bloque de reserva ─────────────────────────────────────────────────────

function BookingBlock({
  booking,
  color,
  top,
  height,
  draggable,
  onClick,
}: {
  booking: CalendarBookingItem
  color: string | null
  top: number
  height: number
  draggable: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `booking-${booking.itemId}`,
      data: {
        bookingId: booking.bookingId,
        employeeId: booking.employeeId,
        startsAt: booking.startsAt,
      },
      disabled: !draggable,
    })

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
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={`absolute inset-x-1 select-none overflow-hidden rounded-sm border px-1.5 py-1 text-left text-[11px] leading-tight text-white shadow-sm transition-[filter,opacity,box-shadow] hover:brightness-110 ${
        booking.status === 'in_progress'
          ? 'ring-2 ring-offset-1 ring-amber-300 animate-pulse'
          : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isDragging ? 'z-30 shadow-xl' : ''
      }`}
      style={{
        top,
        height,
        backgroundColor: bg,
        opacity: isDragging ? 0.85 : opacity,
        backgroundImage: striped
          ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.25) 0 4px, transparent 4px 8px)'
          : undefined,
        borderColor: 'rgba(0,0,0,0.15)',
        transform: CSS.Translate.toString(transform),
        // `transition` (className) cubre filter/opacity/shadow pero NO
        // transform: durante el drag la caja sigue al cursor sin interpolar,
        // que es lo que da sensación de respuesta inmediata.
        willChange: isDragging ? 'transform' : undefined,
        touchAction: draggable ? 'none' : undefined,
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

const STATUS_LABEL: Partial<Record<BookingStatus, string>> = {
  completed: 'Completada',
  cancelled_client: 'Cancelada (cliente)',
  cancelled_salon: 'Cancelada (salón)',
  no_show: 'No-show',
  in_progress: 'En curso',
  pending: 'Pendiente',
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
    height: Math.max(18, (visibleEnd - visibleStart) * PX_PER_MIN),
  }
}

function computeNowOffset(date: string, tz: string, now: Date): number | null {
  const nowMin = minutesFromSalonMidnight(now.toISOString(), date, tz)
  if (nowMin < DAY_START_MIN || nowMin > DAY_END_MIN) return null
  return TOP_PAD_PX + (nowMin - DAY_START_MIN) * PX_PER_MIN
}
