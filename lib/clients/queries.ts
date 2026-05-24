import 'server-only'
import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

export type UpsertClientForBookingInput = {
  salonId: number
  displayName: string
  phone: string | null
  email: string | null
}

function isSqliteUniqueError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}

function selectByEmail(salonId: number, email: string): number | null {
  // `clients.email` está declarado con `collate nocase` → la comparación
  // ya es case-insensitive sin lower().
  const row = db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.salon_id, salonId), eq(clients.email, email)))
    .limit(1)
    .get()
  return row?.id ?? null
}

function selectByPhone(salonId: number, phone: string): number | null {
  const row = db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.salon_id, salonId), eq(clients.phone, phone)))
    .limit(1)
    .get()
  return row?.id ?? null
}

// Upsert pensado para el flujo público de reserva.
// La tabla `clients` tiene CHECK (email IS NOT NULL OR phone IS NOT NULL) y
// unique indexes parciales por (salon_id, email) y (salon_id, phone).
//
// Estrategia: buscar primero por email, luego por phone, e insertar si no
// existe. No actualizamos el display_name del cliente existente: si la misma
// persona vuelve a reservar pero con otro nombre, respetamos el dato original
// (el salón es dueño de ese campo). El email/phone que ya están unique deciden
// la identidad.
export async function upsertClientForBooking(
  input: UpsertClientForBookingInput,
): Promise<{ id: number }> {
  if (!input.email && !input.phone) {
    throw new Error('clients_upsert_requires_email_or_phone')
  }

  if (input.email) {
    const id = selectByEmail(input.salonId, input.email)
    if (id !== null) return { id }
  }
  if (input.phone) {
    const id = selectByPhone(input.salonId, input.phone)
    if (id !== null) return { id }
  }

  try {
    const inserted = db
      .insert(clients)
      .values({
        salon_id: input.salonId,
        display_name: input.displayName,
        email: input.email,
        phone: input.phone,
      })
      .returning({ id: clients.id })
      .all()
    const created = inserted[0]
    if (!created) throw new Error('No se pudo crear el cliente')
    return { id: created.id }
  } catch (e) {
    // Carrera: otra request creó el mismo cliente entre nuestros SELECT y el
    // INSERT. La UNIQUE parcial saltó; re-leemos para devolver el id ganador.
    if (isSqliteUniqueError(e)) {
      if (input.email) {
        const id = selectByEmail(input.salonId, input.email)
        if (id !== null) return { id }
      }
      if (input.phone) {
        const id = selectByPhone(input.salonId, input.phone)
        if (id !== null) return { id }
      }
    }
    throw e
  }
}
