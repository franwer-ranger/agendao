'use server'

import { getAvailableSlots } from '@/lib/availability'
import { validateAndCreateBooking } from '@/lib/availability/booking'
// `getAvailableSlots` se sigue usando para el retry-on-any más abajo.
import { upsertClientForBooking } from '@/lib/clients/queries'
import { emitBookingCreatedEmails } from '@/lib/email/triggers/on-booking-created'
import { getSalonBySlug } from '@/lib/salons/queries'
import { getServiceById } from '@/lib/services/queries'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import {
  parseCreateBookingFormData,
  type CreateBookingActionState,
} from '../_lib/booking-flow-schema'
import { isoDateInTimezone } from '../_lib/format'

// Mensajes amigables por código de error del motor. Se asume i18n=es-ES.
function userMessageForCode(code: string): string {
  switch (code) {
    case 'EMPLOYEE_OVERLAP':
    case 'CAPACITY_EXCEEDED':
      return 'Ese horario acaba de ocuparse. Elige otro hueco, por favor.'
    case 'OUTSIDE_SCHEDULE':
    case 'OVERLAPS_BREAK':
    case 'OVERLAPS_TIME_OFF':
    case 'OVERLAPS_CLOSURE':
      return 'El horario seleccionado ya no está disponible. Prueba con otro.'
    case 'TOO_CLOSE_TO_NOW':
      return 'Ese horario está demasiado cerca para reservarlo online. Elige otro u, si es urgente, llama al salón.'
    default:
      return 'No hemos podido crear la reserva. Inténtalo de nuevo.'
  }
}

const RETRYABLE_CODES = new Set([
  'EMPLOYEE_OVERLAP',
  'CAPACITY_EXCEEDED',
  'OUTSIDE_SCHEDULE',
  'OVERLAPS_BREAK',
  'OVERLAPS_TIME_OFF',
  'OVERLAPS_CLOSURE',
  'TOO_CLOSE_TO_NOW',
])

export async function createPublicBookingAction(
  salonSlug: string,
  _prev: CreateBookingActionState,
  formData: FormData,
): Promise<CreateBookingActionState> {
  const parsed = parseCreateBookingFormData(formData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0] ?? '_')
      if (!fieldErrors[path]) fieldErrors[path] = []
      fieldErrors[path].push(issue.message)
    }
    return {
      ok: false,
      message: 'Revisa los datos del formulario.',
      fieldErrors,
    }
  }

  const input = parsed.data

  const salon = await getSalonBySlug(salonSlug)
  if (!salon) {
    return { ok: false, message: 'Salón no encontrado.', retryStep: 'service' }
  }

  if (input.termsRequired === '1' && !input.acceptTerms) {
    return {
      ok: false,
      message: 'Tienes que aceptar las condiciones para reservar.',
      fieldErrors: { acceptTerms: ['Acepta las condiciones para continuar.'] },
    }
  }

  const service = await getServiceById(input.serviceId, salon.id)
  if (!service || !service.is_active) {
    return {
      ok: false,
      message: 'Ese servicio ya no está disponible.',
      retryStep: 'service',
    }
  }

  if (!service.employee_ids.includes(input.employeeId)) {
    return {
      ok: false,
      message:
        'Ese profesional ya no realiza este servicio. Vuelve a elegir profesional.',
      retryStep: 'service',
    }
  }

  const preselectedDate = isoDateInTimezone(
    new Date(input.startsAt),
    salon.timezone,
  )

  // Nota: antes había un pre-check `stillThere` que comparaba `startsAt` como
  // string contra los slots devueltos por el motor. Eliminado porque (1) era
  // frágil ante cualquier reformateo y (2) duplicaba reglas que ya enforce el
  // trigger SQL `booking_items_validate`. El trigger es source of truth; si
  // rechaza, el flujo de `RETRYABLE_CODES` más abajo levanta el modal.

  const client = await upsertClientForBooking({
    salonId: salon.id,
    displayName: input.displayName,
    phone: input.phone,
    email: input.email,
  })

  // Retry-on-any: si el usuario eligió "cualquiera" y el primer intento
  // falla por concurrencia, intentamos con otro empleado del mismo slot.
  let result = await validateAndCreateBooking({
    salonId: salon.id,
    serviceId: input.serviceId,
    employeeId: input.employeeId,
    clientId: client.id,
    startsAt: input.startsAt,
    source: 'web',
    clientNote: input.clientNote,
    idempotencyKey: input.idempotencyKey,
  })

  if (
    !result.ok &&
    input.originalEmployeeChoice === 'any' &&
    result.code === 'EMPLOYEE_OVERLAP'
  ) {
    const anySlots = await getAvailableSlots({
      salonId: salon.id,
      serviceId: input.serviceId,
      employeeId: 'any',
      from: preselectedDate,
      to: preselectedDate,
    })
    const alt = anySlots.find(
      (s) => s.startsAt === input.startsAt && s.employeeId !== input.employeeId,
    )
    if (alt) {
      result = await validateAndCreateBooking({
        salonId: salon.id,
        serviceId: input.serviceId,
        employeeId: alt.employeeId,
        clientId: client.id,
        startsAt: input.startsAt,
        source: 'web',
        clientNote: input.clientNote,
        idempotencyKey: input.idempotencyKey,
      })
    }
  }

  if (result.ok) {
    // Emails fuera del path crítico: `after()` ejecuta tras enviar la respuesta,
    // así el redirect al cliente no espera al envío.
    const createdBookingId = result.bookingId
    after(async () => {
      await emitBookingCreatedEmails(createdBookingId)
    })
    redirect(`/${salonSlug}/book/done/${result.publicId}`)
  }

  if (RETRYABLE_CODES.has(result.code)) {
    return {
      ok: false,
      message: userMessageForCode(result.code),
      retryStep: 'datetime',
      preselectedDate,
    }
  }

  // Códigos no recuperables a este nivel (SALON_MISMATCH, EMPLOYEE_NOT_AUTHORIZED,
  // SPANS_MULTIPLE_DAYS, UNKNOWN): probablemente un bug del flujo.
  return {
    ok: false,
    message: 'Algo salió mal al crear la reserva. Empieza de nuevo, por favor.',
    retryStep: 'service',
  }
}
