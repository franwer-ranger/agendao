import { createAdminClient } from '@/lib/supabase/admin'

const DEMO_SALON_SLUG = 'demo'

export type CurrentSalon = {
  id: number
  slug: string
  name: string
  timezone: string
  locale: string
}

// Until auth lands (Block 10), the dashboard always operates on the demo salon.
export async function getCurrentSalon(): Promise<CurrentSalon> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('salons')
    .select('id, slug, name, timezone, locale')
    .eq('slug', DEMO_SALON_SLUG)
    .single()

  if (error) {
    throw new Error(
      `Error consultando el salón "${DEMO_SALON_SLUG}": ${error.message}. ` +
        `Comprueba que SUPABASE_SERVICE_ROLE_KEY es la key correcta (JWT que empieza por "eyJ…", no un placeholder).`,
    )
  }
  if (!data) {
    throw new Error(
      `No se encontró el salón "${DEMO_SALON_SLUG}". ¿Cargaste supabase/seed.sql?`,
    )
  }
  return data
}
