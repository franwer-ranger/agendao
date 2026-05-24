import { db } from '@/lib/db'
import { salons } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const DEMO_SALON_SLUG = 'estudio-aurora'

export type CurrentSalon = {
  id: number
  slug: string
  name: string
  timezone: string
  locale: string
  slot_granularity_minutes: number
}

// Until auth lands (Block 10), the dashboard always operates on the demo salon.
export async function getCurrentSalon(): Promise<CurrentSalon> {
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
    .where(eq(salons.slug, DEMO_SALON_SLUG))
    .get()

  if (!row) {
    throw new Error(
      `No se encontró el salón "${DEMO_SALON_SLUG}". ¿Ejecutaste npm run db:migrate && npm run db:seed?`,
    )
  }
  return row
}
