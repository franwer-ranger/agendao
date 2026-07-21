'use server'

import { AuthError } from 'next-auth'

import { signIn } from '@/lib/auth'
import { provisionSignup, SignupConflictError } from '@/lib/signup/provision'
import { parseSignupFormData } from '@/lib/signup/schema'

export type SignupActionState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string[]>
}

export async function signupAction(
  _previousState: SignupActionState | undefined,
  formData: FormData,
): Promise<SignupActionState> {
  const parsed = parseSignupFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  try {
    await provisionSignup(parsed.data)
  } catch (error) {
    if (error instanceof SignupConflictError) {
      return {
        ok: false,
        fieldErrors: {
          [error.field]: [
            error.field === 'email'
              ? 'Ya existe una cuenta con este email'
              : 'Este identificador ya está en uso. Elige otro.',
          ],
        },
      }
    }

    console.error('[signup] no se pudo provisionar el salón:', error)
    return {
      ok: false,
      message: 'No hemos podido crear tu cuenta. Inténtalo de nuevo.',
    }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/setup',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          'Tu cuenta se ha creado, pero no pudimos iniciar sesión. Entra desde la pantalla de acceso.',
      }
    }
    // Auth.js comunica el redirect correcto mediante una excepción de control.
    throw error
  }

  return { ok: true }
}
