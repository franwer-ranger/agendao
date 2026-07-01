'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, gt, lt } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { employee_time_off, employees } from '@/lib/db/schema'
import { getCurrentSalon } from '@/lib/salon'
import { salonDateToUtc } from '@/lib/time'

const HHMM = /^\d{2}:\d{2}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const REASONS = ['vacation', 'sick', 'personal', 'training', 'other'] as const

const createBlockSchema = z
  .object({
    employee_id: z.coerce.number().int().positive(),
    date: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
    starts_at: z.string().regex(HHMM, 'Formato HH:MM'),
    ends_at: z.string().regex(HHMM, 'Formato HH:MM'),
    reason: z.enum(REASONS),
    note: z
      .string()
      .trim()
      .max(500, 'Máximo 500 caracteres')
      .transform((v) => (v.length > 0 ? v : null))
      .nullable(),
  })
  .refine((d) => d.ends_at > d.starts_at, {
    path: ['ends_at'],
    message: 'La hora fin debe ser posterior a la hora inicio',
  })

export type CreateBlockResult =
  | { ok: true; id: number }
  | {
      ok: false
      message?: string
      fieldErrors?: Record<string, string[]>
    }

export async function createBlockAction(
  raw: z.input<typeof createBlockSchema>,
): Promise<CreateBlockResult> {
  const parsed = createBlockSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_')
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { ok: false, fieldErrors }
  }

  const salon = await getCurrentSalon()

  // Construir el rango UTC a partir de fecha local + horas locales del salón.
  // `salonDateToUtc` nos da la medianoche del día; sumamos minutos de cada hora.
  const dayStartUtc = salonDateToUtc(parsed.data.date, salon.timezone)
  const startsAt = new Date(
    dayStartUtc.getTime() + hhmmToMinutes(parsed.data.starts_at) * 60_000,
  )
  const endsAt = new Date(
    dayStartUtc.getTime() + hhmmToMinutes(parsed.data.ends_at) * 60_000,
  )

  try {
    const id = await db.transaction(async (tx) => {
      // Pertenencia al salón.
      const emp = (
        await tx
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.id, parsed.data.employee_id),
              eq(employees.salon_id, salon.id),
            ),
          )
          .limit(1)
      )[0]
      if (!emp) {
        throw new Error('Empleado no encontrado en el salón.')
      }

      // Replica del EXCLUDE GIST: rechazar si solapa con otro time-off
      // del mismo empleado. Half-open: start < otherEnd AND end > otherStart.
      const overlap = (
        await tx
          .select({ id: employee_time_off.id })
          .from(employee_time_off)
          .where(
            and(
              eq(employee_time_off.employee_id, parsed.data.employee_id),
              lt(employee_time_off.starts_at, endsAt),
              gt(employee_time_off.ends_at, startsAt),
            ),
          )
          .limit(1)
      )[0]
      if (overlap) {
        throw new Error('Ya existe un bloqueo que solapa con ese rango.')
      }

      const inserted = await tx
        .insert(employee_time_off)
        .values({
          employee_id: parsed.data.employee_id,
          starts_at: startsAt,
          ends_at: endsAt,
          reason: parsed.data.reason,
          note: parsed.data.note,
        })
        .returning({ id: employee_time_off.id })
      const created = inserted[0]
      if (!created) throw new Error('No se pudo crear el bloqueo.')
      return created.id
    })

    revalidatePath('/admin/calendar')
    return { ok: true, id }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
