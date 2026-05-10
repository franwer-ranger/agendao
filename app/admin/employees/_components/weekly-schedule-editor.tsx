'use client'

import * as React from 'react'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  updateEmployeeWeeklyScheduleAction,
  type ActionState,
} from '@/lib/employees/actions'
import type { WeeklyShift } from '@/lib/employees/queries'
import { DayRow } from './day-row'

const WEEKDAYS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
] as const

export type LocalShift = {
  key: string
  starts_at: string
  ends_at: string
}

const initialState: ActionState = { ok: false }

function newKey() {
  return crypto.randomUUID()
}

function shiftsToMap(shifts: WeeklyShift[]): Map<number, LocalShift[]> {
  const map = new Map<number, LocalShift[]>()
  for (let d = 1; d <= 7; d++) map.set(d, [])
  for (const s of shifts) {
    const list = map.get(s.weekday) ?? []
    list.push({ key: newKey(), starts_at: s.starts_at, ends_at: s.ends_at })
    map.set(s.weekday, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }
  return map
}

function serialize(map: Map<number, LocalShift[]>): string {
  const flat: { weekday: number; starts_at: string; ends_at: string }[] = []
  for (const [weekday, list] of map) {
    for (const s of list) {
      flat.push({ weekday, starts_at: s.starts_at, ends_at: s.ends_at })
    }
  }
  flat.sort(
    (a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at),
  )
  return JSON.stringify(flat)
}

function computeErrors(map: Map<number, LocalShift[]>): Map<string, string> {
  const errors = new Map<string, string>()
  for (const list of map.values()) {
    // ends > starts por tramo
    for (const s of list) {
      if (s.ends_at <= s.starts_at) {
        errors.set(s.key, 'La hora fin debe ser posterior a la hora inicio')
      }
    }
    // sin solapes dentro del mismo día
    const sorted = [...list].sort((a, b) =>
      a.starts_at.localeCompare(b.starts_at),
    )
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].starts_at < sorted[i - 1].ends_at) {
        if (!errors.has(sorted[i].key)) {
          errors.set(sorted[i].key, 'Se solapa con otro tramo del mismo día')
        }
      }
    }
  }
  return errors
}

// Heurística: si el último tramo termina a las 14:00, asume comida partida
// y propone 16:00–20:00. Si no, sugiere lastEnd → lastEnd + 1h (cap 23:55).
function nextShiftDefault(list: LocalShift[]): {
  starts_at: string
  ends_at: string
} {
  if (list.length === 0) return { starts_at: '09:00', ends_at: '14:00' }
  const lastEnd = list[list.length - 1].ends_at
  if (lastEnd === '14:00') return { starts_at: '16:00', ends_at: '20:00' }
  const [h, m] = lastEnd.split(':').map(Number)
  const startMin = h * 60 + m
  const cap = 23 * 60 + 55
  if (startMin >= cap) {
    return { starts_at: '23:50', ends_at: '23:55' }
  }
  const endMin = Math.min(startMin + 60, cap)
  const fmt = (mins: number) => {
    const hh = String(Math.floor(mins / 60)).padStart(2, '0')
    const mm = String(mins % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }
  return { starts_at: fmt(startMin), ends_at: fmt(endMin) }
}

export function WeeklyScheduleEditor({
  employeeId,
  defaults,
}: {
  employeeId: number
  defaults: WeeklyShift[]
}) {
  const initialMap = useMemo(() => shiftsToMap(defaults), [defaults])
  const initialJson = useMemo(() => serialize(initialMap), [initialMap])
  const [byDay, setByDay] = useState<Map<number, LocalShift[]>>(initialMap)

  const action = updateEmployeeWeeklyScheduleAction.bind(null, employeeId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const submittedRef = useRef(false)

  const errors = useMemo(() => computeErrors(byDay), [byDay])
  const hasError = errors.size > 0
  const dirty = useMemo(
    () => serialize(byDay) !== initialJson,
    [byDay, initialJson],
  )

  useEffect(() => {
    if (!submittedRef.current) return
    if (state.ok) {
      toast.success('Horario guardado')
      submittedRef.current = false
      return
    }
    if (state.message) toast.error(state.message)
    if (state.errors && Object.keys(state.errors).length > 0) {
      toast.error('Hay tramos inválidos. Revísalos antes de guardar.')
    }
  }, [state])

  function update(
    updater: (m: Map<number, LocalShift[]>) => void,
  ) {
    setByDay((prev) => {
      const next = new Map(prev)
      updater(next)
      return next
    })
  }

  function toggleDay(weekday: number, on: boolean) {
    update((m) => {
      if (on) {
        const list = m.get(weekday) ?? []
        if (list.length === 0) {
          m.set(weekday, [
            { key: newKey(), starts_at: '09:00', ends_at: '14:00' },
          ])
        }
      } else {
        m.set(weekday, [])
      }
    })
  }

  function addShift(weekday: number) {
    update((m) => {
      const list = m.get(weekday) ?? []
      const next = nextShiftDefault(list)
      m.set(weekday, [...list, { key: newKey(), ...next }])
    })
  }

  function removeShift(weekday: number, key: string) {
    update((m) => {
      const list = (m.get(weekday) ?? []).filter((s) => s.key !== key)
      m.set(weekday, list)
    })
  }

  function updateShift(
    weekday: number,
    key: string,
    field: 'starts_at' | 'ends_at',
    value: string,
  ) {
    update((m) => {
      const list = (m.get(weekday) ?? []).map((s) =>
        s.key === key ? { ...s, [field]: value } : s,
      )
      m.set(weekday, list)
    })
  }

  function copyToDays(sourceWeekday: number, targetWeekdays: number[]) {
    update((m) => {
      const source = m.get(sourceWeekday) ?? []
      for (const d of targetWeekdays) {
        if (d === sourceWeekday) continue
        m.set(
          d,
          source.map((s) => ({
            key: newKey(),
            starts_at: s.starts_at,
            ends_at: s.ends_at,
          })),
        )
      }
    })
  }

  function reset() {
    setByDay(shiftsToMap(defaults))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (hasError || !dirty) return
    const fd = new FormData()
    fd.set('shifts', serialize(byDay))
    submittedRef.current = true
    React.startTransition(() => formAction(fd))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="divide-y rounded-md border">
        {WEEKDAYS.map(({ num, label }) => (
          <DayRow
            key={num}
            weekday={num}
            label={label}
            shifts={byDay.get(num) ?? []}
            errors={errors}
            onToggle={(on) => toggleDay(num, on)}
            onAdd={() => addShift(num)}
            onRemove={(key) => removeShift(num, key)}
            onUpdate={(key, field, value) => updateShift(num, key, field, value)}
            onCopyToDays={(targets) => copyToDays(num, targets)}
          />
        ))}
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={reset}
            disabled={pending || !dirty}
          >
            Descartar cambios
          </Button>
          <Button type="submit" disabled={pending || !dirty || hasError}>
            {pending ? 'Guardando…' : 'Guardar horario'}
          </Button>
        </div>
        {hasError ? (
          <p className="text-xs text-destructive">
            Corrige los tramos en rojo antes de guardar.
          </p>
        ) : null}
      </div>
    </form>
  )
}
