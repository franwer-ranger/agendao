import { createAdminClient } from '@/lib/supabase/admin'
import { parseTstzRange } from '@/lib/availability/intervals'

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type EmployeeListRow = {
  id: number
  display_name: string
  is_active: boolean
  display_order: number
  service_count: number
}

export type EmployeeDetail = {
  id: number
  salon_id: number
  display_name: string
  bio: string | null
  is_active: boolean
  display_order: number
  service_ids: number[]
}

export type WeeklyShift = {
  id: number
  weekday: number
  starts_at: string
  ends_at: string
}

export type RecurringBreak = {
  id: number
  weekday: number
  starts_at: string
  ends_at: string
  label: string | null
}

export type TimeOffReason =
  | 'vacation'
  | 'sick'
  | 'personal'
  | 'training'
  | 'other'

export type TimeOffEntry = {
  id: number
  starts_at: string
  ends_at: string
  reason: TimeOffReason
  note: string | null
}

export type ServiceOption = {
  id: number
  name: string
  is_active: boolean
}

export async function getPublicEmployeeName({
  salonId,
  employeeId,
}: {
  salonId: number
  employeeId: number
}): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('employees')
    .select('display_name, is_active')
    .eq('id', employeeId)
    .eq('salon_id', salonId)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.is_active) return null
  return data.display_name as string
}

export type PublicEmployeeRow = {
  id: number
  display_name: string
  bio: string | null
}

// Empleados visibles en el paso 2 del flujo público de reserva: activos y
// autorizados para el servicio elegido. Ordenados por display_order y nombre,
// como el listing admin, para que la fila "más arriba" sea consistente.
export async function listPublicEmployeesForService({
  salonId,
  serviceId,
}: {
  salonId: number
  serviceId: number
}): Promise<PublicEmployeeRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, display_name, bio, employee_services!inner(service_id)')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .eq('employee_services.service_id', serviceId)
    .order('display_order', { ascending: true })
    .order('display_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as number,
    display_name: row.display_name as string,
    bio: (row.bio as string | null) ?? null,
  }))
}

// ─── Listado ───────────────────────────────────────────────────────────────

export async function listEmployees({
  salonId,
  q,
}: {
  salonId: number
  q?: string
}): Promise<EmployeeListRow[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('employees')
    .select(
      'id, display_name, is_active, display_order, employee_services(count)',
    )
    .eq('salon_id', salonId)
    .order('is_active', { ascending: false })
    .order('display_order', { ascending: true })
    .order('display_name', { ascending: true })

  if (q && q.trim().length > 0) {
    query = query.ilike('display_name', `%${q.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    display_name: row.display_name,
    is_active: row.is_active,
    display_order: row.display_order,
    service_count:
      Array.isArray(row.employee_services) && row.employee_services[0]
        ? (row.employee_services[0] as { count: number }).count
        : 0,
  }))
}

// ─── Ficha ─────────────────────────────────────────────────────────────────

export async function getEmployeeById(
  id: number,
  salonId: number,
): Promise<EmployeeDetail | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('employees')
    .select(
      'id, salon_id, display_name, bio, is_active, display_order, employee_services(service_id)',
    )
    .eq('id', id)
    .eq('salon_id', salonId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const service_ids = Array.isArray(data.employee_services)
    ? (data.employee_services as { service_id: number }[]).map(
        (r) => r.service_id,
      )
    : []

  return {
    id: data.id,
    salon_id: data.salon_id,
    display_name: data.display_name,
    bio: data.bio,
    is_active: data.is_active,
    display_order: data.display_order,
    service_ids,
  }
}

// ─── Horario semanal (filas vivas: effective_until is null) ────────────────

export async function getWeeklySchedule(
  employeeId: number,
): Promise<WeeklyShift[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('employee_weekly_schedule')
    .select('id, weekday, starts_at, ends_at')
    .eq('employee_id', employeeId)
    .is('effective_until', null)
    .order('weekday', { ascending: true })
    .order('starts_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    weekday: r.weekday,
    // Postgres devuelve `time` como 'HH:MM:SS'. Recortamos a HH:MM para el editor.
    starts_at: String(r.starts_at).slice(0, 5),
    ends_at: String(r.ends_at).slice(0, 5),
  }))
}

// ─── Descansos recurrentes ─────────────────────────────────────────────────

export async function getRecurringBreaks(
  employeeId: number,
): Promise<RecurringBreak[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('employee_recurring_breaks')
    .select('id, weekday, starts_at, ends_at, label')
    .eq('employee_id', employeeId)
    .is('effective_until', null)
    .order('weekday', { ascending: true })
    .order('starts_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    weekday: r.weekday,
    starts_at: String(r.starts_at).slice(0, 5),
    ends_at: String(r.ends_at).slice(0, 5),
    label: r.label,
  }))
}

// ─── Time-off ──────────────────────────────────────────────────────────────

export async function getTimeOff(
  employeeId: number,
  opts?: { includePast?: boolean },
): Promise<TimeOffEntry[]> {
  const supabase = createAdminClient()

  // `lower(during)` no es filtrable directamente desde PostgREST sin RPC,
  // así que traemos todo y filtramos en TS. Volumen esperado bajo (decenas).
  const { data, error } = await supabase
    .from('employee_time_off')
    .select('id, during, reason, note')
    .eq('employee_id', employeeId)
    .order('id', { ascending: false })

  if (error) throw error

  const now = Date.now()
  const rows: TimeOffEntry[] = []
  for (const r of data ?? []) {
    const range = parseTstzRange(String(r.during))
    if (!range) continue
    if (!opts?.includePast && new Date(range.ends_at).getTime() < now) continue
    rows.push({
      id: r.id,
      starts_at: range.starts_at,
      ends_at: range.ends_at,
      reason: r.reason as TimeOffReason,
      note: r.note,
    })
  }
  rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return rows
}

// ─── Servicios disponibles del salón (para el multiselect) ─────────────────

export async function listServicesForSalon(
  salonId: number,
): Promise<ServiceOption[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('services')
    .select('id, name, is_active')
    .eq('salon_id', salonId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}
