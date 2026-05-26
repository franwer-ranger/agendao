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

// En prod (Kamal fuerza NODE_ENV=production en deploy.yml) enviamos al
// destinatario real. En dev/preview redirigimos al sandbox de Resend
// (EMAIL_EXAMPLE) para no spamear clientes reales durante pruebas.
function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production'
}

export type RecipientResolution = {
  to: string
  isOverridden: boolean
  originalTo: string
}

export function resolveRecipient(intended: string): RecipientResolution {
  if (isProductionEnv()) {
    return { to: intended, isOverridden: false, originalTo: intended }
  }
  const sandbox = process.env.EMAIL_EXAMPLE
  if (!sandbox) {
    throw new Error(
      'Missing EMAIL_EXAMPLE in non-prod environment. Required as recipient override.',
    )
  }
  return { to: sandbox, isOverridden: true, originalTo: intended }
}

// Remitente por defecto. Mientras no tengas dominio verificado en Resend, este
// `onboarding@resend.dev` funciona en sandbox. Cuando verifiques dominio,
// cambia EMAIL_FROM en env.
export function getDefaultFrom(): string {
  return process.env.EMAIL_FROM ?? 'Agendao <onboarding@resend.dev>'
}
