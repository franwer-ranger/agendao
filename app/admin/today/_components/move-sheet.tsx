'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { moveBookingAction } from '@/app/admin/calendar/_actions/move-booking'
import type { TodayBookingItem } from '@/lib/bookings/queries-today'
import { salonDateToUtc } from '@/lib/time'

import type { TodayEmployeeOption } from './today-shell'

// Helpers de formato local. Para precargar los inputs con la fecha/hora
// actual del booking en zona Madrid sin depender del navegador.
const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function MoveSheet({
  booking,
  employees,
  onOpenChange,
}: {
  booking: TodayBookingItem | null
  employees: TodayEmployeeOption[]
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={booking !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {booking ? (
          <MoveForm
            key={booking.itemId}
            booking={booking}
            employees={employees}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function MoveForm({
  booking,
  employees,
  onClose,
}: {
  booking: TodayBookingItem
  employees: TodayEmployeeOption[]
  onClose: () => void
}) {
  const initialStart = new Date(booking.startsAt)
  const [date, setDate] = React.useState(() => dateFmt.format(initialStart))
  const [time, setTime] = React.useState(() => timeFmt.format(initialStart))
  const [employeeId, setEmployeeId] = React.useState<string>(
    String(booking.employeeId),
  )
  const [notify, setNotify] = React.useState(false)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    const [h, m] = time.split(':').map(Number)
    if (!date || Number.isNaN(h) || Number.isNaN(m)) {
      toast.error('Fecha u hora no válidas.')
      return
    }
    const dayStartUtc = salonDateToUtc(date)
    const newStartsAt = new Date(
      dayStartUtc.getTime() + (h * 60 + m) * 60_000,
    ).toISOString()
    const newEmployeeIdNum = Number(employeeId)
    const sameEmployee = newEmployeeIdNum === booking.employeeId

    startTransition(async () => {
      const result = await moveBookingAction({
        bookingId: booking.bookingId,
        newStartsAt,
        newEmployeeId: sameEmployee ? undefined : newEmployeeIdNum,
        notifyClient: notify && Boolean(booking.clientEmail),
      })
      if (result.ok) {
        toast.success('Cita movida')
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Mover cita</SheetTitle>
        <SheetDescription>
          {booking.clientName} · {booking.serviceName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="mv-date">Fecha</Label>
            <Input
              id="mv-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mv-time">Hora</Label>
            <Input
              id="mv-time"
              type="time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="mv-employee">Empleado</Label>
          <select
            id="mv-employee"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.display_name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-md border p-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">
              Avisar al cliente por email
            </span>
            <span className="text-xs text-muted-foreground">
              {booking.clientEmail
                ? 'Se envía un correo de reprogramación.'
                : 'El cliente no tiene email; no se enviará aviso.'}
            </span>
          </span>
          <Switch
            checked={notify}
            onCheckedChange={setNotify}
            disabled={!booking.clientEmail}
          />
        </label>
      </div>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Moviendo…' : 'Mover'}
        </Button>
      </SheetFooter>
    </>
  )
}
