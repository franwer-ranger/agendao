import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type PublicBookingSummary = {
  publicId: string
  startsAt: string
  endsAt: string
  status: string
  clientHasEmail: boolean
  serviceName: string
  durationMinutes: number
  priceCents: number
  employeeName: string
}

// Resuelve una reserva por (salonId, publicId) para la pantalla pública de
// confirmación. Filtra siempre por salonId aunque publicId sea único globalmente:
// así un publicId de otro salón no se cruza con el slug equivocado en la URL.
export async function getPublicBookingByPublicId({
  salonId,
  publicId,
}: {
  salonId: number
  publicId: string
}): Promise<PublicBookingSummary | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      public_id,
      starts_at,
      ends_at,
      status,
      clients ( email ),
      booking_items (
        position,
        service_snapshot,
        employees ( display_name )
      )
    `,
    )
    .eq('salon_id', salonId)
    .eq('public_id', publicId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const items = Array.isArray(data.booking_items) ? data.booking_items : []
  const firstItem = [...items].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  )[0]
  if (!firstItem) return null

  const snapshot = (firstItem.service_snapshot ?? {}) as {
    name?: string
    duration_minutes?: number
    price_cents?: number
  }
  const employee = Array.isArray(firstItem.employees)
    ? firstItem.employees[0]
    : firstItem.employees
  const client = Array.isArray(data.clients)
    ? data.clients[0]
    : (data.clients as { email: string | null } | null)

  return {
    publicId: data.public_id as string,
    startsAt: data.starts_at as string,
    endsAt: data.ends_at as string,
    status: data.status as string,
    clientHasEmail: !!client?.email,
    serviceName: snapshot.name ?? 'Servicio',
    durationMinutes: snapshot.duration_minutes ?? 0,
    priceCents: snapshot.price_cents ?? 0,
    employeeName: (employee?.display_name as string | undefined) ?? '—',
  }
}
