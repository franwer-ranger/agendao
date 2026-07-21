import { z } from 'zod'

import { salonSlugSchema } from '@/lib/salons/schema'

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, 'El email es demasiado largo')
    .pipe(z.email('Introduce un email válido'))
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(200, 'La contraseña es demasiado larga'),
  salonName: z
    .string()
    .trim()
    .min(1, 'Introduce el nombre del salón')
    .max(120, 'El nombre puede tener como máximo 120 caracteres'),
  slug: salonSlugSchema,
})

export type SignupInput = z.infer<typeof signupSchema>

export function parseSignupFormData(formData: FormData) {
  return signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    salonName: formData.get('salonName'),
    slug: formData.get('slug'),
  })
}
