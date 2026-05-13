import { z } from 'zod'

// Cliente y servidor comparten validación de los campos visibles.
// El teléfono se valida con regex permisivo: empieza opcionalmente con `+`,
// admite cifras, espacios, guiones y paréntesis, entre 9 y 20 caracteres.
// Si más adelante se quiere E.164 estricto, se instala libphonenumber.

const phoneRegex = /^\+?[\d\s\-()]{9,20}$/

// Schema de la parte visible del form (sólo lo que se valida en cliente con
// react-hook-form). Sin transforms: los strings se mantienen como strings
// para que el resolver de RHF no sufra discrepancias entre input/output.
export const detailsFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Tu nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  phone: z
    .string()
    .trim()
    .min(1, 'El teléfono es obligatorio')
    .regex(phoneRegex, 'Teléfono no válido (sólo cifras, espacios, +, -, ())'),
  email: z
    .string()
    .trim()
    .max(254, 'Email demasiado largo')
    .refine(
      (v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      'Email no válido',
    ),
  clientNote: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres'),
})

export type DetailsFormValues = z.infer<typeof detailsFormSchema>

// Schema completo del server action: incluye hidden fields y aplica los
// transforms que convierten strings vacíos a null y "on" a boolean.
export const createBookingInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).regex(phoneRegex, 'Teléfono no válido'),
  email: z
    .string()
    .trim()
    .max(254)
    .transform((v) => (v.length > 0 ? v : null))
    .refine(
      (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      'Email no válido',
    ),
  clientNote: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v.length > 0 ? v : null)),
  acceptTerms: z
    .union([z.literal('on'), z.literal('true'), z.literal('1'), z.literal('')])
    .transform((v) => v === 'on' || v === 'true' || v === '1'),
  serviceId: z.string().regex(/^\d+$/).transform(Number),
  employeeId: z.string().regex(/^\d+$/).transform(Number),
  startsAt: z.string().min(1),
  originalEmployeeChoice: z.union([z.literal('any'), z.string().regex(/^\d+$/)]),
  idempotencyKey: z.string().min(8).max(128),
  termsRequired: z.union([z.literal('1'), z.literal('0')]),
})

export type CreateBookingInputValues = z.infer<typeof createBookingInputSchema>

export function parseCreateBookingFormData(formData: FormData) {
  const raw = {
    displayName: formData.get('displayName') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    clientNote: formData.get('clientNote') ?? '',
    acceptTerms: formData.get('acceptTerms') ?? '',
    serviceId: formData.get('serviceId') ?? '',
    employeeId: formData.get('employeeId') ?? '',
    startsAt: formData.get('startsAt') ?? '',
    originalEmployeeChoice: formData.get('originalEmployeeChoice') ?? '',
    idempotencyKey: formData.get('idempotencyKey') ?? '',
    termsRequired: formData.get('termsRequired') ?? '0',
  }
  return createBookingInputSchema.safeParse(raw)
}

export type CreateBookingActionState = {
  ok: boolean
  message?: string
  retryStep?: 'datetime' | 'service'
  preselectedDate?: string
  fieldErrors?: Record<string, string[]>
}
