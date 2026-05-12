import { z } from 'zod'

const HHMM = /^\d{2}:\d{2}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// ─── Identidad ─────────────────────────────────────────────────────────────

export const identityFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  address: z
    .string()
    .trim()
    .max(300, 'Máximo 300 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  phone: z
    .string()
    .trim()
    .max(30, 'Máximo 30 caracteres')
    .superRefine((v, ctx) => {
      if (v === '') return
      if (!/^[+0-9 ().\-/]{6,}$/.test(v)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Formato no válido (sólo cifras, espacios y +-./()).',
        })
      }
    })
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  contact_email: z
    .string()
    .trim()
    .max(254, 'Demasiado largo')
    .superRefine((v, ctx) => {
      if (v === '') return
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        ctx.addIssue({ code: 'custom', message: 'Email no válido' })
      }
    })
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  remove_logo: z
    .string()
    .transform((v) => v === 'true' || v === 'on')
    .or(z.boolean())
    .default(false),
})

export type IdentityFormValues = z.infer<typeof identityFormSchema>

export function parseIdentityFormData(formData: FormData) {
  const raw = {
    name: formData.get('name') ?? '',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    contact_email: formData.get('contact_email') ?? '',
    remove_logo: formData.get('remove_logo') ?? 'false',
  }
  return identityFormSchema.safeParse(raw)
}

// ─── Horario semanal ───────────────────────────────────────────────────────
// 7 entradas (una por weekday). Si `closed=true`, opens/closes son ignorados
// y la fila se omite al guardar (no-fila = cerrado).

const dayHoursSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  closed: z.boolean(),
  opens_at: z.string().regex(HHMM, 'Formato HH:MM').or(z.literal('')),
  closes_at: z.string().regex(HHMM, 'Formato HH:MM').or(z.literal('')),
})

export const workingHoursSchema = z
  .object({ days: z.array(dayHoursSchema) })
  .superRefine((data, ctx) => {
    const seen = new Set<number>()
    data.days.forEach((d, idx) => {
      if (seen.has(d.weekday)) {
        ctx.addIssue({
          code: 'custom',
          path: ['days', idx, 'weekday'],
          message: 'Weekday duplicado',
        })
      }
      seen.add(d.weekday)
      if (d.closed) return
      if (!d.opens_at || !d.closes_at) {
        ctx.addIssue({
          code: 'custom',
          path: ['days', idx, 'opens_at'],
          message: 'Define hora de apertura y cierre, o marca el día como cerrado',
        })
        return
      }
      if (d.closes_at <= d.opens_at) {
        ctx.addIssue({
          code: 'custom',
          path: ['days', idx, 'closes_at'],
          message: 'La hora de cierre debe ser posterior a la apertura',
        })
      }
    })
  })

export type WorkingHoursValues = z.infer<typeof workingHoursSchema>

export function parseWorkingHoursFormData(formData: FormData) {
  const raw = formData.get('days')
  let days: unknown
  try {
    days = raw ? JSON.parse(String(raw)) : []
  } catch {
    return workingHoursSchema.safeParse({ days: 'invalid' })
  }
  return workingHoursSchema.safeParse({ days })
}

// ─── Cierres puntuales del salón ───────────────────────────────────────────

export const closureCreateSchema = z
  .object({
    starts_on: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
    ends_on: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
    label: z
      .string()
      .trim()
      .min(1, 'El motivo es obligatorio')
      .max(120, 'Máximo 120 caracteres'),
  })
  .refine((d) => d.ends_on >= d.starts_on, {
    path: ['ends_on'],
    message: 'La fecha fin debe ser igual o posterior a la fecha inicio',
  })

export type ClosureCreateValues = z.infer<typeof closureCreateSchema>

export function parseClosureCreateFormData(formData: FormData) {
  const raw = {
    starts_on: formData.get('starts_on') ?? '',
    ends_on: formData.get('ends_on') ?? '',
    label: formData.get('label') ?? '',
  }
  return closureCreateSchema.safeParse(raw)
}

// ─── Reservas (granularidad, antelación) ───────────────────────────────────

const SLOT_GRANULARITIES = [5, 10, 15, 20, 30, 60] as const

export const bookingsFormSchema = z.object({
  slot_granularity_minutes: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Debe ser un número entero')
    .transform((v) => Number(v))
    .pipe(
      z
        .number()
        .int()
        .refine(
          (v) =>
            (SLOT_GRANULARITIES as readonly number[]).includes(v),
          'Valor no permitido (5, 10, 15, 20, 30 o 60)',
        ),
    ),
  booking_min_hours_ahead: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Debe ser un número entero')
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0).max(168, 'Máximo 168 (una semana)')),
  booking_max_days_ahead: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Debe ser un número entero')
    .transform((v) => Number(v))
    .pipe(z.number().int().min(1, 'Mínimo 1').max(365, 'Máximo 365')),
})

export type BookingsFormValues = z.infer<typeof bookingsFormSchema>

export function parseBookingsFormData(formData: FormData) {
  const raw = {
    slot_granularity_minutes: formData.get('slot_granularity_minutes') ?? '',
    booking_min_hours_ahead: formData.get('booking_min_hours_ahead') ?? '',
    booking_max_days_ahead: formData.get('booking_max_days_ahead') ?? '',
  }
  return bookingsFormSchema.safeParse(raw)
}

// ─── Política de cancelación ───────────────────────────────────────────────

export const cancellationFormSchema = z.object({
  cancellation_min_hours: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Debe ser un número entero')
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0).max(720, 'Máximo 720 horas (30 días)')),
  cancellation_policy_text: z
    .string()
    .trim()
    .max(2000, 'Máximo 2000 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
})

export type CancellationFormValues = z.infer<typeof cancellationFormSchema>

export function parseCancellationFormData(formData: FormData) {
  const raw = {
    cancellation_min_hours: formData.get('cancellation_min_hours') ?? '',
    cancellation_policy_text: formData.get('cancellation_policy_text') ?? '',
  }
  return cancellationFormSchema.safeParse(raw)
}

// ─── Aviso legal ───────────────────────────────────────────────────────────

export const legalFormSchema = z.object({
  terms_text: z
    .string()
    .trim()
    .max(10000, 'Máximo 10.000 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
})

export type LegalFormValues = z.infer<typeof legalFormSchema>

export function parseLegalFormData(formData: FormData) {
  const raw = {
    terms_text: formData.get('terms_text') ?? '',
  }
  return legalFormSchema.safeParse(raw)
}

// ─── Logo (validación de archivo) ──────────────────────────────────────────

export const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
export const LOGO_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const

export function validateLogoFile(file: File): string | null {
  if (!(LOGO_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return 'Formato no soportado (usa PNG, JPG, WEBP o SVG)'
  }
  if (file.size > LOGO_MAX_BYTES) {
    return 'El archivo supera 2 MB'
  }
  return null
}
