'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TodayBookingItem } from '@/lib/bookings/queries-today'
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  type BookingStatus,
  isActiveStatus,
} from '@/lib/bookings/status'
import { setBookingStatusAction } from '@/lib/bookings/status-actions'
import { formatSalonTime } from '@/lib/time'

// Acciones por estado. Coherente con el modal del calendario pero adaptado
// a recepción: la primera es siempre la transición "happy path".
const ACTIONS: Record<
  BookingStatus,
  Array<{ to: BookingStatus; label: string; variant?: 'destructive' }>
> = {
  pending: [
    { to: 'confirmed', label: 'Confirmar' },
    { to: 'cancelled_salon', label: 'Cancelar', variant: 'destructive' },
  ],
  confirmed: [
    { to: 'in_progress', label: 'En curso' },
    { to: 'completed', label: 'Completar' },
    { to: 'no_show', label: 'No-show', variant: 'destructive' },
    { to: 'cancelled_salon', label: 'Cancelar', variant: 'destructive' },
  ],
  in_progress: [
    { to: 'completed', label: 'Completar' },
    { to: 'no_show', label: 'No-show', variant: 'destructive' },
  ],
  completed: [],
  cancelled_client: [],
  cancelled_salon: [],
  no_show: [],
}

export function BookingCard({
  booking,
  isDelayed,
  nowMs,
  onOpenNote,
  onOpenMove,
}: {
  booking: TodayBookingItem
  isDelayed: boolean
  nowMs: number
  onOpenNote: () => void
  onOpenMove: () => void
}) {
  const [pending, startTransition] = useTransition()
  const active = isActiveStatus(booking.status)
  const startMs = new Date(booking.startsAt).getTime()
  const endMs = new Date(booking.endsAt).getTime()
  const isNow =
    booking.status === 'in_progress' || (startMs <= nowMs && endMs > nowMs)

  const runTransition = (to: BookingStatus) => {
    startTransition(async () => {
      const result = await setBookingStatusAction({
        bookingId: booking.bookingId,
        toStatus: to,
      })
      if (result.ok) {
        toast.success(`Estado actualizado a "${STATUS_LABEL[to]}"`)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <article
      className={`rounded-md border p-3 transition-opacity ${
        active ? '' : 'opacity-60'
      } ${isDelayed ? 'border-destructive/60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium tabular-nums">
            {formatSalonTime(booking.startsAt)}–
            {formatSalonTime(booking.endsAt)}
          </span>
          <span className="mt-0.5 font-semibold">{booking.clientName}</span>
          <span className="text-sm text-muted-foreground">
            {booking.serviceName}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={STATUS_VARIANT[booking.status]}>
            {STATUS_LABEL[booking.status]}
          </Badge>
          {isNow ? <Badge variant="default">Ahora</Badge> : null}
          {isDelayed ? <Badge variant="destructive">Retrasada</Badge> : null}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{
            backgroundColor: booking.employeeColorHex ?? '#94a3b8',
          }}
          aria-hidden
        />
        <span>{booking.employeeName}</span>
      </div>

      {booking.internalNote ? (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
          {booking.internalNote}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS[booking.status].map((a) => (
          <Button
            key={a.to}
            size="sm"
            variant={a.variant ?? 'default'}
            disabled={pending}
            onClick={() => runTransition(a.to)}
          >
            {a.label}
          </Button>
        ))}
        {booking.clientPhone ? (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${booking.clientPhone}`}>Llamar</a>
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenNote}
          disabled={pending}
        >
          Nota
        </Button>
        {active ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenMove}
            disabled={pending}
          >
            Mover
          </Button>
        ) : null}
      </div>
    </article>
  )
}
