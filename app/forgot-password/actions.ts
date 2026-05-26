'use server'

import { z } from 'zod'

import { requestPasswordReset } from '@/lib/auth/password-reset'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

export type ForgotPasswordState = { ok?: boolean; error?: string }

export async function forgotPasswordAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { error: 'Introduce un email válido' }
  }
  try {
    await requestPasswordReset(parsed.data.email)
  } catch {
    // Same generic response either way — do not leak failures.
  }
  return { ok: true }
}
