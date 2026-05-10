import { z } from 'zod'

// Form schema. Inputs come from FormData (strings); we validate + coerce.
// Mirrors the SQL CHECKs on `services` (duration multiple of 5, price >= 0).
export const serviceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  description: z
    .string()
    .trim()
    .max(2000, 'Máximo 2000 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  duration_minutes: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Debe ser un número entero')
    .transform((v) => Number(v))
    .pipe(
      z
        .number()
        .int()
        .min(5, 'Mínimo 5 minutos')
        .max(480, 'Máximo 480 minutos')
        .refine((v) => v % 5 === 0, 'Debe ser múltiplo de 5'),
    ),
  // Euros as decimal string; output is cents (integer).
  price_cents: z
    .string()
    .trim()
    .min(1, 'El precio es obligatorio')
    .regex(/^\d+([.,]\d{1,2})?$/, 'Formato inválido (ej: 35 o 35,50)')
    .transform((v) => Math.round(parseFloat(v.replace(',', '.')) * 100))
    .pipe(z.number().int().min(0).max(1_000_000, 'Demasiado alto')),
  // Empty string => null (sin límite); otherwise integer 1–50.
  max_concurrent: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (v === '') return
      if (!/^[1-9]\d?$/.test(v)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Debe ser un entero entre 1 y 50, o vacío',
        })
      }
    })
    .transform((v) => (v === '' ? null : Number(v))),
  is_active: z
    .string()
    .transform((v) => v === 'true' || v === 'on')
    .or(z.boolean()),
  employee_ids: z.array(z.coerce.number().int().positive()).default([]),
})

export type ServiceFormValues = z.infer<typeof serviceFormSchema>

export function parseServiceFormData(formData: FormData) {
  const employee_ids = formData
    .getAll('employee_ids')
    .map((v) => String(v))
    .filter((v) => v.length > 0)

  const raw = {
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    duration_minutes: formData.get('duration_minutes') ?? '',
    price_cents: formData.get('price_eur') ?? '',
    max_concurrent: formData.get('max_concurrent') ?? '',
    is_active: formData.get('is_active') ?? 'false',
    employee_ids,
  }

  return serviceFormSchema.safeParse(raw)
}
