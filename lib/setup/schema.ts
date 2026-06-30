import { z } from 'zod'

import {
  identityFormSchema,
  salonSlugSchema,
  workingHoursSchema,
} from '@/lib/salons/schema'

const HHMM = /^\d{2}:\d{2}$/
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

const adminSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, 'Demasiado largo')
    .pipe(z.email('Email inválido'))
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(200, 'Demasiado larga'),
  display_name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
})

const cancellationSchema = z.object({
  cancellation_min_hours: z
    .number()
    .int()
    .min(0)
    .max(720, 'Máximo 720 horas (30 días)'),
  cancellation_policy_text: z
    .string()
    .trim()
    .max(2000, 'Máximo 2000 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
})

const legalSchema = z.object({
  terms_text: z
    .string()
    .trim()
    .max(10000, 'Máximo 10.000 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
})

const setupSalonSchema = z.object({
  slug: salonSlugSchema,
  identity: identityFormSchema.omit({ remove_logo: true }),
  workingHours: workingHoursSchema,
  cancellation: cancellationSchema,
  legal: legalSchema,
})

const setupServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  duration_minutes: z
    .number()
    .int()
    .min(5, 'Mínimo 5 minutos')
    .max(480, 'Máximo 480 minutos')
    .refine((v) => v % 5 === 0, 'Debe ser múltiplo de 5'),
  price_cents: z.number().int().min(0).max(1_000_000, 'Demasiado alto'),
})

const shiftSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  starts_at: z.string().regex(HHMM, 'Formato HH:MM'),
  ends_at: z.string().regex(HHMM, 'Formato HH:MM'),
})

const setupEmployeeSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  color_hex: z
    .string()
    .regex(HEX_COLOR, 'Color inválido (#RRGGBB)')
    .transform((v) => v.toLowerCase())
    .nullable()
    .default(null),
  weeklySchedule: z.array(shiftSchema),
})

const matrixEntrySchema = z.object({
  serviceIndex: z.number().int().min(0),
  employeeIndex: z.number().int().min(0),
})

export const setupPayloadSchema = z
  .object({
    admin: adminSchema,
    salon: setupSalonSchema,
    services: z
      .array(setupServiceSchema)
      .min(1, 'Crea al menos un servicio')
      .max(30, 'Máximo 30 servicios en el wizard'),
    employees: z
      .array(setupEmployeeSchema)
      .min(1, 'Crea al menos un empleado')
      .max(20, 'Máximo 20 empleados en el wizard'),
    matrix: z.array(matrixEntrySchema),
  })
  .superRefine((data, ctx) => {
    data.matrix.forEach((m, idx) => {
      if (m.serviceIndex >= data.services.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['matrix', idx, 'serviceIndex'],
          message: 'Servicio inexistente',
        })
      }
      if (m.employeeIndex >= data.employees.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['matrix', idx, 'employeeIndex'],
          message: 'Empleado inexistente',
        })
      }
    })

    data.employees.forEach((emp, empIdx) => {
      emp.weeklySchedule.forEach((s, idx) => {
        if (s.ends_at <= s.starts_at) {
          ctx.addIssue({
            code: 'custom',
            path: ['employees', empIdx, 'weeklySchedule', idx, 'ends_at'],
            message: 'La hora fin debe ser posterior a la hora inicio',
          })
        }
      })
      const byDay = new Map<
        number,
        { start: string; end: string; idx: number }[]
      >()
      emp.weeklySchedule.forEach((s, idx) => {
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
              path: [
                'employees',
                empIdx,
                'weeklySchedule',
                list[i].idx,
                'starts_at',
              ],
              message: 'Este tramo se solapa con otro del mismo día',
            })
          }
        }
      }
    })
  })

export type SetupPayload = z.infer<typeof setupPayloadSchema>
export type SetupSalon = SetupPayload['salon']
export type SetupService = SetupPayload['services'][number]
export type SetupEmployee = SetupPayload['employees'][number]
export type SetupShift = SetupEmployee['weeklySchedule'][number]
export type SetupMatrixEntry = SetupPayload['matrix'][number]
