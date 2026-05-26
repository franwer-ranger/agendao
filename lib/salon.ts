import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { salons } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export type CurrentSalon = {
  id: number
  slug: string
  name: string
  timezone: string
  locale: string
  slot_granularity_minutes: number
}

export async function getCurrentSalon(): Promise<CurrentSalon> {
  const session = await auth()
  if (!session?.user?.salonId) {
    throw new Error('No hay sesión activa')
  }
  const row = db
    .select({
      id: salons.id,
      slug: salons.slug,
      name: salons.name,
      timezone: salons.timezone,
      locale: salons.locale,
      slot_granularity_minutes: salons.slot_granularity_minutes,
    })
    .from(salons)
    .where(eq(salons.id, session.user.salonId))
    .get()

  if (!row) {
    throw new Error('Salón no encontrado para la sesión actual')
  }
  return row
}
