'use client'

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateLegalAction, type ActionState } from '@/lib/salons/actions'

const clientSchema = z.object({
  terms_text: z.string().trim().max(10000, 'Máximo 10.000 caracteres'),
})

type FormValues = z.infer<typeof clientSchema>

export type LegalFormDefaults = {
  terms_text: string
}

const initialState: ActionState = { ok: false }

export function LegalForm({ defaults }: { defaults: LegalFormDefaults }) {
  const [state, formAction, pending] = useActionState(
    updateLegalAction,
    initialState,
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { terms_text: defaults.terms_text },
  })

  useEffect(() => {
    if (state === initialState) return
    if (state.ok) {
      toast.success('Aviso legal guardado')
      return
    }
    if (state.errors?.terms_text?.[0]) {
      form.setError('terms_text', { message: state.errors.terms_text[0] })
    }
    if (state.message) toast.error(state.message)
  }, [state, form])

  const onSubmit = form.handleSubmit((values) => {
    const fd = new FormData()
    fd.set('terms_text', values.terms_text)
    React.startTransition(() => formAction(fd))
  })

  const error = form.formState.errors.terms_text?.message

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="terms_text">
          Términos y condiciones / aviso legal
        </Label>
        <Textarea
          id="terms_text"
          rows={12}
          placeholder="Texto que el cliente debe aceptar al confirmar su reserva (política de privacidad, condiciones, etc.)."
          {...form.register('terms_text')}
        />
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aparecerá en el flujo de reserva y los emails de confirmación.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
