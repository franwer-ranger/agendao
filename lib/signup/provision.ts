import 'server-only'

import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { hashPassword } from '@/lib/auth/password'
import { db } from '@/lib/db'
import { app_users, salons } from '@/lib/db/schema'
import { withTenantTransaction } from '@/lib/db/tenant'
import { createTrialLifecycle } from '@/lib/salons/lifecycle'

import type { SignupInput } from './schema'

export type SignupConflictField = 'email' | 'slug'

export class SignupConflictError extends Error {
  constructor(readonly field: SignupConflictField) {
    super(field === 'email' ? 'signup_email_conflict' : 'signup_slug_conflict')
    this.name = 'SignupConflictError'
  }
}

export type ProvisionedSignup = {
  salonId: number
  adminId: string
}

export async function provisionSignup(
  input: SignupInput,
): Promise<ProvisionedSignup> {
  const [emailExists, slugExists] = await Promise.all([
    db
      .select({ id: app_users.id })
      .from(app_users)
      .where(eq(app_users.email, input.email))
      .limit(1),
    db
      .select({ id: salons.id })
      .from(salons)
      .where(eq(salons.slug, input.slug))
      .limit(1),
  ])

  if (emailExists[0]) throw new SignupConflictError('email')
  if (slugExists[0]) throw new SignupConflictError('slug')

  // Argon2 es costoso; calcularlo fuera evita mantener abierta la transacción.
  const passwordHash = await hashPassword(input.password)

  try {
    return await db.transaction(async (tx) => {
      const insertedSalon = await tx
        .insert(salons)
        .values({
          slug: input.slug,
          name: input.salonName,
          contact_email: input.email,
        })
        .returning({ id: salons.id })
      const salon = insertedSalon[0]
      if (!salon) throw new Error('No se pudo crear el salón')

      // El salón nace dentro de esta transacción. A partir de aquí todas las
      // escrituras tenant-scoped pasan por el GUC de ese ID recién generado.
      return withTenantTransaction(salon.id, tx, async (tenantTx) => {
        await createTrialLifecycle(salon.id, tenantTx)

        const adminId = randomUUID()
        await tenantTx.insert(app_users).values({
          id: adminId,
          salon_id: salon.id,
          role: 'admin',
          email: input.email,
          password_hash: passwordHash,
          display_name: input.email.split('@')[0]!,
          is_active: true,
        })

        return { salonId: salon.id, adminId }
      })
    })
  } catch (error) {
    const conflict = getUniqueConflict(error)
    if (conflict) throw new SignupConflictError(conflict)
    throw error
  }
}

function getUniqueConflict(error: unknown): SignupConflictField | null {
  let current: unknown = error

  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current !== 'object') return null
    const candidate = current as {
      code?: unknown
      constraint?: unknown
      cause?: unknown
    }
    if (candidate.code === '23505') {
      if (candidate.constraint === 'app_users_email_unique') return 'email'
      if (candidate.constraint === 'salons_slug_unique') return 'slug'
    }
    current = candidate.cause
  }

  return null
}
