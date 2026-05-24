'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { employee_services, employees, services } from '@/lib/db/schema'
import { getCurrentSalon } from '@/lib/salon'
import { parseServiceFormData } from '@/lib/services/schema'
import { resolveUniqueServiceSlug } from '@/lib/services/slug'

export type ActionState = {
  ok: boolean
  message?: string
  errors?: Record<string, string[]>
}

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

function syncEmployeeAssignments(
  serviceId: number,
  salonId: number,
  desiredEmployeeIds: number[],
  tx: TxDb,
): void {
  // Validate the IDs all belong to this salon (defense in depth — the form
  // only renders salon employees, but the action is the trust boundary).
  let desired = desiredEmployeeIds
  if (desired.length > 0) {
    const validRows = tx
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(eq(employees.salon_id, salonId), inArray(employees.id, desired)),
      )
      .all()
    const validSet = new Set(validRows.map((r) => r.id))
    desired = desired.filter((id) => validSet.has(id))
  }

  const existing = tx
    .select({ employee_id: employee_services.employee_id })
    .from(employee_services)
    .where(eq(employee_services.service_id, serviceId))
    .all()

  const existingIds = new Set(existing.map((r) => r.employee_id))
  const desiredSet = new Set(desired)

  const toAdd = [...desiredSet].filter((id) => !existingIds.has(id))
  const toRemove = [...existingIds].filter((id) => !desiredSet.has(id))

  if (toRemove.length > 0) {
    tx.delete(employee_services)
      .where(
        and(
          eq(employee_services.service_id, serviceId),
          inArray(employee_services.employee_id, toRemove),
        ),
      )
      .run()
  }

  if (toAdd.length > 0) {
    tx.insert(employee_services)
      .values(
        toAdd.map((employee_id) => ({ employee_id, service_id: serviceId })),
      )
      .run()
  }
}

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseServiceFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  try {
    db.transaction((tx) => {
      const slug = resolveUniqueServiceSlug(
        salon.id,
        parsed.data.name,
        undefined,
        tx,
      )
      const inserted = tx
        .insert(services)
        .values({
          salon_id: salon.id,
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          duration_minutes: parsed.data.duration_minutes,
          price_cents: parsed.data.price_cents,
          max_concurrent: parsed.data.max_concurrent,
          is_active: parsed.data.is_active,
        })
        .returning({ id: services.id })
        .all()
      const created = inserted[0]
      if (!created) throw new Error('No se pudo crear el servicio')

      syncEmployeeAssignments(
        created.id,
        salon.id,
        parsed.data.employee_ids,
        tx,
      )
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath('/admin/services')
  redirect('/admin/services')
}

export async function updateServiceAction(
  serviceId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseServiceFormData(formData)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const salon = await getCurrentSalon()

  try {
    db.transaction((tx) => {
      const current = tx
        .select({
          id: services.id,
          name: services.name,
          slug: services.slug,
        })
        .from(services)
        .where(and(eq(services.id, serviceId), eq(services.salon_id, salon.id)))
        .get()
      if (!current) throw new Error('Servicio no encontrado')

      const slug =
        current.name === parsed.data.name
          ? current.slug
          : resolveUniqueServiceSlug(salon.id, parsed.data.name, serviceId, tx)

      tx.update(services)
        .set({
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          duration_minutes: parsed.data.duration_minutes,
          price_cents: parsed.data.price_cents,
          max_concurrent: parsed.data.max_concurrent,
          is_active: parsed.data.is_active,
        })
        .where(and(eq(services.id, serviceId), eq(services.salon_id, salon.id)))
        .run()

      syncEmployeeAssignments(serviceId, salon.id, parsed.data.employee_ids, tx)
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }

  revalidatePath('/admin/services')
  redirect('/admin/services')
}

export async function setServiceActiveAction(
  formData: FormData,
): Promise<void> {
  const idRaw = formData.get('id')
  const activeRaw = formData.get('active')
  const id = Number(idRaw)
  const active = activeRaw === 'true'
  if (!Number.isFinite(id) || id <= 0) return

  const salon = await getCurrentSalon()

  db.update(services)
    .set({ is_active: active })
    .where(and(eq(services.id, id), eq(services.salon_id, salon.id)))
    .run()

  revalidatePath('/admin/services')
}
