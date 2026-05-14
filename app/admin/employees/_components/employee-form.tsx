'use client'

import * as React from 'react'
import { useActionState, useEffect, useRef } from 'react'
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
  createEmployeeAction,
  updateEmployeeAction,
  type ActionState,
} from '@/lib/employees/actions'
import type { ServiceOption } from '@/lib/employees/queries'
import { ServiceMultiselect } from './service-multiselect'

// Espejo del schema servidor pero con primitivas nativas para que
// react-hook-form muestre errores por campo sin serializar antes.
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

const clientSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  bio: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
  color_hex: z
    .string()
    .trim()
    .refine((v) => v === '' || HEX_COLOR.test(v), 'Color inválido (#RRGGBB)'),
  display_order: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+$/.test(v), 'Debe ser un entero ≥ 0'),
  is_active: z.boolean(),
  service_ids: z.array(z.number().int().positive()),
})

type FormValues = z.infer<typeof clientSchema>

export type EmployeeFormDefaults = {
  id?: number
  display_name: string
  bio: string
  color_hex: string
  display_order: string
  is_active: boolean
  service_ids: number[]
}

// Paleta sugerida para el calendario. Coincide con el backfill SQL y con la
// que usan los servicios — así los empleados arrancan con tonos consistentes
// y distinguibles. El usuario puede picar cualquier color libre además.
const COLOR_PALETTE = [
  '#4F46E5',
  '#0EA5E9',
  '#DB2777',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
]

const initialState: ActionState = { ok: false }

export function EmployeeForm({
  mode,
  employeeId,
  defaults,
  services,
}: {
  mode: 'create' | 'edit'
  employeeId?: number
  defaults: EmployeeFormDefaults
  services: ServiceOption[]
}) {
  const action =
    mode === 'edit' && employeeId
      ? updateEmployeeAction.bind(null, employeeId)
      : createEmployeeAction

  const [state, formAction, pending] = useActionState(action, initialState)
  const submittedRef = useRef(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      display_name: defaults.display_name,
      bio: defaults.bio,
      color_hex: defaults.color_hex,
      display_order: defaults.display_order,
      is_active: defaults.is_active,
      service_ids: defaults.service_ids,
    },
  })

  // Surface server-side errors / éxito.
  useEffect(() => {
    if (!submittedRef.current) return
    if (state.ok) {
      // Solo aplica al modo edit (create redirige y nunca llega aquí).
      toast.success('Cambios guardados')
      submittedRef.current = false
      return
    }
    if (state.errors) {
      for (const [field, msgs] of Object.entries(state.errors)) {
        if (msgs && msgs.length > 0) {
          form.setError(field as keyof FormValues, { message: msgs[0] })
        }
      }
    }
    if (state.message) {
      toast.error(state.message)
    }
  }, [state, form])

  const handleFormAction = form.handleSubmit((values) => {
    const fd = new FormData()
    fd.set('display_name', values.display_name)
    fd.set('bio', values.bio ?? '')
    fd.set('color_hex', values.color_hex ?? '')
    fd.set('display_order', values.display_order)
    fd.set('is_active', values.is_active ? 'true' : 'false')
    for (const id of values.service_ids) {
      fd.append('service_ids', String(id))
    }
    React.startTransition(() => formAction(fd))
  })

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    submittedRef.current = true
    handleFormAction(e)
  }

  const errors = form.formState.errors

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div>
          <Label htmlFor="is_active" className="text-sm font-medium">
            Empleado activo
          </Label>
          <p className="text-xs text-muted-foreground">
            Si está inactivo, no aparece para nuevas reservas. Las reservas
            futuras ya creadas se mantienen.
          </p>
        </div>
        <Switch
          id="is_active"
          checked={useWatch({ control: form.control, name: 'is_active' })}
          onCheckedChange={(v) => form.setValue('is_active', v)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Nombre"
          htmlFor="display_name"
          error={errors.display_name?.message}
        >
          <Input
            id="display_name"
            autoComplete="off"
            {...form.register('display_name')}
          />
        </Field>

        <Field
          label="Orden"
          htmlFor="display_order"
          error={errors.display_order?.message}
          hint="Para ordenar el listado. Menor = antes."
        >
          <Input
            id="display_order"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            placeholder="0"
            {...form.register('display_order')}
          />
        </Field>
      </div>

      <Field
        label="Bio"
        htmlFor="bio"
        error={errors.bio?.message as string | undefined}
        hint="Opcional. Texto interno para el equipo."
      >
        <Textarea id="bio" rows={3} {...form.register('bio')} />
      </Field>

      <Controller
        control={form.control}
        name="color_hex"
        render={({ field }) => (
          <ColorField
            value={field.value}
            onChange={field.onChange}
            error={errors.color_hex?.message}
          />
        )}
      />

      <div>
        <Label className="mb-2 block">Servicios que puede realizar</Label>
        <Controller
          control={form.control}
          name="service_ids"
          render={({ field }) => (
            <ServiceMultiselect
              value={field.value}
              onChange={field.onChange}
              services={services}
            />
          )}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost">
          <Link href="/admin/employees">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? 'Guardando…'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Crear empleado'}
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

function ColorField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const normalized = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : ''
  const swatchValue = normalized || '#cbd5e1'

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="color_hex">Color en el calendario</Label>
      <div className="flex flex-wrap items-center gap-2">
        {COLOR_PALETTE.map((hex) => {
          const selected = normalized.toLowerCase() === hex.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              aria-label={`Color ${hex}`}
              aria-pressed={selected}
              className={`size-7 rounded-full border transition ${
                selected
                  ? 'ring-2 ring-offset-2 ring-foreground'
                  : 'border-border'
              }`}
              style={{ backgroundColor: hex }}
            />
          )
        })}
        <div className="ml-1 flex items-center gap-2 rounded-md border px-2 py-1">
          <input
            id="color_hex"
            type="color"
            value={swatchValue}
            onChange={(e) => onChange(e.target.value)}
            className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
            aria-label="Color personalizado"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {normalized ? normalized.toUpperCase() : 'Sin color'}
          </span>
          {normalized ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Quitar color"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Se usa para identificar visualmente las citas de este empleado en el
          calendario.
        </p>
      )}
    </div>
  )
}
