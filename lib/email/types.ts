import 'server-only'

export type EmailKind =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancellation'
  | 'booking_reschedule'
  | 'salon_new_booking'

// View-model único que consumen todas las plantillas. Se construye en los
// triggers (lib/email/triggers/*) leyendo de BD y se pasa a la plantilla React.
// Mantenerlo aplanado evita que cada plantilla tenga que conocer la forma de
// la BD.
export type BookingEmailContext = {
  salon: {
    id: number
    name: string
    timezone: string
    address: string | null
    phone: string | null
    contactEmail: string | null
    logoUrl: string | null
    cancellationMinHours: number
    cancellationPolicyText: string | null
  }
  client: {
    displayName: string
    email: string
  }
  booking: {
    publicId: string
    startsAt: string // ISO UTC
    endsAt: string // ISO UTC
    totalCents: number
    items: Array<{
      serviceName: string
      employeeName: string
      durationMinutes: number
      priceCents: number
    }>
  }
}
