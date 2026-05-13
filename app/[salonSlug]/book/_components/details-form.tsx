'use client'

import * as React from 'react'
import { useActionState, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createPublicBookingAction } from '../_actions/create-booking'
import {
  detailsFormSchema,
  type CreateBookingActionState,
  type DetailsFormValues,
} from '../_lib/booking-flow-schema'
import { RetryDialog } from './retry-dialog'

const initialState: CreateBookingActionState = { ok: false }

type Props = {
  salonSlug: string
  serviceId: number
  employeeId: number
  startsAt: string
  originalEmployeeChoice: 'any' | string
  idempotencyKey: string
  termsRequired: boolean
  cancellationPolicyText: string | null
  termsText: string | null
}

export function DetailsForm({
  salonSlug,
  serviceId,
  employeeId,
  startsAt,
  originalEmployeeChoice,
  idempotencyKey,
  termsRequired,
  cancellationPolicyText,
  termsText,
}: Props) {
  const boundAction = React.useMemo(
    () => createPublicBookingAction.bind(null, salonSlug),
    [salonSlug],
  )

  const [state, formAction, pending] = useActionState(boundAction, initialState)

  const form = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsFormSchema),
    defaultValues: {
      displayName: '',
      phone: '',
      email: '',
      clientNote: '',
    },
  })

  const [acceptTerms, setAcceptTerms] = useState(false)
  const [retryOpen, setRetryOpen] = useState(false)

  useEffect(() => {
    if (state === initialState) return
    if (state.ok) return // redirect
    if (state.fieldErrors) {
      for (const [field, msgs] of Object.entries(state.fieldErrors)) {
        if (!msgs?.[0]) continue
        if (field === 'acceptTerms') continue
        if (field in form.getValues()) {
          form.setError(field as keyof DetailsFormValues, {
            message: msgs[0],
          })
        }
      }
    }
    if (state.retryStep === 'datetime') {
      setRetryOpen(true)
    } else if (state.message) {
      toast.error(state.message)
    }
  }, [state, form])

  const onSubmit = form.handleSubmit((values) => {
    if (termsRequired && !acceptTerms) {
      toast.error('Acepta las condiciones para reservar.')
      return
    }
    const fd = new FormData()
    fd.set('displayName', values.displayName)
    fd.set('phone', values.phone)
    fd.set('email', values.email)
    fd.set('clientNote', values.clientNote)
    fd.set('acceptTerms', acceptTerms ? 'on' : '')
    fd.set('serviceId', String(serviceId))
    fd.set('employeeId', String(employeeId))
    fd.set('startsAt', startsAt)
    fd.set('originalEmployeeChoice', originalEmployeeChoice)
    fd.set('idempotencyKey', idempotencyKey)
    fd.set('termsRequired', termsRequired ? '1' : '0')
    React.startTransition(() => formAction(fd))
  })

  const errors = form.formState.errors
  const emailValue = form.watch('email')

  const retryDestination = (() => {
    if (state.retryStep !== 'datetime') return ''
    const params = new URLSearchParams({
      serviceId: String(serviceId),
      employeeId:
        originalEmployeeChoice === 'any' ? 'any' : String(employeeId),
    })
    if (state.preselectedDate)
      params.set('preselectedDate', state.preselectedDate)
    return `/${salonSlug}/book/datetime?${params.toString()}`
  })()

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field
        label="Tu nombre"
        htmlFor="displayName"
        error={errors.displayName?.message}
      >
        <Input
          id="displayName"
          autoComplete="name"
          inputMode="text"
          {...form.register('displayName')}
        />
      </Field>

      <Field
        label="Teléfono"
        htmlFor="phone"
        error={errors.phone?.message}
        hint="Lo usamos sólo si necesitamos avisarte de algún cambio."
      >
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+34 600 12 34 56"
          {...form.register('phone')}
        />
      </Field>

      <Field
        label="Email (opcional)"
        htmlFor="email"
        error={errors.email?.message}
        hint={
          !emailValue
            ? 'Sin email no podremos enviarte confirmación ni un enlace para gestionar tu reserva.'
            : undefined
        }
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          {...form.register('email')}
        />
      </Field>

      <Field
        label="Notas para el salón (opcional)"
        htmlFor="clientNote"
        error={errors.clientNote?.message}
      >
        <Textarea
          id="clientNote"
          rows={3}
          maxLength={500}
          {...form.register('clientNote')}
        />
      </Field>

      {cancellationPolicyText ? (
        <details className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <summary className="cursor-pointer select-none font-medium">
            Política de cancelación
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {cancellationPolicyText}
          </p>
        </details>
      ) : null}

      {termsRequired ? (
        <div className="space-y-2">
          <label
            htmlFor="acceptTerms"
            className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm"
          >
            <Checkbox
              id="acceptTerms"
              checked={acceptTerms}
              onCheckedChange={(v) => setAcceptTerms(v === true)}
              className="mt-0.5"
            />
            <span>
              He leído y acepto las{' '}
              <details className="inline">
                <summary className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline">
                  condiciones del salón
                </summary>
                <span className="mt-2 block whitespace-pre-wrap text-muted-foreground">
                  {termsText}
                </span>
              </details>
              .
            </span>
          </label>
        </div>
      ) : null}

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? 'Confirmando…' : 'Confirmar reserva'}
      </Button>

      <RetryDialog
        open={retryOpen}
        message={state.message ?? 'Ese horario acaba de ocuparse.'}
        destination={retryDestination}
        onClose={() => setRetryOpen(false)}
      />
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
    <div className="flex flex-col gap-1.5">
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
