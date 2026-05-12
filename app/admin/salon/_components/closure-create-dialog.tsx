'use client'

import * as React from 'react'
import { useActionState, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createSalonClosureAction,
  type ActionState,
} from '@/lib/salons/actions'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const clientSchema = z
  .object({
    starts_on: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
    ends_on: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
    label: z.string().trim().min(1, 'El motivo es obligatorio').max(120),
  })
  .refine((d) => d.ends_on >= d.starts_on, {
    path: ['ends_on'],
    message: 'La fecha fin debe ser igual o posterior a la fecha inicio',
  })

type FormValues = z.infer<typeof clientSchema>

const initialState: ActionState = { ok: false }

export function ClosureCreateDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    createSalonClosureAction,
    initialState,
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { starts_on: '', ends_on: '', label: '' },
  })

  useEffect(() => {
    if (state === initialState) return
    if (state.ok) {
      toast.success('Cierre creado')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
      form.reset({ starts_on: '', ends_on: '', label: '' })
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
    fd.set('starts_on', values.starts_on)
    fd.set('ends_on', values.ends_on)
    fd.set('label', values.label)
    React.startTransition(() => formAction(fd))
  })

  const errors = form.formState.errors

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) form.reset({ starts_on: '', ends_on: '', label: '' })
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Añadir cierre</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cierre del salón</DialogTitle>
          <DialogDescription>
            Indica el rango de fechas (inclusivo) y un motivo corto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Desde"
              htmlFor="starts_on"
              error={errors.starts_on?.message}
            >
              <Input
                id="starts_on"
                type="date"
                {...form.register('starts_on')}
              />
            </Field>
            <Field
              label="Hasta"
              htmlFor="ends_on"
              error={errors.ends_on?.message}
            >
              <Input id="ends_on" type="date" {...form.register('ends_on')} />
            </Field>
          </div>
          <Field
            label="Motivo"
            htmlFor="label"
            error={errors.label?.message}
            hint="Ej: «Semana Santa», «Obras», «Vacaciones»."
          >
            <Input id="label" autoComplete="off" {...form.register('label')} />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear cierre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
