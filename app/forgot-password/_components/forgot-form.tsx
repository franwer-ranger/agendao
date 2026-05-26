'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { forgotPasswordAction, type ForgotPasswordState } from '../actions'

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ForgotPasswordState | undefined,
    FormData
  >(forgotPasswordAction, undefined)

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          Si existe una cuenta con ese email, te hemos enviado un enlace para
          restablecer la contraseña. Revisa tu bandeja de entrada (y la carpeta
          de spam).
        </p>
        <Link
          href="/login"
          className="text-sm underline-offset-4 hover:underline"
        >
          Volver al login
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </div>

      {state?.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar enlace'}
      </Button>

      <Link
        href="/login"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Volver al login
      </Link>
    </form>
  )
}
