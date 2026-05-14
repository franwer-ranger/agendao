import { createAdminClient } from '@/lib/supabase/admin'

export type ServiceListRow = {
  id: number
  name: string
  duration_minutes: number
  price_cents: number
  max_concurrent: number | null
  is_active: boolean
  display_order: number
  employee_count: number
}

export type ServiceDetail = {
  id: number
  salon_id: number
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  max_concurrent: number | null
  is_active: boolean
  employee_ids: number[]
}

export type EmployeeOption = {
  id: number
  display_name: string
  is_active: boolean
}

export async function listServices({
  salonId,
  q,
}: {
  salonId: number
  q?: string
}): Promise<ServiceListRow[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('services')
    .select(
      'id, name, duration_minutes, price_cents, max_concurrent, is_active, display_order, employee_services(count)',
    )
    .eq('salon_id', salonId)
    .order('is_active', { ascending: false })
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (q && q.trim().length > 0) {
    query = query.ilike('name', `%${q.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    duration_minutes: row.duration_minutes,
    price_cents: row.price_cents,
    max_concurrent: row.max_concurrent,
    is_active: row.is_active,
    display_order: row.display_order,
    employee_count:
      Array.isArray(row.employee_services) && row.employee_services[0]
        ? (row.employee_services[0] as { count: number }).count
        : 0,
  }))
}

export async function getServiceById(
  id: number,
  salonId: number,
): Promise<ServiceDetail | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('services')
    .select(
      'id, salon_id, name, description, duration_minutes, price_cents, max_concurrent, is_active, employee_services(employee_id)',
    )
    .eq('id', id)
    .eq('salon_id', salonId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const employee_ids = Array.isArray(data.employee_services)
    ? (data.employee_services as { employee_id: number }[]).map(
        (r) => r.employee_id,
      )
    : []

  return {
    id: data.id,
    salon_id: data.salon_id,
    name: data.name,
    description: data.description,
    duration_minutes: data.duration_minutes,
    price_cents: data.price_cents,
    max_concurrent: data.max_concurrent,
    is_active: data.is_active,
    employee_ids,
  }
}

// Servicios activos del salón con la lista de empleados que pueden hacer
// cada uno. Usado por el sheet de creación manual de reservas (admin).
export type ServiceWithEmployees = {
  id: number
  name: string
  duration_minutes: number
  price_cents: number
  employee_ids: number[]
}

export async function listActiveServicesWithEmployees(
  salonId: number,
): Promise<ServiceWithEmployees[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('services')
    .select(
      'id, name, duration_minutes, price_cents, is_active, display_order, employee_services(employee_id)',
    )
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    duration_minutes: row.duration_minutes,
    price_cents: row.price_cents,
    employee_ids: Array.isArray(row.employee_services)
      ? (row.employee_services as { employee_id: number }[]).map(
          (r) => r.employee_id,
        )
      : [],
  }))
}

export type PublicServiceRow = {
  id: number
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
}

// Servicios visibles en el flujo público de reserva: sólo activos, con los
// campos que la UI necesita para pintar la tarjeta de selección. Mantiene
// orden por display_order y nombre, igual que el listing admin.
export async function listPublicServices(
  salonId: number,
): Promise<PublicServiceRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price_cents')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as PublicServiceRow[]
}

export async function listEmployeesForSalon(
  salonId: number,
): Promise<EmployeeOption[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, display_name, is_active')
    .eq('salon_id', salonId)
    .order('display_order', { ascending: true })
    .order('display_name', { ascending: true })

  if (error) throw error
  return data ?? []
}
