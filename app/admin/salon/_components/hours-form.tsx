'use client'

import * as React from 'react'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  deleteSalonClosureAction,
  replaceWorkingHoursAction,
  type ActionState,
} from '@/lib/salons/actions'
import type { SalonClosure, SalonWorkingDay } from '@/lib/salons/queries'

import { ClosureCreateDialog } from './closure-create-dialog'

const WEEKDAYS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
] as const

type LocalDay = {
  weekday: number
  closed: boolean
  opens_at: string
  closes_at: string
}

const initialState: ActionState = { ok: false }

function buildInitial(rows: SalonWorkingDay[]): LocalDay[] {
  const byDay = new Map<number, SalonWorkingDay>()
  for (const r of rows) byDay.set(r.weekday, r)
  return WEEKDAYS.map(({ num }) => {
    const r = byDay.get(num)
    if (!r || !r.opens_at || !r.closes_at) {
      return {
        weekday: num,
        closed: true,
        opens_at: '09:00',
        closes_at: '20:00',
      }
    }
    return {
      weekday: num,
      closed: false,
      opens_at: r.opens_at,
      closes_at: r.closes_at,
    }
  })
}

function serialize(days: LocalDay[]): string {
  return JSON.stringify(
    days.map((d) => ({
      weekday: d.weekday,
      closed: d.closed,
      opens_at: d.closed ? '' : d.opens_at,
      closes_at: d.closed ? '' : d.closes_at,
    })),
  )
}

function computeErrors(days: LocalDay[]): Map<number, string> {
  const errors = new Map<number, string>()
  for (const d of days) {
    if (d.closed) continue
    if (!d.opens_at || !d.closes_at) {
      errors.set(d.weekday, 'Define apertura y cierre o marca como cerrado')
      continue
    }
    if (d.closes_at <= d.opens_at) {
      errors.set(d.weekday, 'El cierre debe ser posterior a la apertura')
    }
  }
  return errors
}

const dateFmt = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatClosureRange(starts_at: string, ends_at: string): string {
  // ends_at es exclusivo (00:00 del día siguiente). Restamos 1 ms para mostrarlo.
  const start = new Date(starts_at)
  const endExclusive = new Date(ends_at)
  const endShown = new Date(endExclusive.getTime() - 1)
  const startStr = dateFmt.format(start)
  const endStr = dateFmt.format(endShown)
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`
}

export function HoursForm({
  workingHours,
  closures,
}: {
  workingHours: SalonWorkingDay[]
  closures: SalonClosure[]
}) {
  const initial = useMemo(() => buildInitial(workingHours), [workingHours])
  const initialJson = useMemo(() => serialize(initial), [initial])
  const [days, setDays] = useState<LocalDay[]>(initial)

  const [state, formAction, pending] = useActionState(
    replaceWorkingHoursAction,
    initialState,
  )
  const submittedRef = useRef(false)

  const errors = useMemo(() => computeErrors(days), [days])
  const hasError = errors.size > 0
  const dirty = useMemo(
    () => serialize(days) !== initialJson,
    [days, initialJson],
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

  function patchDay(weekday: number, patch: Partial<LocalDay>) {
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)),
    )
  }

  function reset() {
    setDays(initial)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (hasError || !dirty) return
    const fd = new FormData()
    fd.set('days', serialize(days))
    submittedRef.current = true
    React.startTransition(() => formAction(fd))
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Horario semanal
          </h2>
          <p className="text-sm text-muted-foreground">
            Cuándo está abierto el salón. Si un día está cerrado, no se aceptan
            reservas aunque algún empleado tenga horario configurado.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="divide-y rounded-md border">
            {days.map((d) => {
              const label = WEEKDAYS.find((w) => w.num === d.weekday)?.label
              const error = errors.get(d.weekday)
              return (
                <div
                  key={d.weekday}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex w-32 items-center gap-3">
                    <Switch
                      id={`open-${d.weekday}`}
                      checked={!d.closed}
                      onCheckedChange={(v) =>
                        patchDay(d.weekday, { closed: !v })
                      }
                    />
                    <label
                      htmlFor={`open-${d.weekday}`}
                      className="text-sm font-medium"
                    >
                      {label}
                    </label>
                  </div>
                  {d.closed ? (
                    <span className="text-sm text-muted-foreground">
                      Cerrado
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          step={300}
                          value={d.opens_at}
                          aria-invalid={Boolean(error)}
                          aria-label={`Apertura ${label}`}
                          className={
                            'w-28 tabular-nums' +
                            (error ? ' border-destructive' : '')
                          }
                          onChange={(e) =>
                            patchDay(d.weekday, { opens_at: e.target.value })
                          }
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                          type="time"
                          step={300}
                          value={d.closes_at}
                          aria-invalid={Boolean(error)}
                          aria-label={`Cierre ${label}`}
                          className={
                            'w-28 tabular-nums' +
                            (error ? ' border-destructive' : '')
                          }
                          onChange={(e) =>
                            patchDay(d.weekday, { closes_at: e.target.value })
                          }
                        />
                      </div>
                      {error ? (
                        <p className="text-xs text-destructive" role="alert">
                          {error}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
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
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold">
              Cierres puntuales
            </h2>
            <p className="text-sm text-muted-foreground">
              Días concretos en los que el salón estará cerrado (festivos,
              obras, vacaciones del equipo).
            </p>
          </div>
          <ClosureCreateDialog />
        </div>

        <div className="overflow-hidden rounded-md border">
          {closures.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No hay cierres próximos configurados.
            </p>
          ) : (
            <ul className="divide-y">
              {closures.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{c.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatClosureRange(c.starts_at, c.ends_at)}
                    </span>
                  </div>
                  <form action={deleteSalonClosureAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label="Eliminar cierre"
                    >
                      <X className="size-4" /> Eliminar
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
