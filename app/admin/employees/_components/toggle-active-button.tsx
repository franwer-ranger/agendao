'use client'

import * as React from 'react'
import { useTransition } from 'react'

import { setEmployeeActiveAction } from '@/lib/employees/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function ToggleActiveButton({
  id,
  name,
  isActive,
}: {
  id: number
  name: string
  isActive: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = React.useState(false)

  function deactivate() {
    const fd = new FormData()
    fd.set('id', String(id))
    fd.set('active', 'false')
    startTransition(async () => {
      await setEmployeeActiveAction(fd)
      setOpen(false)
    })
  }

  function activate() {
    const fd = new FormData()
    fd.set('id', String(id))
    fd.set('active', 'true')
    startTransition(async () => {
      await setEmployeeActiveAction(fd)
    })
  }

  if (!isActive) {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={activate}>
        Reactivar
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Desactivar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desactivar &quot;{name}&quot;</DialogTitle>
          <DialogDescription>
            Dejará de aparecer al asignar nuevas reservas. Las reservas futuras
            ya creadas se mantienen — gestiónalas manualmente si procede. Podrás
            reactivarlo más tarde.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={deactivate} disabled={pending}>
            {pending ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
