'use client'

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  createServiceAction,
  updateServiceAction,
  type ActionState,
} from '@/lib/services/actions'
import type { EmployeeOption } from '@/lib/services/queries'
import { EmployeeMultiselect } from './employee-multiselect'

// Client-side schema mirrors the server one but keeps native primitives so
// react-hook-form can show errors per field without serializing first.
const clientSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  description: z.string().trim().max(2000),
  duration_minutes: z
    .number({ message: 'Duración inválida' })
    .int('Debe ser un número entero')
    .min(5, 'Mínimo 5 minutos')
    .max(480, 'Máximo 480 minutos')
    .refine((v) => v % 5 === 0, 'Debe ser múltiplo de 5'),
  price_eur: z
    .string()
    .trim()
    .min(1, 'El precio es obligatorio')
    .refine(
      (v) => /^\d+([.,]\d{1,2})?$/.test(v),
      'Formato inválido (ej: 35 o 35,50)',
    ),
  max_concurrent: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^[1-9]\d?$/.test(v),
      'Debe ser un entero entre 1 y 50, o vacío',
    ),
  is_active: z.boolean(),
  employee_ids: z.array(z.number().int().positive()),
})

type FormValues = z.infer<typeof clientSchema>

export type ServiceFormDefaults = {
  id?: number
  name: string
  description: string
  duration_minutes: number
  price_eur: string
  max_concurrent: string
  is_active: boolean
  employee_ids: number[]
}

const initialState: ActionState = { ok: false }

export function ServiceForm({
  mode,
  serviceId,
  defaults,
  employees,
}: {
  mode: 'create' | 'edit'
  serviceId?: number
  defaults: ServiceFormDefaults
  employees: EmployeeOption[]
}) {
  const action =
    mode === 'edit' && serviceId
      ? updateServiceAction.bind(null, serviceId)
      : createServiceAction

  const [state, formAction, pending] = useActionState(action, initialState)

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: defaults.name,
      description: defaults.description,
      duration_minutes: defaults.duration_minutes,
      price_eur: defaults.price_eur,
      max_concurrent: defaults.max_concurrent,
      is_active: defaults.is_active,
      employee_ids: defaults.employee_ids,
    },
  })

  // Surface server-side errors that survived client validation.
  useEffect(() => {
    if (!state.ok && state.errors) {
      for (const [field, msgs] of Object.entries(state.errors)) {
        if (msgs && msgs.length > 0) {
          form.setError(field as keyof FormValues, { message: msgs[0] })
        }
      }
    }
    if (!state.ok && state.message) {
      toast.error(state.message)
    }
  }, [state, form])

  const onSubmit = form.handleSubmit((values) => {
    const fd = new FormData()
    fd.set('name', values.name)
    fd.set('description', values.description ?? '')
    fd.set('duration_minutes', String(values.duration_minutes))
    fd.set('price_eur', values.price_eur)
    fd.set('max_concurrent', values.max_concurrent)
    fd.set('is_active', values.is_active ? 'true' : 'false')
    for (const id of values.employee_ids) {
      fd.append('employee_ids', String(id))
    }
    React.startTransition(() => formAction(fd))
  })

  const errors = form.formState.errors

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div>
          <Label htmlFor="is_active" className="text-sm font-medium">
            Servicio activo
          </Label>
          <p className="text-xs text-muted-foreground">
            Si está inactivo, no aparece en el flujo de reserva del cliente.
          </p>
        </div>
        <Switch
          id="is_active"
          checked={useWatch({ control: form.control, name: 'is_active' })}
          onCheckedChange={(v) => form.setValue('is_active', v)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="off" {...form.register('name')} />
        </Field>

        <Field
          label="Duración (minutos)"
          htmlFor="duration_minutes"
          error={errors.duration_minutes?.message}
          hint="Múltiplo de 5"
        >
          <Input
            id="duration_minutes"
            type="number"
            inputMode="numeric"
            step={5}
            min={5}
            max={480}
            {...form.register('duration_minutes', { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Precio (€)"
          htmlFor="price_eur"
          error={errors.price_eur?.message}
          hint="Formato 35 ó 35,50"
        >
          <Input
            id="price_eur"
            inputMode="decimal"
            placeholder="0,00"
            {...form.register('price_eur')}
          />
        </Field>

        <Field
          label="Capacidad concurrente"
          htmlFor="max_concurrent"
          error={errors.max_concurrent?.message}
          hint="Cuántos pueden ejecutarse a la vez en el salón. Vacío = sin límite."
        >
          <Input
            id="max_concurrent"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            placeholder="Sin límite"
            {...form.register('max_concurrent')}
          />
        </Field>
      </div>

      <Field
        label="Descripción"
        htmlFor="description"
        error={errors.description?.message as string | undefined}
        hint="Opcional"
      >
        <Textarea id="description" rows={3} {...form.register('description')} />
      </Field>

      <div>
        <Label className="mb-2 block">Empleados que pueden realizarlo</Label>
        <Controller
          control={form.control}
          name="employee_ids"
          render={({ field }) => (
            <EmployeeMultiselect
              value={field.value}
              onChange={field.onChange}
              employees={employees}
            />
          )}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost">
          <Link href="/admin/services">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? 'Guardando…'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Crear servicio'}
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
