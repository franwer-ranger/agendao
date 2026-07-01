import 'server-only'
import { asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { withTenant } from '@/lib/db/tenant'
import {
  booking_items,
  bookings,
  clients,
  employees,
  salons,
} from '@/lib/db/schema'
import { getLogoPublicUrl } from '@/lib/salons/queries'
import type { BookingEmailContext } from './types'

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Carga todo lo que necesita una plantilla a partir del id interno de reserva.
// Una sola función: las plantillas son consistentes entre eventos (creación,
// recordatorio, cancelación), así que el view-model es el mismo.
//
// `salonId` es necesario para fijar el tenant (bajo RLS, sin GUC estas queries
// devuelven 0 filas → null). Es opcional sólo para no romper la compilación de
// los callers todavía-sin-adaptar (triggers de email, 17b/17c): sin salonId la
// función corre sin GUC y devuelve null (fail-closed), igual que hoy bajo RLS.
export async function loadBookingEmailContext(
  bookingId: number,
  salonId?: number,
  tx?: TxDb,
): Promise<BookingEmailContext | null> {
  const run = async (t: TxDb): Promise<BookingEmailContext | null> => {
    const head = (
      await t
        .select({
          booking_id: bookings.id,
          booking_public_id: bookings.public_id,
          booking_starts_at: bookings.starts_at,
          booking_ends_at: bookings.ends_at,
          salon_id: salons.id,
          salon_name: salons.name,
          salon_timezone: salons.timezone,
          salon_address: salons.address,
          salon_phone: salons.phone,
          salon_contact_email: salons.contact_email,
          salon_logo_path: salons.logo_path,
          salon_cancellation_min_hours: salons.cancellation_min_hours,
          salon_cancellation_policy_text: salons.cancellation_policy_text,
          client_display_name: clients.display_name,
          client_email: clients.email,
        })
        .from(bookings)
        .innerJoin(clients, eq(clients.id, bookings.client_id))
        .innerJoin(salons, eq(salons.id, bookings.salon_id))
        .where(eq(bookings.id, bookingId))
        .limit(1)
    )[0]
    if (!head) return null

    const itemRows = await t
      .select({
        position: booking_items.position,
        service_snapshot: booking_items.service_snapshot,
        employee_name: employees.display_name,
      })
      .from(booking_items)
      .innerJoin(employees, eq(employees.id, booking_items.employee_id))
      .where(eq(booking_items.booking_id, bookingId))
      .orderBy(asc(booking_items.position))

    const items = itemRows.map((it) => {
      const snap = it.service_snapshot as {
        name?: string
        duration_minutes?: number
        price_cents?: number
      }
      return {
        serviceName: snap.name ?? '',
        employeeName: it.employee_name,
        durationMinutes: snap.duration_minutes ?? 0,
        priceCents: snap.price_cents ?? 0,
      }
    })

    const totalCents = items.reduce((acc, i) => acc + i.priceCents, 0)

    return {
      salon: {
        id: head.salon_id,
        name: head.salon_name,
        timezone: head.salon_timezone,
        address: head.salon_address,
        phone: head.salon_phone,
        contactEmail: head.salon_contact_email,
        logoUrl: getLogoPublicUrl(head.salon_logo_path),
        cancellationMinHours: head.salon_cancellation_min_hours,
        cancellationPolicyText: head.salon_cancellation_policy_text,
      },
      client: {
        displayName: head.client_display_name,
        email: head.client_email ?? '',
      },
      booking: {
        publicId: head.booking_public_id,
        startsAt: head.booking_starts_at.toISOString(),
        endsAt: head.booking_ends_at.toISOString(),
        totalCents,
        items,
      },
    }
  }

  if (tx) return run(tx)
  if (salonId != null) return withTenant(salonId, run)
  // Sin tenant fijado (caller aún sin adaptar): sin GUC, bajo RLS las queries
  // devuelven 0 filas → null. La tx vacía mantiene los tipos correctos.
  return db.transaction(run)
}

// Carga solo lo mínimo del salón para tomar la decisión de notificación. Útil
// cuando solo necesitas saber si el flag está activo, sin pagar la query
// completa.
export async function getSalonNotificationConfig(
  salonId: number,
  tx?: TxDb,
): Promise<{
  notifySalon: boolean
  contactEmail: string | null
} | null> {
  const run = async (t: TxDb) => {
    const row = (
      await t
        .select({
          notifySalon: salons.notify_salon_on_new_booking,
          contactEmail: salons.contact_email,
        })
        .from(salons)
        .where(eq(salons.id, salonId))
        .limit(1)
    )[0]
    return row ?? null
  }
  return tx ? run(tx) : withTenant(salonId, run)
}
