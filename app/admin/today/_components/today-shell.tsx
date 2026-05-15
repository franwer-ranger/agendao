'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useCurrentMinute } from '@/app/admin/calendar/_components/use-current-minute'
import { isActiveStatus } from '@/lib/bookings/status'
import type { TodayBookingItem } from '@/lib/bookings/queries-today'
import { formatSalonDate, formatSalonTime } from '@/lib/time'

import { BookingCard } from './booking-card'
import { NoteSheet } from './note-sheet'
import { MoveSheet } from './move-sheet'

export type TodayEmployeeOption = {
  id: number
  display_name: string
  color_hex: string | null
}

export function TodayShell({
  date,
  today,
  show,
  bookings,
  employees,
}: {
  date: string
  today: string
  show: 'active' | 'all'
  bookings: TodayBookingItem[]
  employees: TodayEmployeeOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const now = useCurrentMinute()
  const nowMs = now

  const [noteTarget, setNoteTarget] = React.useState<TodayBookingItem | null>(
    null,
  )
  const [moveTarget, setMoveTarget] = React.useState<TodayBookingItem | null>(
    null,
  )

  const visible = React.useMemo(
    () =>
      show === 'all'
        ? bookings
        : bookings.filter((b) => isActiveStatus(b.status)),
    [bookings, show],
  )

  // "Siguiente cliente": si hay algo en curso → ese es "ahora"; si no, el
  // primer item activo cuya ventana no haya terminado todavía.
  const inProgress = visible.find((b) => b.status === 'in_progress') ?? null
  const nextUp = inProgress
    ? null
    : (visible.find(
        (b) => isActiveStatus(b.status) && new Date(b.endsAt).getTime() > nowMs,
      ) ?? null)

  // Retrasos: por empleado, una cita confirmed cuyo `startsAt <= now` y cuya
  // anterior del mismo empleado sigue activa (no completed/cancelled/no_show).
  const delayedIds = React.useMemo(() => {
    const byEmployee = new Map<number, TodayBookingItem[]>()
    for (const b of visible) {
      const arr = byEmployee.get(b.employeeId) ?? []
      arr.push(b)
      byEmployee.set(b.employeeId, arr)
    }
    const out = new Set<number>()
    for (const arr of byEmployee.values()) {
      arr.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      for (let i = 0; i < arr.length; i++) {
        const cur = arr[i]
        if (cur.status !== 'confirmed') continue
        if (new Date(cur.startsAt).getTime() > nowMs) continue
        const prev = arr[i - 1]
        if (
          prev &&
          isActiveStatus(prev.status) &&
          prev.status !== 'completed'
        ) {
          out.add(cur.itemId)
        }
      }
    }
    return out
  }, [visible, nowMs])

  const total = bookings.length
  const activeTotal = bookings.filter((b) => isActiveStatus(b.status)).length

  const pushParam = (next: { date?: string; show?: 'active' | 'all' }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.date) params.set('date', next.date)
    if (next.show) params.set('show', next.show)
    router.push(`/admin/today?${params.toString()}`)
  }

  const isToday = date === today
  const headerDate = formatSalonDate(`${date}T12:00:00Z`)

  return (
    <div className="flex flex-col gap-4">
      <header className="sticky top-12 -mx-4 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold capitalize">
              {isToday ? 'Hoy' : headerDate}
            </h1>
            <p className="text-xs text-muted-foreground">
              {activeTotal} activa{activeTotal === 1 ? '' : 's'} · {total} en
              total
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) pushParam({ date: e.target.value })
              }}
              className="h-9 w-[10.5rem]"
            />
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={show === 'all'}
                onCheckedChange={(v) =>
                  pushParam({ show: v ? 'all' : 'active' })
                }
              />
              <span className="text-muted-foreground">Mostrar terminadas</span>
            </label>
          </div>
        </div>
      </header>

      {inProgress || nextUp ? (
        <NextClientBanner
          item={inProgress ?? nextUp!}
          mode={inProgress ? 'in_progress' : 'next'}
        />
      ) : null}

      {visible.length === 0 ? (
        <EmptyState date={date} show={show} />
      ) : (
        <ol className="flex flex-col gap-2">
          {visible.map((b) => (
            <li key={b.itemId}>
              <BookingCard
                booking={b}
                isDelayed={delayedIds.has(b.itemId)}
                nowMs={nowMs}
                onOpenNote={() => setNoteTarget(b)}
                onOpenMove={() => setMoveTarget(b)}
              />
            </li>
          ))}
        </ol>
      )}

      <NoteSheet
        booking={noteTarget}
        onOpenChange={(open) => {
          if (!open) setNoteTarget(null)
        }}
      />
      <MoveSheet
        booking={moveTarget}
        employees={employees}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null)
        }}
      />
    </div>
  )
}

function NextClientBanner({
  item,
  mode,
}: {
  item: TodayBookingItem
  mode: 'in_progress' | 'next'
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {mode === 'in_progress' ? 'En curso' : 'Siguiente cliente'}
          </span>
          <span className="mt-0.5 font-medium">
            {item.clientName} · {item.serviceName}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-sm tabular-nums">
            {formatSalonTime(item.startsAt)}–{formatSalonTime(item.endsAt)}
          </span>
          <span className="block text-xs text-muted-foreground">
            con {item.employeeName}
          </span>
        </div>
      </div>
      <Separator className="my-2" />
      <div className="flex flex-wrap gap-2">
        {item.clientPhone ? (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${item.clientPhone}`}>Llamar</a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function EmptyState({ date, show }: { date: string; show: 'active' | 'all' }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      <p>
        Sin citas {show === 'active' ? 'activas' : 'registradas'} para{' '}
        <span className="capitalize">
          {formatSalonDate(`${date}T12:00:00Z`)}
        </span>
        .
      </p>
      <Label className="sr-only" htmlFor="empty-noop">
        sin citas
      </Label>
    </div>
  )
}
