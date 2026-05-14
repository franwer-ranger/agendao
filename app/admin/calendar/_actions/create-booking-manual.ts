'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'

import { validateAndCreateBooking } from '@/lib/availability/booking'
import { upsertClientForBooking } from '@/lib/clients/queries'
import { emitBookingCreatedEmails } from '@/lib/email/triggers/on-booking-created'
import { getCurrentSalon } from '@/lib/salon'
import { salonDateToUtc } from '@/lib/time'

const HHMM = /^\d{2}:\d{2}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const schema = z.object({
  service_id: z.coerce.number().int().positive(),
  employee_id: z.coerce.number().int().positive(),
  date: z.string().regex(ISO_DATE, 'Formato YYYY-MM-DD'),
  starts_at: z.string().regex(HHMM, 'Formato HH:MM'),
  client_name: z
    .string()
    .trim()
    .min(1, 'Nombre obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  client_phone: z
    .string()
    .trim()
    .min(1, 'Teléfono obligatorio')
    .max(40, 'Máximo 40 caracteres'),
  client_email: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : null))
    .nullable()
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Email inválido',
    }),
  internal_note: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  notify_client: z.boolean(),
})

export type CreateBookingManualResult =
  | { ok: true; bookingId: number; publicId: string }
  | {
      ok: false
      message?: string
      fieldErrors?: Record<string, string[]>
    }

export async function createBookingManualAction(
  raw: z.input<typeof schema>,
): Promise<CreateBookingManualResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_')
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { ok: false, fieldErrors }
  }

  const salon = await getCurrentSalon()
  const input = parsed.data

  // Cliente: upsert por teléfono/email. Idéntico al flujo público.
  const client = await upsertClientForBooking({
    salonId: salon.id,
    displayName: input.client_name,
    phone: input.client_phone,
    email: input.client_email,
  })

  // Calcular instante UTC a partir de fecha local + hora local del salón.
  const dayStartUtc = salonDateToUtc(input.date, salon.timezone)
  const [h, m] = input.starts_at.split(':').map(Number)
  const startsAt = new Date(dayStartUtc.getTime() + (h * 60 + m) * 60_000)

  const result = await validateAndCreateBooking({
    salonId: salon.id,
    serviceId: input.service_id,
    employeeId: input.employee_id,
    clientId: client.id,
    startsAt: startsAt.toISOString(),
    source: 'admin',
    clientNote: input.internal_note,
  })

  console.log(result)

  if (!result.ok) {
    return { ok: false, message: friendlyMessageForCode(result.code) }
  }

  if (input.notify_client && input.client_email) {
    after(async () => {
      await emitBookingCreatedEmails(result.bookingId)
    })
  }

  revalidatePath('/admin/calendar')
  return { ok: true, bookingId: result.bookingId, publicId: result.publicId }
}

function friendlyMessageForCode(code: string): string {
  switch (code) {
    case 'EMPLOYEE_OVERLAP':
      return 'Ese empleado ya tiene una cita que solapa con ese horario.'
    case 'CAPACITY_EXCEEDED':
      return 'Se ha alcanzado el máximo concurrente para ese servicio.'
    case 'OUTSIDE_SCHEDULE':
      return 'La hora elegida está fuera del horario del empleado.'
    case 'OVERLAPS_BREAK':
      return 'La hora elegida cae en un descanso del empleado.'
    case 'OVERLAPS_TIME_OFF':
      return 'El empleado tiene un bloqueo en ese horario.'
    case 'OVERLAPS_CLOSURE':
      return 'El salón está cerrado en ese horario.'
    case 'OUTSIDE_SALON_HOURS':
      return 'La hora elegida está fuera del horario del salón.'
    case 'TOO_CLOSE_TO_NOW':
      return 'La hora elegida está demasiado cerca del momento actual.'
    case 'EMPLOYEE_NOT_AUTHORIZED':
      return 'Ese empleado no realiza este servicio.'
    case 'SPANS_MULTIPLE_DAYS':
      return 'La reserva no puede cruzar la medianoche.'
    case 'SALON_MISMATCH':
      return 'Servicio o empleado no pertenecen al salón.'
    default:
      return 'No se pudo crear la reserva.'
  }
}
