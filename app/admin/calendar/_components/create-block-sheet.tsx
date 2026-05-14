'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { createBlockAction } from '../_actions/create-block'
import type { EmployeeOption } from './calendar-shell'

const HHMM = /^\d{2}:\d{2}$/

const formSchema = z
  .object({
    employee_id: z.string().min(1, 'Selecciona un empleado'),
    date: z.string().min(1, 'Fecha requerida'),
    starts_at: z.string().regex(HHMM, 'Formato HH:MM'),
    ends_at: z.string().regex(HHMM, 'Formato HH:MM'),
    reason: z.enum(['vacation', 'sick', 'personal', 'training', 'other']),
    note: z.string().trim().max(500, 'Máximo 500 caracteres'),
  })
  .refine((d) => d.ends_at > d.starts_at, {
    path: ['ends_at'],
    message: 'La hora fin debe ser posterior a la hora inicio',
  })

type FormValues = z.infer<typeof formSchema>

const REASON_LABEL: Record<FormValues['reason'], string> = {
  vacation: 'Vacaciones',
  sick: 'Baja médica',
  personal: 'Personal',
  training: 'Formación',
  other: 'Otro',
}

export function CreateBlockSheet({
  open,
  onOpenChange,
  employees,
  defaultDate,
  defaultEmployeeId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: EmployeeOption[]
  defaultDate: string
  defaultEmployeeId?: number
}) {
  const [pending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employee_id: defaultEmployeeId
        ? String(defaultEmployeeId)
        : employees[0]?.id
          ? String(employees[0].id)
          : '',
      date: defaultDate,
      starts_at: '14:00',
      ends_at: '15:00',
      reason: 'personal',
      note: '',
    },
  })

  // Reset al reabrir con nuevos defaults.
  React.useEffect(() => {
    if (open) {
      form.reset({
        employee_id: defaultEmployeeId
          ? String(defaultEmployeeId)
          : employees[0]?.id
            ? String(employees[0].id)
            : '',
        date: defaultDate,
        starts_at: '14:00',
        ends_at: '15:00',
        reason: 'personal',
        note: '',
      })
    }
  }, [open, defaultDate, defaultEmployeeId])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createBlockAction({
        employee_id: Number(values.employee_id),
        date: values.date,
        starts_at: values.starts_at,
        ends_at: values.ends_at,
        reason: values.reason,
        note: values.note,
      })
      if (result.ok) {
        toast.success('Bloqueo creado')
        onOpenChange(false)
      } else if (result.fieldErrors) {
        for (const [field, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) {
            form.setError(field as keyof FormValues, { message: msgs[0] })
          }
        }
      } else {
        toast.error(result.message ?? 'No se pudo crear el bloqueo')
      }
    })
  })

  const errors = form.formState.errors

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nuevo bloqueo</SheetTitle>
          <SheetDescription>
            Reserva un rango horario para un empleado (comida, formación, etc.)
            que no podrá ocuparse con citas.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 px-4">
          <FormField
            label="Empleado"
            htmlFor="block-employee"
            error={errors.employee_id?.message}
          >
            <select
              id="block-employee"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              {...form.register('employee_id')}
            >
              {employees.length === 0 ? (
                <option value="" disabled>
                  Sin empleados activos
                </option>
              ) : null}
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.display_name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Fecha"
            htmlFor="block-date"
            error={errors.date?.message}
          >
            <Input id="block-date" type="date" {...form.register('date')} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Desde"
              htmlFor="block-start"
              error={errors.starts_at?.message}
            >
              <Input
                id="block-start"
                type="time"
                step={300}
                {...form.register('starts_at')}
              />
            </FormField>
            <FormField
              label="Hasta"
              htmlFor="block-end"
              error={errors.ends_at?.message}
            >
              <Input
                id="block-end"
                type="time"
                step={300}
                {...form.register('ends_at')}
              />
            </FormField>
          </div>

          <FormField
            label="Motivo"
            htmlFor="block-reason"
            error={errors.reason?.message}
          >
            <select
              id="block-reason"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              {...form.register('reason')}
            >
              {Object.entries(REASON_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Nota"
            htmlFor="block-note"
            error={errors.note?.message}
            hint="Opcional. Visible solo para el equipo."
          >
            <Textarea id="block-note" rows={2} {...form.register('note')} />
          </FormField>
        </form>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Guardando…' : 'Crear bloqueo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function FormField({
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
