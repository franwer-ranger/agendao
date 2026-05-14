'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
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
  const supabase = createAdminClient()

  // Empleado pertenece al salón.
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id')
    .eq('id', parsed.data.employee_id)
    .eq('salon_id', salon.id)
    .maybeSingle()
  if (empErr) return { ok: false, message: empErr.message }
  if (!emp) return { ok: false, message: 'Empleado no encontrado en el salón.' }

  // Construir el rango UTC a partir de fecha local + horas locales del salón.
  // `salonDateToUtc` nos da la medianoche del día; sumamos minutos de cada hora.
  const dayStartUtc = salonDateToUtc(parsed.data.date, salon.timezone)
  const startsAt = new Date(
    dayStartUtc.getTime() + hhmmToMinutes(parsed.data.starts_at) * 60_000,
  )
  const endsAt = new Date(
    dayStartUtc.getTime() + hhmmToMinutes(parsed.data.ends_at) * 60_000,
  )

  const { data, error } = await supabase
    .from('employee_time_off')
    .insert({
      employee_id: parsed.data.employee_id,
      during: `[${startsAt.toISOString()},${endsAt.toISOString()})`,
      reason: parsed.data.reason,
      note: parsed.data.note,
    })
    .select('id')
    .single()

  if (error) {
    // El EXCLUDE de BD impide solapes con otros time-off del mismo empleado.
    return {
      ok: false,
      message: error.message.includes('exclude')
        ? 'Ya existe un bloqueo que solapa con ese rango.'
        : error.message,
    }
  }

  revalidatePath('/admin/calendar')
  return { ok: true, id: data.id }
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
