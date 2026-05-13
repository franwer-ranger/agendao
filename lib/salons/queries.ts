import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

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

// Resolución del salón por slug para el flujo público (URL /[salonSlug]/book/...).
// Envuelto con React `cache()` para que múltiples páginas/components de la misma
// request reusen el resultado sin refetch.
export const getSalonBySlug = cache(
  async (slug: string): Promise<SalonSettings | null> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('salons')
      .select(
        'id, slug, name, timezone, locale, address, phone, contact_email, logo_path, slot_granularity_minutes, booking_min_hours_ahead, booking_max_days_ahead, cancellation_min_hours, cancellation_policy_text, terms_text',
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    return (data ?? null) as SalonSettings | null
  },
)

export async function getSalonSettings(
  salonId: number,
): Promise<SalonSettings | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('salons')
    .select(
      'id, slug, name, timezone, locale, address, phone, contact_email, logo_path, slot_granularity_minutes, booking_min_hours_ahead, booking_max_days_ahead, cancellation_min_hours, cancellation_policy_text, terms_text',
    )
    .eq('id', salonId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as SalonSettings | null
}

export async function getSalonWorkingHours(
  salonId: number,
): Promise<SalonWorkingDay[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('salon_working_hours')
    .select('weekday, opens_at, closes_at')
    .eq('salon_id', salonId)
    .order('weekday', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    weekday: r.weekday,
    // Postgres devuelve `time` como 'HH:MM:SS'. Recortamos a HH:MM.
    opens_at: r.opens_at ? String(r.opens_at).slice(0, 5) : null,
    closes_at: r.closes_at ? String(r.closes_at).slice(0, 5) : null,
  }))
}

// Cierres del salón (futuros + en curso). `salon_closures.during` es tstzrange.
// PostgREST devuelve algo como '["2026-03-30T00:00:00+02:00","2026-04-06T00:00:00+02:00")'.
function parseTstzRange(
  value: string,
): { starts_at: string; ends_at: string } | null {
  const m = value.match(/^[[(]\s*"?([^",]+)"?\s*,\s*"?([^",)]+)"?\s*[\])]$/)
  if (!m) return null
  const [, lower, upper] = m
  return {
    starts_at: new Date(lower).toISOString(),
    ends_at: new Date(upper).toISOString(),
  }
}

export async function getSalonClosures(
  salonId: number,
  opts?: { includePast?: boolean },
): Promise<SalonClosure[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('salon_closures')
    .select('id, during, label')
    .eq('salon_id', salonId)
    .order('id', { ascending: false })

  if (error) throw error

  const now = Date.now()
  const rows: SalonClosure[] = []
  for (const r of data ?? []) {
    const range = parseTstzRange(String(r.during))
    if (!range) continue
    if (!opts?.includePast && new Date(range.ends_at).getTime() < now) continue
    rows.push({
      id: r.id,
      starts_at: range.starts_at,
      ends_at: range.ends_at,
      label: String(r.label),
    })
  }
  rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return rows
}

// URL pública del logo a partir del `logo_path` guardado en `salons.logo_path`.
// Devuelve null si no hay logo.
export function getLogoPublicUrl(logoPath: string | null): string | null {
  if (!logoPath) return null
  const supabase = createAdminClient()
  const { data } = supabase.storage.from('salon-assets').getPublicUrl(logoPath)
  return data.publicUrl
}
