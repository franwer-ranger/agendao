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
import { Textarea } from '@/components/ui/textarea'
import {
  updateCancellationAction,
  type ActionState,
} from '@/lib/salons/actions'

const clientSchema = z.object({
  cancellation_min_hours: z
    .string()
    .regex(/^\d+$/, 'Debe ser un número entero'),
  cancellation_policy_text: z
    .string()
    .trim()
    .max(2000, 'Máximo 2000 caracteres'),
})

type FormValues = z.infer<typeof clientSchema>

export type CancellationFormDefaults = {
  cancellation_min_hours: number
  cancellation_policy_text: string
}

const initialState: ActionState = { ok: false }

export function CancellationForm({
  defaults,
}: {
  defaults: CancellationFormDefaults
}) {
  const [state, formAction, pending] = useActionState(
    updateCancellationAction,
    initialState,
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      cancellation_min_hours: String(defaults.cancellation_min_hours),
      cancellation_policy_text: defaults.cancellation_policy_text,
    },
  })

  useEffect(() => {
    if (state === initialState) return
    if (state.ok) {
      toast.success('Política guardada')
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
    fd.set('cancellation_min_hours', values.cancellation_min_hours)
    fd.set('cancellation_policy_text', values.cancellation_policy_text)
    React.startTransition(() => formAction(fd))
  })

  const errors = form.formState.errors

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field
        label="Antelación mínima para cancelar / reprogramar (horas)"
        htmlFor="cancellation_min_hours"
        error={errors.cancellation_min_hours?.message}
        hint="Por debajo de esta antelación el cliente no podrá cancelar online."
      >
        <Input
          id="cancellation_min_hours"
          type="number"
          inputMode="numeric"
          min={0}
          max={720}
          className="w-32 tabular-nums"
          {...form.register('cancellation_min_hours')}
        />
      </Field>

      <Field
        label="Texto que ve el cliente al reservar"
        htmlFor="cancellation_policy_text"
        error={errors.cancellation_policy_text?.message}
        hint="Opcional. Aparece junto al resumen de la reserva."
      >
        <Textarea
          id="cancellation_policy_text"
          rows={4}
          {...form.register('cancellation_policy_text')}
        />
      </Field>

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
