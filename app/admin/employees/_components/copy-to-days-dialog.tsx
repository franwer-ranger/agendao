'use client'

import * as React from 'react'
import { Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const ALL_DAYS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
]

export function CopyToDaysDialog({
  sourceWeekday,
  sourceLabel,
  onConfirm,
}: {
  sourceWeekday: number
  sourceLabel: string
  onConfirm: (targets: number[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<number>>(new Set())

  const otherDays = ALL_DAYS.filter((d) => d.num !== sourceWeekday)

  function toggle(num: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(num)
      else next.delete(num)
      return next
    })
  }

  function preset(nums: number[]) {
    setSelected(new Set(nums.filter((n) => n !== sourceWeekday)))
  }

  function confirm() {
    onConfirm([...selected])
    setOpen(false)
    setSelected(new Set())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSelected(new Set())
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Copiar horario de ${sourceLabel} a otros días`}
        >
          <Copy className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar {sourceLabel} a…</DialogTitle>
          <DialogDescription>
            Reemplaza los tramos de los días seleccionados por los de{' '}
            {sourceLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => preset([1, 2, 3, 4, 5])}
          >
            L–V
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => preset([6, 7])}
          >
            Sáb+Dom
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => preset([1, 2, 3, 4, 5, 6, 7])}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            Limpiar
          </Button>
        </div>

        <ul className="flex flex-col gap-2">
          {otherDays.map((d) => {
            const id = `copy-${sourceWeekday}-${d.num}`
            return (
              <li key={d.num} className="flex items-center gap-3">
                <Checkbox
                  id={id}
                  checked={selected.has(d.num)}
                  onCheckedChange={(v) => toggle(d.num, v === true)}
                />
                <Label htmlFor={id} className="cursor-pointer">
                  {d.label}
                </Label>
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={selected.size === 0}
          >
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
