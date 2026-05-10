'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ServiceOption } from '@/lib/employees/queries'

export function ServiceMultiselect({
  value,
  onChange,
  services,
}: {
  value: number[]
  onChange: (next: number[]) => void
  services: ServiceOption[]
}) {
  if (services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay servicios. Créalos primero en{' '}
        <span className="italic">Servicios</span>.
      </p>
    )
  }

  const selected = new Set(value)

  function toggle(id: number, next: boolean) {
    const nextSet = new Set(selected)
    if (next) nextSet.add(id)
    else nextSet.delete(id)
    onChange([...nextSet])
  }

  return (
    <ul className="flex flex-col gap-2 rounded-md border p-3">
      {services.map((svc) => {
        const id = `service-${svc.id}`
        const checked = selected.has(svc.id)
        return (
          <li key={svc.id} className="flex items-center gap-3">
            <Checkbox
              id={id}
              checked={checked}
              disabled={!svc.is_active}
              onCheckedChange={(next) => toggle(svc.id, next === true)}
            />
            <Label
              htmlFor={id}
              className={
                'cursor-pointer ' +
                (svc.is_active ? '' : 'text-muted-foreground line-through')
              }
            >
              {svc.name}
              {svc.is_active ? null : (
                <span className="ml-2 text-xs">(inactivo)</span>
              )}
            </Label>
          </li>
        )
      })}
    </ul>
  )
}
