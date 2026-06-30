'use server'

import { AuthError } from 'next-auth'
import { revalidatePath } from 'next/cache'

import { signIn } from '@/lib/auth'

import { performSetup, type SetupResult } from './perform-setup'
import { type SetupPayload } from './schema'

export type SetupActionState = {
  ok: boolean
  message?: string
}

// Wrapper invocado desde el wizard cliente. Hace el setup, revalida los caches
// y arranca sesión: signIn lanza NEXT_REDIRECT en éxito, que Next propaga.
export async function setupInstance(
  payload: SetupPayload,
  logoFile: File | null,
): Promise<SetupActionState> {
  let result: SetupResult
  try {
    result = await performSetup(payload, logoFile)
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }

  revalidatePath('/admin', 'layout')
  revalidatePath(`/${result.salonSlug}`, 'layout')

  try {
    await signIn('credentials', {
      email: payload.admin.email,
      password: payload.admin.password,
      redirectTo: '/admin/today?welcome=true',
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        ok: false,
        message:
          'Tu instancia se ha creado pero no pude iniciar sesión automáticamente. Entra desde /login.',
      }
    }
    throw err
  }

  return { ok: true }
}
