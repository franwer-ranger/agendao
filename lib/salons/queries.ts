import { cache } from 'react'
import { and, asc, desc, eq, gte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { salon_closures, salon_working_hours, salons } from '@/lib/db/schema'
import { getPublicUrl } from '@/lib/storage'

export type SalonSettings = {
  id: number
  slug: string
  name: string
  timezone: string
  locale: string
  address: string | null
  phone: string | null
  contact_email: string | null
  logo_path: string | null
  slot_granularity_minutes: number
  booking_min_hours_ahead: number
  booking_max_days_ahead: number
  cancellation_min_hours: number
  cancellation_policy_text: string | null
  terms_text: string | null
}

export type SalonWorkingDay = {
  weekday: number
  opens_at: string | null
  closes_at: string | null
}

export type SalonClosure = {
  id: number
  starts_at: string
  ends_at: string
  label: string
}

const SALON_SETTINGS_COLUMNS = {
  id: salons.id,
  slug: salons.slug,
  name: salons.name,
  timezone: salons.timezone,
  locale: salons.locale,
  address: salons.address,
  phone: salons.phone,
  contact_email: salons.contact_email,
  logo_path: salons.logo_path,
  slot_granularity_minutes: salons.slot_granularity_minutes,
  booking_min_hours_ahead: salons.booking_min_hours_ahead,
  booking_max_days_ahead: salons.booking_max_days_ahead,
  cancellation_min_hours: salons.cancellation_min_hours,
  cancellation_policy_text: salons.cancellation_policy_text,
  terms_text: salons.terms_text,
} as const

// Resolución del salón por slug para el flujo público (URL /[salonSlug]/book/...).
// Envuelto con React `cache()` para que múltiples páginas/components de la misma
// request reusen el resultado sin refetch.
export const getSalonBySlug = cache(
  async (slug: string): Promise<SalonSettings | null> => {
    const row = db
      .select(SALON_SETTINGS_COLUMNS)
      .from(salons)
      .where(eq(salons.slug, slug))
      .get()
    return row ?? null
  },
)

export async function getSalonSettings(
  salonId: number,
): Promise<SalonSettings | null> {
  const row = db
    .select(SALON_SETTINGS_COLUMNS)
    .from(salons)
    .where(eq(salons.id, salonId))
    .get()
  return row ?? null
}

export async function getSalonWorkingHours(
  salonId: number,
): Promise<SalonWorkingDay[]> {
  const rows = db
    .select({
      weekday: salon_working_hours.weekday,
      opens_at: salon_working_hours.opens_at,
      closes_at: salon_working_hours.closes_at,
    })
    .from(salon_working_hours)
    .where(eq(salon_working_hours.salon_id, salonId))
    .orderBy(asc(salon_working_hours.weekday))
    .all()

  return rows.map((r) => ({
    weekday: r.weekday,
    // En SQLite guardamos 'HH:MM' directamente; .slice defensivo por si alguna
    // fila histórica trajera segundos.
    opens_at: r.opens_at ? r.opens_at.slice(0, 5) : null,
    closes_at: r.closes_at ? r.closes_at.slice(0, 5) : null,
  }))
}

export async function getSalonClosures(
  salonId: number,
  opts?: { includePast?: boolean },
): Promise<SalonClosure[]> {
  const where = opts?.includePast
    ? eq(salon_closures.salon_id, salonId)
    : and(
        eq(salon_closures.salon_id, salonId),
        gte(salon_closures.ends_at, new Date()),
      )

  const rows = db
    .select({
      id: salon_closures.id,
      starts_at: salon_closures.starts_at,
      ends_at: salon_closures.ends_at,
      label: salon_closures.label,
    })
    .from(salon_closures)
    .where(where)
    .orderBy(desc(salon_closures.id))
    .all()

  const out = rows.map((r) => ({
    id: r.id,
    starts_at: r.starts_at.toISOString(),
    ends_at: r.ends_at.toISOString(),
    label: r.label,
  }))
  out.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return out
}

// URL pública absoluta del logo. Devuelve null si no hay logo o si el archivo
// referenciado por logo_path no existe en disco (estado inconsistente).
export function getLogoPublicUrl(logoPath: string | null): string | null {
  return getPublicUrl(logoPath)
}
