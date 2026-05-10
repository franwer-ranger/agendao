'use client'

import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { LocalShift } from './weekly-schedule-editor'

export function ShiftRow({
  shift,
  error,
  onChange,
  onRemove,
}: {
  shift: LocalShift
  error?: string
  onChange: (field: 'starts_at' | 'ends_at', value: string) => void
  onRemove: () => void
}) {
  const invalid = Boolean(error)
  const cls = 'w-28 tabular-nums' + (invalid ? ' border-destructive' : '')

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="time"
          step={300}
          value={shift.starts_at}
          onChange={(e) => onChange('starts_at', e.target.value)}
          aria-invalid={invalid}
          aria-label="Hora inicio"
          className={cls}
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="time"
          step={300}
          value={shift.ends_at}
          onChange={(e) => onChange('ends_at', e.target.value)}
          aria-invalid={invalid}
          aria-label="Hora fin"
          className={cls}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Eliminar tramo"
        >
          <X className="size-4" />
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
