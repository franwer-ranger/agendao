'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { suggestSalonSlug } from '@/lib/salons/slug'

import { signupAction, type SignupActionState } from '../actions'

export function SignupForm() {
  const [state, formAction, pending] = useActionState<
    SignupActionState | undefined,
    FormData
  >(signupAction, undefined)
  const [salonName, setSalonName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  function fieldError(name: string): string | undefined {
    return state?.fieldErrors?.[name]?.[0]
  }

  function updateSalonName(value: string) {
    setSalonName(value)
    if (!slugManuallyEdited) setSlug(suggestSalonSlug(value))
  }

  const emailError = fieldError('email')
  const passwordError = fieldError('password')
  const salonNameError = fieldError('salonName')
  const slugError = fieldError('slug')

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Crea tu salón</CardTitle>
        <CardDescription>
          Empieza tu prueba de 14 días y configura el negocio a continuación.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(emailError)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
              <FieldError id="email-error">{emailError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(passwordError)}>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={pending}
                aria-invalid={Boolean(passwordError)}
                aria-describedby="password-description password-error"
              />
              <FieldDescription id="password-description">
                Mínimo 8 caracteres.
              </FieldDescription>
              <FieldError id="password-error">{passwordError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(salonNameError)}>
              <FieldLabel htmlFor="salon-name">Nombre del salón</FieldLabel>
              <Input
                id="salon-name"
                name="salonName"
                value={salonName}
                onChange={(event) => updateSalonName(event.target.value)}
                autoComplete="organization"
                maxLength={120}
                required
                disabled={pending}
                aria-invalid={Boolean(salonNameError)}
                aria-describedby={
                  salonNameError ? 'salon-name-error' : undefined
                }
              />
              <FieldError id="salon-name-error">{salonNameError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(slugError)}>
              <FieldLabel htmlFor="slug">Identificador en la URL</FieldLabel>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value)
                  setSlugManuallyEdited(true)
                }}
                autoComplete="off"
                minLength={2}
                maxLength={40}
                required
                disabled={pending}
                aria-invalid={Boolean(slugError)}
                aria-describedby="slug-description slug-error"
              />
              <FieldDescription id="slug-description">
                Tu página será /{slug || 'tu-salon'}/book. Usa minúsculas,
                números y guiones.
              </FieldDescription>
              <FieldError id="slug-error">{slugError}</FieldError>
            </Field>

            {state?.message ? (
              <Field data-invalid>
                <FieldError>{state.message}</FieldError>
              </Field>
            ) : null}
          </FieldGroup>
        </CardContent>

        <CardFooter className="mt-4 flex-col gap-2">
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner data-icon="inline-start" />
                Creando cuenta…
              </>
            ) : (
              'Crear cuenta'
            )}
          </Button>
          <Button variant="link" size="sm" asChild>
            <Link href="/login">¿Ya tienes cuenta? Inicia sesión</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
