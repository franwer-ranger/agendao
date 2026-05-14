import { z } from 'zod'

// Mismo regex que el check de Postgres para `employees.color_hex`.
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

// ─── Datos básicos del empleado ────────────────────────────────────────────
// Inputs vienen de FormData (strings); validamos + coercemos.
export const employeeFormSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  bio: z
    .string()
    .trim()
    .max(2000, 'Máximo 2000 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  color_hex: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (v === '') return
      if (!HEX_COLOR.test(v)) {
        ctx.addIssue({ code: 'custom', message: 'Color inválido (#RRGGBB)' })
      }
    })
    .transform((v) => (v === '' ? null : v.toLowerCase()))
    .nullable(),
  // Vacío => 0; si no, entero 0–9999.
  display_order: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (v === '') return
      if (!/^\d+$/.test(v)) {
        ctx.addIssue({ code: 'custom', message: 'Debe ser un entero ≥ 0' })
      }
    })
    .transform((v) => (v === '' ? 0 : Number(v)))
    .pipe(z.number().int().min(0).max(9999, 'Demasiado alto')),
  is_active: z
    .string()
    .transform((v) => v === 'true' || v === 'on')
    .or(z.boolean()),
  service_ids: z.array(z.coerce.number().int().positive()).default([]),
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

export function parseEmployeeFormData(formData: FormData) {
  const service_ids = formData
    .getAll('service_ids')
    .map((v) => String(v))
    .filter((v) => v.length > 0)

  const raw = {
    display_name: formData.get('display_name') ?? '',
    bio: formData.get('bio') ?? '',
    color_hex: formData.get('color_hex') ?? '',
    display_order: formData.get('display_order') ?? '',
    is_active: formData.get('is_active') ?? 'false',
    service_ids,
  }

  return employeeFormSchema.safeParse(raw)
}

// ─── Horario semanal ───────────────────────────────────────────────────────
// El editor envía un único campo `shifts` con JSON de la lista completa.
// Replace-all: lo que el cliente manda es lo que queda en BD.
const HHMM = /^\d{2}:\d{2}$/

const shiftSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  starts_at: z.string().regex(HHMM, 'Formato HH:MM'),
  ends_at: z.string().regex(HHMM, 'Formato HH:MM'),
})

export const weeklyScheduleSchema = z
  .object({ shifts: z.array(shiftSchema) })
  .superRefine((data, ctx) => {
    // 1) ends_at > starts_at por tramo
    data.shifts.forEach((s, idx) => {
      if (s.ends_at <= s.starts_at) {
        ctx.addIssue({
          code: 'custom',
          path: ['shifts', idx, 'ends_at'],
          message: 'La hora fin debe ser posterior a la hora inicio',
        })
      }
    })
    // 2) sin solapes dentro del mismo weekday
    const byDay = new Map<
      number,
      { start: string; end: string; idx: number }[]
    >()
    data.shifts.forEach((s, idx) => {
      const list = byDay.get(s.weekday) ?? []
      list.push({ start: s.starts_at, end: s.ends_at, idx })
      byDay.set(s.weekday, list)
    })
    for (const list of byDay.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start))
      for (let i = 1; i < list.length; i++) {
        if (list[i].start < list[i - 1].end) {
          ctx.addIssue({
            code: 'custom',
            path: ['shifts', list[i].idx, 'starts_at'],
            message: 'Este tramo se solapa con otro del mismo día',
          })
        }
      }
    }
  })

export type WeeklyScheduleValues = z.infer<typeof weeklyScheduleSchema>

export function parseWeeklyScheduleFormData(formData: FormData) {
  const raw = formData.get('shifts')
  let shifts: unknown
  try {
    shifts = raw ? JSON.parse(String(raw)) : []
  } catch {
    return weeklyScheduleSchema.safeParse({ shifts: 'invalid' })
  }
  return weeklyScheduleSchema.safeParse({ shifts })
}

// ─── Descansos recurrentes ─────────────────────────────────────────────────
const recurringBreakSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  starts_at: z.string().regex(HHMM, 'Formato HH:MM'),
  ends_at: z.string().regex(HHMM, 'Formato HH:MM'),
  label: z
    .string()
    .trim()
    .max(80, 'Máximo 80 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
})

export const recurringBreaksSchema = z
  .object({ breaks: z.array(recurringBreakSchema) })
  .superRefine((data, ctx) => {
    data.breaks.forEach((b, idx) => {
      if (b.ends_at <= b.starts_at) {
        ctx.addIssue({
          code: 'custom',
          path: ['breaks', idx, 'ends_at'],
          message: 'La hora fin debe ser posterior a la hora inicio',
        })
      }
    })
    const byDay = new Map<
      number,
      { start: string; end: string; idx: number }[]
    >()
    data.breaks.forEach((b, idx) => {
      const list = byDay.get(b.weekday) ?? []
      list.push({ start: b.starts_at, end: b.ends_at, idx })
      byDay.set(b.weekday, list)
    })
    for (const list of byDay.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start))
      for (let i = 1; i < list.length; i++) {
        if (list[i].start < list[i - 1].end) {
          ctx.addIssue({
            code: 'custom',
            path: ['breaks', list[i].idx, 'starts_at'],
            message: 'Este descanso se solapa con otro del mismo día',
          })
        }
      }
    }
  })

export type RecurringBreaksValues = z.infer<typeof recurringBreaksSchema>

export function parseRecurringBreaksFormData(formData: FormData) {
  const raw = formData.get('breaks')
  let breaks: unknown
  try {
    breaks = raw ? JSON.parse(String(raw)) : []
  } catch {
    return recurringBreaksSchema.safeParse({ breaks: 'invalid' })
  }
  return recurringBreaksSchema.safeParse({ breaks })
}

// ─── Time-off (vacaciones / ausencias) ─────────────────────────────────────
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const timeOffReasonValues = [
  'vacation',
  'sick',
  'personal',
  'training',
  'other',
] as const

export const timeOffCreateSchema = z
  .object({
    starts_on: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
    ends_on: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
    reason: z.enum(timeOffReasonValues),
    note: z
      .string()
      .trim()
      .max(500, 'Máximo 500 caracteres')
      .transform((v) => (v.length > 0 ? v : null))
      .nullable(),
  })
  .refine((d) => d.ends_on >= d.starts_on, {
    path: ['ends_on'],
    message: 'La fecha fin debe ser igual o posterior a la fecha inicio',
  })

export type TimeOffCreateValues = z.infer<typeof timeOffCreateSchema>

export function parseTimeOffCreateFormData(formData: FormData) {
  const raw = {
    starts_on: formData.get('starts_on') ?? '',
    ends_on: formData.get('ends_on') ?? '',
    reason: formData.get('reason') ?? '',
    note: formData.get('note') ?? '',
  }
  return timeOffCreateSchema.safeParse(raw)
}
