'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { updateBookingInternalNoteAction } from '@/lib/bookings/note-actions'
import type { TodayBookingItem } from '@/lib/bookings/queries-today'

const MAX = 500

export function NoteSheet({
  booking,
  onOpenChange,
}: {
  booking: TodayBookingItem | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={booking !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {booking ? (
          // `key` fuerza el remount cuando cambia la reserva: así el estado
          // local del formulario se reinicia con la nota actual sin tener que
          // sincronizarlo desde un useEffect.
          <NoteForm
            key={booking.itemId}
            booking={booking}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function NoteForm({
  booking,
  onClose,
}: {
  booking: TodayBookingItem
  onClose: () => void
}) {
  const [value, setValue] = React.useState(booking.internalNote ?? '')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    startTransition(async () => {
      const result = await updateBookingInternalNoteAction({
        bookingId: booking.bookingId,
        internalNote: value,
      })
      if (result.ok) {
        toast.success('Nota guardada')
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Nota interna</SheetTitle>
        <SheetDescription>
          {booking.clientName} · {booking.serviceName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-2 px-4">
        <Textarea
          rows={6}
          maxLength={MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Visible solo para el equipo."
        />
        <p className="text-right text-xs text-muted-foreground">
          {value.length}/{MAX}
        </p>
      </div>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </SheetFooter>
    </>
  )
}
