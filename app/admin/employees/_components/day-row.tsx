'use client'

import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ShiftRow } from './shift-row'
import { CopyToDaysDialog } from './copy-to-days-dialog'
import type { LocalShift } from './weekly-schedule-editor'

export function DayRow({
  weekday,
  label,
  shifts,
  errors,
  onToggle,
  onAdd,
  onRemove,
  onUpdate,
  onCopyToDays,
}: {
  weekday: number
  label: string
  shifts: LocalShift[]
  errors: Map<string, string>
  onToggle: (on: boolean) => void
  onAdd: () => void
  onRemove: (key: string) => void
  onUpdate: (
    key: string,
    field: 'starts_at' | 'ends_at',
    value: string,
  ) => void
  onCopyToDays: (targets: number[]) => void
}) {
  const isActive = shifts.length > 0
  const switchId = `day-toggle-${weekday}`

  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex w-32 shrink-0 items-center gap-3 pt-1.5">
        <Switch
          id={switchId}
          checked={isActive}
          onCheckedChange={onToggle}
          aria-label={`${isActive ? 'Desactivar' : 'Activar'} ${label}`}
        />
        <label
          htmlFor={switchId}
          className={
            'cursor-pointer text-sm ' +
            (isActive ? 'font-medium' : 'text-muted-foreground')
          }
        >
          {label}
        </label>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {!isActive ? (
          <span className="py-1.5 text-sm text-muted-foreground">Libre</span>
        ) : (
          shifts.map((s) => (
            <ShiftRow
              key={s.key}
              shift={s}
              error={errors.get(s.key)}
              onChange={(field, value) => onUpdate(s.key, field, value)}
              onRemove={() => onRemove(s.key)}
            />
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isActive ? (
          <>
            <CopyToDaysDialog
              sourceWeekday={weekday}
              sourceLabel={label}
              onConfirm={onCopyToDays}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAdd}
            >
              + Tramo
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
