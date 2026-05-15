'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { CalendarBookingItem } from '@/lib/bookings/queries-calendar'
import { setBookingStatusAction } from '@/lib/bookings/status-actions'
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  type BookingStatus,
} from '@/lib/bookings/status'
import { formatSalonDate, formatSalonTime } from '@/lib/time'

// Transiciones que un admin puede ejecutar desde el modal. El orden importa:
// la primera acción "positiva" se renderiza primero (a la izquierda).
const ACTIONS_BY_STATUS: Record<
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

export function BookingDetailDialog({
  booking,
  onOpenChange,
}: {
  booking: CalendarBookingItem | null
  onOpenChange: (open: boolean) => void
}) {
  const open = booking !== null
  const [pending, startTransition] = useTransition()

  const runTransition = (bookingId: number, to: BookingStatus) => {
    startTransition(async () => {
      const result = await setBookingStatusAction({ bookingId, toStatus: to })
      if (result.ok) {
        toast.success(`Estado actualizado a "${STATUS_LABEL[to]}"`)
        onOpenChange(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {booking ? (
          <>
            <DialogHeader>
              <DialogTitle>{booking.serviceName}</DialogTitle>
              <DialogDescription>
                {formatSalonDate(booking.startsAt)} ·{' '}
                {formatSalonTime(booking.startsAt)}–
                {formatSalonTime(booking.endsAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={STATUS_VARIANT[booking.status]}>
                  {STATUS_LABEL[booking.status]}
                </Badge>
              </div>

              <Separator />

              <Field label="Cliente" value={booking.clientName} />
              {booking.clientPhone ? (
                <Field
                  label="Teléfono"
                  value={
                    <a
                      href={`tel:${booking.clientPhone}`}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {booking.clientPhone}
                    </a>
                  }
                />
              ) : null}
              {booking.clientEmail ? (
                <Field
                  label="Email"
                  value={
                    <a
                      href={`mailto:${booking.clientEmail}`}
                      className="text-foreground underline-offset-2 hover:underline break-all"
                    >
                      {booking.clientEmail}
                    </a>
                  }
                />
              ) : null}

              {booking.internalNote ? (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground">Notas internas</div>
                    <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                      {booking.internalNote}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {ACTIONS_BY_STATUS[booking.status].map((a) => (
                  <Button
                    key={a.to}
                    size="sm"
                    variant={a.variant ?? 'default'}
                    disabled={pending}
                    onClick={() => runTransition(booking.bookingId, a.to)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
