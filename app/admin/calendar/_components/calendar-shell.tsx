'use client'

import { es } from 'date-fns/locale'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ClientIcon } from '@/components/ui/client-icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type {
  CalendarBlock,
  CalendarBookingItem,
} from '@/lib/bookings/queries-calendar'
import type { ServiceWithEmployees } from '@/lib/services/queries'
import { addDaysIsoLocal, salonToday, startOfIsoWeek } from '@/lib/time'
import { toast } from 'sonner'
import { moveBookingAction } from '../_actions/move-booking'
import { BookingDetailDialog } from './booking-detail-dialog'
import {
  CalendarDayView,
  type MoveRequest,
} from './calendar-day-view'
import { CalendarWeekView } from './calendar-week-view'
import { CreateBlockSheet } from './create-block-sheet'
import { CreateBookingSheet } from './create-booking-sheet'
import { MoveConfirmDialog, type MovePreview } from './move-confirm-dialog'

export type EmployeeOption = {
  id: number
  display_name: string
  color_hex: string | null
}

export function CalendarShell({
  date,
  view,
  employees,
  selectedEmployeeIds,
  bookings,
  blocks,
  services,
  salonTimezone,
  slotGranularityMinutes,
}: {
  date: string
  view: 'day' | 'week'
  employees: EmployeeOption[]
  selectedEmployeeIds: number[]
  bookings: CalendarBookingItem[]
  blocks: CalendarBlock[]
  services: ServiceWithEmployees[]
  salonTimezone: string
  slotGranularityMinutes: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [openBookingId, setOpenBookingId] = React.useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [createBookingOpen, setCreateBookingOpen] = React.useState(false)
  const [createBlockOpen, setCreateBlockOpen] = React.useState(false)
  const [movePreview, setMovePreview] = React.useState<MovePreview | null>(null)
  const [movePending, startMoveTransition] = React.useTransition()

  const buildHref = React.useCallback(
    (patch: Record<string, string | string[] | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString())
      for (const [key, val] of Object.entries(patch)) {
        sp.delete(key)
        if (val === undefined) continue
        if (Array.isArray(val)) {
          for (const v of val) sp.append(key, v)
        } else {
          sp.set(key, val)
        }
      }
      return `${pathname}?${sp.toString()}`
    },
    [pathname, searchParams],
  )

  const navigate = (patch: Record<string, string | string[] | undefined>) => {
    router.push(buildHref(patch))
  }

  const goPrev = () => {
    const delta = view === 'day' ? -1 : -7
    navigate({ date: addDaysIsoLocal(date, delta) })
  }
  const goNext = () => {
    const delta = view === 'day' ? 1 : 7
    navigate({ date: addDaysIsoLocal(date, delta) })
  }
  const goToday = () =>
    navigate({ date: salonToday(new Date(), salonTimezone) })

  const toggleEmployeeDay = (id: number) => {
    const set = new Set(selectedEmployeeIds)
    if (set.has(id)) {
      // Guardamos al menos un empleado visible; espejo de la regla en
      // vista semana (siempre 1).
      if (set.size <= 1) return
      set.delete(id)
    } else {
      set.add(id)
    }
    navigate({ employeeId: [...set].map(String) })
  }
  const selectEmployeeWeek = (id: number) => {
    navigate({ employeeId: [String(id)] })
  }

  const headerLabel =
    view === 'day' ? formatDayLabel(date) : formatWeekLabel(date)

  const openBooking =
    openBookingId !== null
      ? (bookings.find((b) => b.bookingId === openBookingId) ?? null)
      : null

  const selectedDate = isoToDate(date)

  // DnD → abre el dialog con el preview. La confirmación posterior dispara
  // la server action; si falla, mantenemos los datos antiguos (el revalidate
  // no llega a ocurrir).
  const handleMoveRequest = (req: MoveRequest) => {
    const booking = bookings.find((b) => b.bookingId === req.bookingId)
    if (!booking) return
    const newEmployee = req.newEmployeeId
      ? employees.find((e) => e.id === req.newEmployeeId) ?? null
      : null
    setMovePreview({
      bookingId: req.bookingId,
      serviceName: booking.serviceName,
      clientName: booking.clientName,
      hasEmail: Boolean(booking.clientEmail),
      previousStartsAt: booking.startsAt,
      newStartsAt: req.newStartsAt,
      newEmployeeName: newEmployee?.display_name ?? null,
      newEmployeeId: req.newEmployeeId,
    })
  }

  const handleMoveConfirm = (notify: boolean) => {
    if (!movePreview) return
    const payload = {
      bookingId: movePreview.bookingId,
      newStartsAt: movePreview.newStartsAt,
      newEmployeeId: movePreview.newEmployeeId,
      notifyClient: notify,
    }
    startMoveTransition(async () => {
      const result = await moveBookingAction(payload)
      if (result.ok) {
        toast.success(
          notify ? 'Cita movida y cliente notificado' : 'Cita movida',
        )
        setMovePreview(null)
      } else {
        toast.error(result.message)
        setMovePreview(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Reservas y bloqueos del salón.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={goPrev}
              aria-label={view === 'day' ? 'Día anterior' : 'Semana anterior'}
            >
              <ClientIcon name="chevron-left" className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Hoy
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goNext}
              aria-label={view === 'day' ? 'Día siguiente' : 'Semana siguiente'}
            >
              <ClientIcon name="chevron-right" className="size-4" />
            </Button>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  aria-label="Elegir fecha"
                >
                  <ClientIcon name="calendar" className="size-4" />
                  <span className="tabular-nums">{headerLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  defaultMonth={selectedDate}
                  onSelect={(d) => {
                    if (!d) return
                    setPickerOpen(false)
                    navigate({ date: dateToIso(d) })
                  }}
                  locale={es}
                  weekStartsOn={1}
                  showOutsideDays
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              asChild
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
            >
              <Link href={buildHref({ view: 'day' })}>Día</Link>
            </Button>
            <Button
              asChild
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
            >
              <Link href={buildHref({ view: 'week' })}>Semana</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {employees.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No hay empleados activos.
              </span>
            ) : null}
            {employees.map((e) => {
              const selected = selectedEmployeeIds.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    view === 'day'
                      ? toggleEmployeeDay(e.id)
                      : selectEmployeeWeek(e.id)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition ${
                    selected
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/40'
                  }`}
                  aria-pressed={selected}
                >
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full border"
                    style={{
                      backgroundColor: e.color_hex ?? 'transparent',
                    }}
                  />
                  {e.display_name}
                </button>
              )
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateBlockOpen(true)}
              disabled={employees.length === 0}
            >
              Nuevo bloqueo
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateBookingOpen(true)}
              disabled={services.length === 0 || employees.length === 0}
            >
              Nueva reserva
            </Button>
          </div>
        </div>

        {view === 'week' && employees.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            En vista semanal solo se muestra un empleado. Selecciónalo arriba
            para cambiar.
          </p>
        ) : null}
      </div>

      {/* Wrapper de scroll horizontal: el alto nunca queda recortado para que
          no aparezca un scroll vertical interno; verticalmente fluye la
          página completa. */}
      <div className="px-1 pb-1">
        <div className="min-w-fit rounded-md border bg-card">
          {view === 'day' ? (
            <CalendarDayView
              date={date}
              employees={employees.filter((e) =>
                selectedEmployeeIds.includes(e.id),
              )}
              bookings={bookings}
              blocks={blocks}
              onBookingClick={(id) => setOpenBookingId(id)}
              onMoveRequest={handleMoveRequest}
              salonTimezone={salonTimezone}
              slotGranularityMinutes={slotGranularityMinutes}
            />
          ) : (
            <CalendarWeekView
              startDate={startOfIsoWeek(date)}
              employee={
                employees.find((e) => e.id === selectedEmployeeIds[0]) ?? null
              }
              bookings={bookings}
              blocks={blocks}
              onBookingClick={(id) => setOpenBookingId(id)}
              salonTimezone={salonTimezone}
            />
          )}
        </div>
      </div>

      {bookings.length === 0 && blocks.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Sin reservas ni bloqueos en este rango.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{bookings.length} reservas</Badge>
          {blocks.length > 0 ? (
            <Badge variant="outline">{blocks.length} bloqueos</Badge>
          ) : null}
        </div>
      )}

      <BookingDetailDialog
        booking={openBooking}
        onOpenChange={(open) => {
          if (!open) setOpenBookingId(null)
        }}
      />

      <CreateBookingSheet
        open={createBookingOpen}
        onOpenChange={setCreateBookingOpen}
        employees={employees}
        services={services}
        defaultDate={date}
        defaultEmployeeId={view === 'week' ? selectedEmployeeIds[0] : undefined}
      />

      <CreateBlockSheet
        open={createBlockOpen}
        onOpenChange={setCreateBlockOpen}
        employees={employees}
        defaultDate={date}
        defaultEmployeeId={view === 'week' ? selectedEmployeeIds[0] : undefined}
      />

      <MoveConfirmDialog
        preview={movePreview}
        pending={movePending}
        onConfirm={handleMoveConfirm}
        onCancel={() => setMovePreview(null)}
      />
    </div>
  )
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDayLabel(date: string) {
  return WEEKDAY_FMT.format(isoToDate(date))
}

function formatWeekLabel(date: string) {
  const start = startOfIsoWeek(date)
  const end = addDaysIsoLocal(start, 6)
  const fmt = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  })
  return `${fmt.format(isoToDate(start))} – ${fmt.format(isoToDate(end))}`
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
