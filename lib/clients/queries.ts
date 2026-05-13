import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type UpsertClientForBookingInput = {
  salonId: number
  displayName: string
  phone: string | null
  email: string | null
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

  const supabase = createAdminClient()

  if (input.email) {
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('salon_id', input.salonId)
      .eq('email', input.email)
      .maybeSingle()
    if (error) throw error
    if (data) return { id: Number(data.id) }
  }

  if (input.phone) {
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('salon_id', input.salonId)
      .eq('phone', input.phone)
      .maybeSingle()
    if (error) throw error
    if (data) return { id: Number(data.id) }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      salon_id: input.salonId,
      display_name: input.displayName,
      email: input.email,
      phone: input.phone,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: Number(data.id) }
}
