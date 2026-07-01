import { and, asc, count, desc, eq, inArray, like, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { withTenant } from '@/lib/db/tenant'
import { employee_services, employees, services } from '@/lib/db/schema'

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

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

export async function listServices(
  {
    salonId,
    q,
  }: {
    salonId: number
    q?: string
  },
  tx?: TxDb,
): Promise<ServiceListRow[]> {
  const trimmed = q?.trim()
  const where =
    trimmed && trimmed.length > 0
      ? and(
          eq(services.salon_id, salonId),
          like(sql`lower(${services.name})`, `%${trimmed.toLowerCase()}%`),
        )
      : eq(services.salon_id, salonId)

  const run = async (t: TxDb) => {
    const rows = await t
      .select({
        id: services.id,
        name: services.name,
        duration_minutes: services.duration_minutes,
        price_cents: services.price_cents,
        max_concurrent: services.max_concurrent,
        is_active: services.is_active,
        display_order: services.display_order,
      })
      .from(services)
      .where(where)
      .orderBy(
        desc(services.is_active),
        asc(services.display_order),
        asc(services.name),
      )

    if (rows.length === 0) return []

    const counts = await t
      .select({
        service_id: employee_services.service_id,
        c: count(),
      })
      .from(employee_services)
      .where(
        inArray(
          employee_services.service_id,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(employee_services.service_id)

    const countBy = new Map(counts.map((r) => [r.service_id, r.c]))

    return rows.map((r) => ({
      ...r,
      employee_count: countBy.get(r.id) ?? 0,
    }))
  }
  return tx ? run(tx) : withTenant(salonId, run)
}

export async function getServiceById(
  id: number,
  salonId: number,
  tx?: TxDb,
): Promise<ServiceDetail | null> {
  const run = async (t: TxDb) => {
    const row = (
      await t
        .select({
          id: services.id,
          salon_id: services.salon_id,
          name: services.name,
          description: services.description,
          duration_minutes: services.duration_minutes,
          price_cents: services.price_cents,
          max_concurrent: services.max_concurrent,
          is_active: services.is_active,
        })
        .from(services)
        .where(and(eq(services.id, id), eq(services.salon_id, salonId)))
        .limit(1)
    )[0]

    if (!row) return null

    const empRows = await t
      .select({ employee_id: employee_services.employee_id })
      .from(employee_services)
      .where(eq(employee_services.service_id, id))

    return {
      ...row,
      employee_ids: empRows.map((r) => r.employee_id),
    }
  }
  return tx ? run(tx) : withTenant(salonId, run)
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
  tx?: TxDb,
): Promise<ServiceWithEmployees[]> {
  const run = async (t: TxDb) => {
    const rows = await t
      .select({
        id: services.id,
        name: services.name,
        duration_minutes: services.duration_minutes,
        price_cents: services.price_cents,
      })
      .from(services)
      .where(and(eq(services.salon_id, salonId), eq(services.is_active, true)))
      .orderBy(asc(services.display_order), asc(services.name))

    if (rows.length === 0) return []

    const assignments = await t
      .select({
        service_id: employee_services.service_id,
        employee_id: employee_services.employee_id,
      })
      .from(employee_services)
      .where(
        inArray(
          employee_services.service_id,
          rows.map((r) => r.id),
        ),
      )

    const empsBy = new Map<number, number[]>()
    for (const a of assignments) {
      const list = empsBy.get(a.service_id)
      if (list) list.push(a.employee_id)
      else empsBy.set(a.service_id, [a.employee_id])
    }

    return rows.map((r) => ({
      ...r,
      employee_ids: empsBy.get(r.id) ?? [],
    }))
  }
  return tx ? run(tx) : withTenant(salonId, run)
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
  tx?: TxDb,
): Promise<PublicServiceRow[]> {
  const run = (t: TxDb) =>
    t
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        duration_minutes: services.duration_minutes,
        price_cents: services.price_cents,
      })
      .from(services)
      .where(and(eq(services.salon_id, salonId), eq(services.is_active, true)))
      .orderBy(asc(services.display_order), asc(services.name))
  return tx ? run(tx) : withTenant(salonId, run)
}

export async function listEmployeesForSalon(
  salonId: number,
  tx?: TxDb,
): Promise<EmployeeOption[]> {
  const run = (t: TxDb) =>
    t
      .select({
        id: employees.id,
        display_name: employees.display_name,
        is_active: employees.is_active,
      })
      .from(employees)
      .where(eq(employees.salon_id, salonId))
      .orderBy(asc(employees.display_order), asc(employees.display_name))
  return tx ? run(tx) : withTenant(salonId, run)
}
