'use client'

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateBookingsAction, type ActionState } from '@/lib/salons/actions'

const GRANULARITIES = [5, 10, 15, 20, 30, 60] as const

const clientSchema = z.object({
  slot_granularity_minutes: z
    .string()
    .regex(/^\d+$/, 'Debe ser un número entero')
    .refine(
      (v) => (GRANULARITIES as readonly number[]).includes(Number(v)),
      'Valor no permitido',
    ),
  booking_min_hours_ahead: z
    .string()
    .regex(/^\d+$/, 'Debe ser un número entero'),
  booking_max_days_ahead: z
    .string()
    .regex(/^\d+$/, 'Debe ser un número entero'),
})

type FormValues = z.infer<typeof clientSchema>

export type BookingsFormDefaults = {
  slot_granularity_minutes: number
  booking_min_hours_ahead: number
  booking_max_days_ahead: number
}

const initialState: ActionState = { ok: false }

export function BookingsForm({ defaults }: { defaults: BookingsFormDefaults }) {
  const [state, formAction, pending] = useActionState(
    updateBookingsAction,
    initialState,
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      slot_granularity_minutes: String(defaults.slot_granularity_minutes),
      booking_min_hours_ahead: String(defaults.booking_min_hours_ahead),
      booking_max_days_ahead: String(defaults.booking_max_days_ahead),
    },
  })

  useEffect(() => {
    if (state === initialState) return
    if (state.ok) {
      toast.success('Reglas de reserva guardadas')
      return
    }
    if (state.errors) {
      for (const [field, msgs] of Object.entries(state.errors)) {
        if (msgs?.[0] && field in form.getValues()) {
          form.setError(field as keyof FormValues, { message: msgs[0] })
        }
      }
    }
    if (state.message) toast.error(state.message)
  }, [state, form])

  const onSubmit = form.handleSubmit((values) => {
    const fd = new FormData()
    fd.set('slot_granularity_minutes', values.slot_granularity_minutes)
    fd.set('booking_min_hours_ahead', values.booking_min_hours_ahead)
    fd.set('booking_max_days_ahead', values.booking_max_days_ahead)
    React.startTransition(() => formAction(fd))
  })

  const errors = form.formState.errors

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field
        label="Granularidad de huecos"
        htmlFor="slot_granularity_minutes"
        error={errors.slot_granularity_minutes?.message}
        hint="Cada cuántos minutos se ofrecen horarios al cliente."
      >
        <select
          id="slot_granularity_minutes"
          className="h-9 w-32 rounded-md border bg-background px-3 text-sm tabular-nums shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...form.register('slot_granularity_minutes')}
        >
          {GRANULARITIES.map((g) => (
            <option key={g} value={g}>
              {g} min
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Antelación mínima (horas)"
          htmlFor="booking_min_hours_ahead"
          error={errors.booking_min_hours_ahead?.message}
          hint="No se permitirán reservas con menos de esta antelación."
        >
          <Input
            id="booking_min_hours_ahead"
            type="number"
            inputMode="numeric"
            min={0}
            max={168}
            className="w-32 tabular-nums"
            {...form.register('booking_min_hours_ahead')}
          />
        </Field>
        <Field
          label="Antelación máxima (días)"
          htmlFor="booking_max_days_ahead"
          error={errors.booking_max_days_ahead?.message}
          hint="Cuánto a futuro se puede reservar."
        >
          <Input
            id="booking_max_days_ahead"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            className="w-32 tabular-nums"
            {...form.register('booking_max_days_ahead')}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
