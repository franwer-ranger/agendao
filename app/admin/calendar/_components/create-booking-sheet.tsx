'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { ServiceWithEmployees } from '@/lib/services/queries'
import { createBookingManualAction } from '../_actions/create-booking-manual'
import type { EmployeeOption } from './calendar-shell'

const HHMM = /^\d{2}:\d{2}$/

const formSchema = z.object({
  service_id: z.string().min(1, 'Selecciona un servicio'),
  employee_id: z.string().min(1, 'Selecciona un empleado'),
  date: z.string().min(1, 'Fecha requerida'),
  starts_at: z.string().regex(HHMM, 'Formato HH:MM'),
  client_name: z.string().trim().min(1, 'Nombre obligatorio'),
  client_phone: z.string().trim().min(1, 'Teléfono obligatorio'),
  client_email: z
    .string()
    .trim()
    .refine(
      (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      'Email inválido',
    ),
  internal_note: z.string().trim().max(500),
  notify_client: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

export function CreateBookingSheet({
  open,
  onOpenChange,
  employees,
  services,
  defaultDate,
  defaultEmployeeId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: EmployeeOption[]
  services: ServiceWithEmployees[]
  defaultDate: string
  defaultEmployeeId?: number
}) {
  const [pending, startTransition] = useTransition()

  const defaultServiceId = services[0]?.id

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      service_id: defaultServiceId ? String(defaultServiceId) : '',
      employee_id: defaultEmployeeId
        ? String(defaultEmployeeId)
        : employees[0]?.id
          ? String(employees[0].id)
          : '',
      date: defaultDate,
      starts_at: '10:00',
      client_name: '',
      client_phone: '',
      client_email: '',
      internal_note: '',
      notify_client: false,
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        service_id: defaultServiceId ? String(defaultServiceId) : '',
        employee_id: defaultEmployeeId
          ? String(defaultEmployeeId)
          : employees[0]?.id
            ? String(employees[0].id)
            : '',
        date: defaultDate,
        starts_at: '10:00',
        client_name: '',
        client_phone: '',
        client_email: '',
        internal_note: '',
        notify_client: false,
      })
    }
  }, [open, defaultDate, defaultEmployeeId, defaultServiceId])

  // Cuando cambia el servicio, si el empleado seleccionado no puede hacerlo,
  // ajustamos a uno autorizado.
  const watchedServiceId = useWatch({
    control: form.control,
    name: 'service_id',
  })
  const selectedService = services.find(
    (s) => String(s.id) === watchedServiceId,
  )
  const eligibleEmployees = selectedService
    ? employees.filter((e) => selectedService.employee_ids.includes(e.id))
    : employees

  React.useEffect(() => {
    const currentEmpId = Number(form.getValues('employee_id'))
    if (!selectedService) return
    if (!selectedService.employee_ids.includes(currentEmpId)) {
      const first = eligibleEmployees[0]?.id
      if (first) form.setValue('employee_id', String(first))
    }
  }, [watchedServiceId])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createBookingManualAction({
        service_id: Number(values.service_id),
        employee_id: Number(values.employee_id),
        date: values.date,
        starts_at: values.starts_at,
        client_name: values.client_name,
        client_phone: values.client_phone,
        client_email: values.client_email,
        internal_note: values.internal_note,
        notify_client: values.notify_client,
      })
      if (result.ok) {
        toast.success('Reserva creada')
        onOpenChange(false)
      } else if (result.fieldErrors) {
        for (const [field, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) {
            form.setError(field as keyof FormValues, { message: msgs[0] })
          }
        }
      } else {
        toast.error(result.message ?? 'No se pudo crear la reserva')
      }
    })
  })

  const errors = form.formState.errors
  const notify = useWatch({ control: form.control, name: 'notify_client' })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nueva reserva</SheetTitle>
          <SheetDescription>
            Crea una cita manualmente, por ejemplo cuando entra una llamada.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 px-4">
          <FormField
            label="Servicio"
            htmlFor="bk-service"
            error={errors.service_id?.message}
          >
            <select
              id="bk-service"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              {...form.register('service_id')}
            >
              {services.length === 0 ? (
                <option value="" disabled>
                  Sin servicios activos
                </option>
              ) : null}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration_minutes} min
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Empleado"
            htmlFor="bk-employee"
            error={errors.employee_id?.message}
            hint={
              selectedService
                ? `${eligibleEmployees.length} empleado(s) hacen este servicio.`
                : undefined
            }
          >
            <select
              id="bk-employee"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              {...form.register('employee_id')}
            >
              {eligibleEmployees.length === 0 ? (
                <option value="" disabled>
                  Ningún empleado puede hacer este servicio
                </option>
              ) : null}
              {eligibleEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.display_name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Fecha"
              htmlFor="bk-date"
              error={errors.date?.message}
            >
              <Input id="bk-date" type="date" {...form.register('date')} />
            </FormField>
            <FormField
              label="Hora inicio"
              htmlFor="bk-start"
              error={errors.starts_at?.message}
            >
              <Input
                id="bk-start"
                type="time"
                step={300}
                {...form.register('starts_at')}
              />
            </FormField>
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Cliente
            </p>
            <div className="flex flex-col gap-3">
              <FormField
                label="Nombre"
                htmlFor="bk-name"
                error={errors.client_name?.message}
              >
                <Input id="bk-name" {...form.register('client_name')} />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  label="Teléfono"
                  htmlFor="bk-phone"
                  error={errors.client_phone?.message}
                >
                  <Input
                    id="bk-phone"
                    type="tel"
                    {...form.register('client_phone')}
                  />
                </FormField>
                <FormField
                  label="Email"
                  htmlFor="bk-email"
                  error={errors.client_email?.message}
                  hint="Opcional, necesario para email de confirmación."
                >
                  <Input
                    id="bk-email"
                    type="email"
                    {...form.register('client_email')}
                  />
                </FormField>
              </div>
              <p className="text-xs text-muted-foreground">
                Si el teléfono o email ya existe, reutilizamos su ficha.
              </p>
            </div>
          </div>

          <FormField
            label="Nota interna"
            htmlFor="bk-note"
            error={errors.internal_note?.message}
            hint="Opcional. Visible solo para el equipo."
          >
            <Textarea
              id="bk-note"
              rows={2}
              {...form.register('internal_note')}
            />
          </FormField>

          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium">
                Enviar email de confirmación
              </span>
              <span className="text-xs text-muted-foreground">
                Requiere email del cliente. Se envía tras crear la reserva.
              </span>
            </span>
            <Switch
              checked={notify}
              onCheckedChange={(v) => form.setValue('notify_client', v)}
            />
          </label>
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
            {pending ? 'Creando…' : 'Crear reserva'}
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
