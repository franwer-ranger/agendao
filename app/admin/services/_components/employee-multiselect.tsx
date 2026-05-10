'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { EmployeeOption } from '@/lib/services/queries'

export function EmployeeMultiselect({
  value,
  onChange,
  employees,
}: {
  value: number[]
  onChange: (next: number[]) => void
  employees: EmployeeOption[]
}) {
  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay empleados. Crea uno primero en{' '}
        <span className="italic">Empleados</span>.
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
      {employees.map((emp) => {
        const id = `employee-${emp.id}`
        const checked = selected.has(emp.id)
        return (
          <li key={emp.id} className="flex items-center gap-3">
            <Checkbox
              id={id}
              checked={checked}
              disabled={!emp.is_active}
              onCheckedChange={(next) => toggle(emp.id, next === true)}
            />
            <Label
              htmlFor={id}
              className={
                'cursor-pointer ' +
                (emp.is_active ? '' : 'text-muted-foreground line-through')
              }
            >
              {emp.display_name}
              {emp.is_active ? null : (
                <span className="ml-2 text-xs">(inactivo)</span>
              )}
            </Label>
          </li>
        )
      })}
    </ul>
  )
}
