import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { hashPassword } from '@/lib/auth/password'
import { db } from '@/lib/db'
import { withTenant } from '@/lib/db/tenant'
import {
  app_users,
  employee_services,
  employee_weekly_schedule,
  employees,
  salon_working_hours,
  salons,
  services,
} from '@/lib/db/schema'
import { resolveUniqueEmployeeSlug } from '@/lib/employees/slug'
import { uploadSalonLogo } from '@/lib/salons/storage'
import { resolveUniqueServiceSlug } from '@/lib/services/slug'
import { createTrialLifecycle } from '@/lib/salons/lifecycle'
import { salonToday } from '@/lib/time'

import { setupPayloadSchema } from './schema'

export type SetupResult = {
  salonId: number
  salonSlug: string
  adminId: string
}

// Core testeable: crea toda la instancia en una transacción atómica y sube el
// logo después. NO hace signIn ni redirect — eso vive en `setupInstance`.
// Vive en archivo aparte para que el test de integración pueda importarlo sin
// arrastrar `next-auth`, que falla bajo el resolver ESM de Vitest.
export async function performSetup(
  payloadRaw: unknown,
  logoFile: File | null,
): Promise<SetupResult> {
  const parsed = setupPayloadSchema.safeParse(payloadRaw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Datos inválidos: ${issues}`)
  }
  const payload = parsed.data

  const slugCollision = (
    await db
      .select({ id: salons.id })
      .from(salons)
      .where(eq(salons.slug, payload.salon.slug))
      .limit(1)
  )[0]
  if (slugCollision) {
    throw new Error('Ese identificador de salón ya está en uso.')
  }

  // argon2 es async y costoso; se calcula fuera de la tx para no alargarla.
  const passwordHash = await hashPassword(payload.admin.password)

  const result = await db.transaction(async (tx) => {
    const insertedSalon = await tx
      .insert(salons)
      .values({
        slug: payload.salon.slug,
        name: payload.salon.identity.name,
        address: payload.salon.identity.address,
        phone: payload.salon.identity.phone,
        contact_email: payload.salon.identity.contact_email,
        cancellation_min_hours:
          payload.salon.cancellation.cancellation_min_hours,
        cancellation_policy_text:
          payload.salon.cancellation.cancellation_policy_text,
        terms_text: payload.salon.legal.terms_text,
        onboarding_completed_at: new Date(),
      })
      .returning({ id: salons.id })
    const salonRow = insertedSalon[0]
    if (!salonRow) throw new Error('No se pudo crear el salón')
    const salonId = salonRow.id

    // Chicken-egg: la policy INSERT de salons es abierta (`with check(true)`), así
    // que el salón se creó sin GUC. Ahora fijamos el tenant recién creado en ESTA
    // misma tx para que el resto de inserts (admin, servicios, empleados, horarios,
    // todos scoped por RLS) pasen el `with check`.
    await tx.execute(
      sql`select set_config('app.current_salon_id', ${String(salonId)}, true)`,
    )

    await createTrialLifecycle(salonId, tx)

    const hoursRows = payload.salon.workingHours.days
      .filter((d) => !d.closed && d.opens_at && d.closes_at)
      .map((d) => ({
        salon_id: salonId,
        weekday: d.weekday,
        opens_at: d.opens_at as string,
        closes_at: d.closes_at as string,
      }))
    if (hoursRows.length > 0) {
      await tx.insert(salon_working_hours).values(hoursRows)
    }

    // app_users.salon_id es NOT NULL → este orden (salón antes que usuario)
    // es obligatorio; el prompt original asumía UPDATE posterior y no funcionaría.
    const adminId = randomUUID()
    await tx.insert(app_users).values({
      id: adminId,
      salon_id: salonId,
      role: 'admin',
      email: payload.admin.email,
      password_hash: passwordHash,
      display_name: payload.admin.display_name,
      is_active: true,
    })

    const serviceIds: number[] = []
    for (const svc of payload.services) {
      const slug = await resolveUniqueServiceSlug(
        salonId,
        svc.name,
        undefined,
        tx,
      )
      const inserted = await tx
        .insert(services)
        .values({
          salon_id: salonId,
          name: svc.name,
          slug,
          duration_minutes: svc.duration_minutes,
          price_cents: svc.price_cents,
          is_active: true,
        })
        .returning({ id: services.id })
      if (!inserted[0]) throw new Error('No se pudo crear el servicio')
      serviceIds.push(inserted[0].id)
    }

    const employeeIds: number[] = []
    for (const emp of payload.employees) {
      const slug = await resolveUniqueEmployeeSlug(
        salonId,
        emp.display_name,
        undefined,
        tx,
      )
      const inserted = await tx
        .insert(employees)
        .values({
          salon_id: salonId,
          display_name: emp.display_name,
          slug,
          color_hex: emp.color_hex,
          is_active: true,
        })
        .returning({ id: employees.id })
      if (!inserted[0]) throw new Error('No se pudo crear el empleado')
      const employeeId = inserted[0].id
      employeeIds.push(employeeId)

      if (emp.weeklySchedule.length > 0) {
        // effective_from es NOT NULL sin default (schema Postgres); mismo
        // patrón que lib/employees/actions.ts (Task 10).
        const today = salonToday()
        await tx.insert(employee_weekly_schedule).values(
          emp.weeklySchedule.map((s) => ({
            employee_id: employeeId,
            weekday: s.weekday,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            effective_from: today,
          })),
        )
      }
    }

    const seen = new Set<string>()
    const links: { service_id: number; employee_id: number }[] = []
    for (const m of payload.matrix) {
      const sid = serviceIds[m.serviceIndex]
      const eid = employeeIds[m.employeeIndex]
      if (sid === undefined || eid === undefined) continue
      const key = `${sid}:${eid}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ service_id: sid, employee_id: eid })
    }
    if (links.length > 0) {
      await tx.insert(employee_services).values(links)
    }

    return { salonId, salonSlug: payload.salon.slug, adminId }
  })

  // Logo fuera de la tx (sharp + fs son async). Si falla, el salón queda creado
  // sin logo; el admin podrá subirlo desde /admin/salon. No bloquea el wizard.
  if (logoFile && logoFile.size > 0) {
    try {
      const logoPath = await uploadSalonLogo(result.salonId, logoFile)
      await withTenant(result.salonId, (tx) =>
        tx
          .update(salons)
          .set({ logo_path: logoPath })
          .where(eq(salons.id, result.salonId)),
      )
    } catch (err) {
      console.warn('[setup] no se pudo subir el logo:', err)
    }
  }

  return result
}
