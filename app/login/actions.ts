'use server'

import { AuthError } from 'next-auth'
import { z } from 'zod'

import { signIn } from '@/lib/auth'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Introduce tu contraseña'),
  from: z.string().optional(),
})

export type LoginState = { error?: string }

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    from: formData.get('from') ?? undefined,
  })
  if (!parsed.success) {
    return { error: 'Datos inválidos' }
  }

  const safeFrom =
    parsed.data.from && parsed.data.from.startsWith('/admin')
      ? parsed.data.from
      : '/admin/today'

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeFrom,
    })
    return {}
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        error:
          err.type === 'CredentialsSignin'
            ? 'Email o contraseña incorrectos'
            : 'No se pudo iniciar sesión',
      }
    }
    // signIn() success throws NEXT_REDIRECT — rethrow to let Next handle it.
    throw err
  }
}
