'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { WizardNav } from '../_components/wizard-nav'
import {
  EMPLOYEE_COLORS,
  type ShiftDraft,
  type WizardDraft,
} from '../_lib/draft'

const WEEKDAYS = [
  { id: 1, short: 'L' },
  { id: 2, short: 'M' },
  { id: 3, short: 'X' },
  { id: 4, short: 'J' },
  { id: 5, short: 'V' },
  { id: 6, short: 'S' },
  { id: 7, short: 'D' },
] as const

type Props = {
  draft: WizardDraft
  update: (fn: (d: WizardDraft) => WizardDraft) => void
  onBack: () => void
  onNext: () => void
}

function defaultShifts(): ShiftDraft[] {
  return [
    { weekday: 1, starts_at: '09:00', ends_at: '19:00' },
    { weekday: 2, starts_at: '09:00', ends_at: '19:00' },
    { weekday: 3, starts_at: '09:00', ends_at: '19:00' },
    { weekday: 4, starts_at: '09:00', ends_at: '19:00' },
    { weekday: 5, starts_at: '09:00', ends_at: '19:00' },
    { weekday: 6, starts_at: '09:00', ends_at: '14:00' },
  ]
}

export function StepEmployees({ draft, update, onBack, onNext }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  function addEmployee() {
    const usedColors = new Set(
      draft.employees.map((e) => e.color_hex).filter(Boolean),
    )
    const nextColor =
      EMPLOYEE_COLORS.find((c) => !usedColors.has(c)) ?? EMPLOYEE_COLORS[0]
    update((d) => ({
      ...d,
      employees: [
        ...d.employees,
        {
          display_name: '',
          color_hex: nextColor,
          weeklySchedule: defaultShifts(),
        },
      ],
    }))
  }

  function removeEmployee(idx: number) {
    update((d) => ({
      ...d,
      employees: d.employees.filter((_, i) => i !== idx),
    }))
  }

  function updateEmployee(
    idx: number,
    patch: Partial<{ display_name: string; color_hex: string | null }>,
  ) {
    update((d) => {
      const employees = [...d.employees]
      employees[idx] = { ...employees[idx], ...patch }
      return { ...d, employees }
    })
  }

  function toggleDay(empIdx: number, weekday: number) {
    update((d) => {
      const employees = [...d.employees]
      const emp = employees[empIdx]
      const has = emp.weeklySchedule.some((s) => s.weekday === weekday)
      let weeklySchedule: ShiftDraft[]
      if (has) {
        weeklySchedule = emp.weeklySchedule.filter((s) => s.weekday !== weekday)
      } else {
        const reference = emp.weeklySchedule[0] ?? {
          starts_at: '09:00',
          ends_at: '19:00',
        }
        weeklySchedule = [
          ...emp.weeklySchedule,
          {
            weekday,
            starts_at: reference.starts_at,
            ends_at: reference.ends_at,
          },
        ].sort((a, b) => a.weekday - b.weekday)
      }
      employees[empIdx] = { ...emp, weeklySchedule }
      return { ...d, employees }
    })
  }

  function updateShiftTime(
    empIdx: number,
    weekday: number,
    field: 'starts_at' | 'ends_at',
    value: string,
  ) {
    update((d) => {
      const employees = [...d.employees]
      const emp = employees[empIdx]
      const weeklySchedule = emp.weeklySchedule.map((s) =>
        s.weekday === weekday ? { ...s, [field]: value } : s,
      )
      employees[empIdx] = { ...emp, weeklySchedule }
      return { ...d, employees }
    })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (draft.employees.length === 0) e.__list = 'Añade al menos un empleado'
    draft.employees.forEach((emp, i) => {
      if (!emp.display_name.trim()) e[`name_${i}`] = 'Obligatorio'
      if (emp.weeklySchedule.length === 0)
        e[`shifts_${i}`] = 'Marca al menos un día de trabajo'
      emp.weeklySchedule.forEach((s) => {
        if (s.ends_at <= s.starts_at)
          e[`shifts_${i}`] = 'La hora fin debe ser posterior a la de inicio'
      })
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Empleados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Añade a tu equipo. Cada empleado tendrá su agenda y un color en el
          calendario.
        </p>
      </div>

      {draft.employees.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Aún no has añadido empleados.
        </div>
      ) : (
        <div className="space-y-4">
          {draft.employees.map((emp, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`emp-name-${i}`}>Nombre</Label>
                    <Input
                      id={`emp-name-${i}`}
                      value={emp.display_name}
                      onChange={(ev) =>
                        updateEmployee(i, { display_name: ev.target.value })
                      }
                      aria-invalid={!!errors[`name_${i}`]}
                    />
                    {errors[`name_${i}`] ? (
                      <p className="text-xs text-destructive">
                        {errors[`name_${i}`]}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {EMPLOYEE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Color ${c}`}
                          onClick={() => updateEmployee(i, { color_hex: c })}
                          className={cn(
                            'size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all',
                            emp.color_hex === c
                              ? 'ring-foreground'
                              : 'ring-transparent hover:ring-border',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEmployee(i)}
                  aria-label={`Eliminar ${emp.display_name || 'empleado'}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Horario semanal
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((w) => {
                    const active = emp.weeklySchedule.some(
                      (s) => s.weekday === w.id,
                    )
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleDay(i, w.id)}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {w.short}
                      </button>
                    )
                  })}
                </div>
                {emp.weeklySchedule.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {emp.weeklySchedule.map((s) => {
                      const wd = WEEKDAYS.find((w) => w.id === s.weekday)!
                      return (
                        <div
                          key={s.weekday}
                          className="grid grid-cols-[60px_1fr_auto_1fr] items-center gap-2"
                        >
                          <span className="text-xs text-muted-foreground">
                            {wd.short}
                          </span>
                          <Input
                            type="time"
                            value={s.starts_at}
                            onChange={(ev) =>
                              updateShiftTime(
                                i,
                                s.weekday,
                                'starts_at',
                                ev.target.value,
                              )
                            }
                            className="max-w-[110px]"
                          />
                          <span className="text-xs text-muted-foreground">
                            a
                          </span>
                          <Input
                            type="time"
                            value={s.ends_at}
                            onChange={(ev) =>
                              updateShiftTime(
                                i,
                                s.weekday,
                                'ends_at',
                                ev.target.value,
                              )
                            }
                            className="max-w-[110px]"
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                {errors[`shifts_${i}`] ? (
                  <p className="text-xs text-destructive">
                    {errors[`shifts_${i}`]}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={addEmployee}
        className="gap-1.5"
      >
        <Plus className="size-4" />
        Añadir empleado
      </Button>

      {errors.__list ? (
        <p className="text-xs text-destructive">{errors.__list}</p>
      ) : null}

      <WizardNav
        onBack={onBack}
        onNext={() => {
          if (validate()) onNext()
        }}
      />
    </div>
  )
}
