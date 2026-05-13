import 'server-only'
import { Resend } from 'resend'

let cachedClient: Resend | null = null

export function getResendClient(): Resend {
  if (cachedClient) return cachedClient
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY in environment.')
  }
  cachedClient = new Resend(apiKey)
  return cachedClient
}

// `production` solo cuando estamos sirviendo el sitio en prod en Vercel. En
// previews y en local nos consideramos no-prod y forzamos el destinatario al
// sandbox de Resend (la única dirección a la que el plan gratuito acepta
// enviar). `VERCEL_ENV` distingue production/preview/development; `NODE_ENV`
// por sí solo no, porque Vercel también lo pone a "production" en previews.
// TEMPORAL: no se usa mientras forzamos el override en todos los entornos.
// Restaurar su uso en `resolveRecipient` cuando acaben las pruebas en prod.
// function isProductionEnv(): boolean {
//   if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
//   return process.env.NODE_ENV === 'production'
// }

export type RecipientResolution = {
  to: string
  isOverridden: boolean
  originalTo: string
}

// TEMPORAL: forzamos el override en TODOS los entornos (incluido prod) para
// poder probar el flujo en la nube sin que los emails lleguen a clientes
// reales. Cuando termines la validación, restaura el bloque comentado abajo y
// elimina este return.
export function resolveRecipient(intended: string): RecipientResolution {
  const sandbox = process.env.EMAIL_EXAMPLE
  if (!sandbox) {
    throw new Error(
      'Missing EMAIL_EXAMPLE in environment. Required as recipient override.',
    )
  }
  return { to: sandbox, isOverridden: true, originalTo: intended }

  // --- COMPORTAMIENTO REAL (restaurar al acabar las pruebas en prod) ---
  // if (isProductionEnv()) {
  //   return { to: intended, isOverridden: false, originalTo: intended }
  // }
  // const sandbox = process.env.EMAIL_EXAMPLE
  // if (!sandbox) {
  //   throw new Error(
  //     'Missing EMAIL_EXAMPLE in environment. Required as dev recipient override.',
  //   )
  // }
  // return { to: sandbox, isOverridden: true, originalTo: intended }
}

// Remitente por defecto. Mientras no tengas dominio verificado en Resend, este
// `onboarding@resend.dev` funciona en sandbox. Cuando verifiques dominio,
// cambia EMAIL_FROM en env.
export function getDefaultFrom(): string {
  return process.env.EMAIL_FROM ?? 'Agendao <onboarding@resend.dev>'
}
