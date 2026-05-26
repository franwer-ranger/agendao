'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { consumeResetToken } from '@/lib/auth/password-reset'

const schema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(200, 'Demasiado larga'),
    passwordConfirm: z.string().min(1),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  })

export type ResetPasswordState = { error?: string }

export async function resetPasswordAction(
  _prev: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const result = await consumeResetToken(
    parsed.data.token,
    parsed.data.password,
  )
  if (!result.ok) {
    return {
      error:
        result.error === 'invalid_token'
          ? 'El enlace ha expirado o ya se usó. Solicita uno nuevo.'
          : 'No se pudo restablecer la contraseña.',
    }
  }

  redirect('/login?reset=1')
}
