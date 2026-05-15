import { Text } from '@react-email/components'
import type { BookingEmailContext } from '@/lib/email/types'
import { BookingSummary } from './_shared/booking-summary'
import { EmailLayout, emailColors } from './_shared/layout'

// Aviso interno al salón cuando entra una reserva nueva. El estilo es el
// mismo que el cliente para no mantener dos sets de plantillas.
export function SalonNewBookingEmail({ ctx }: { ctx: BookingEmailContext }) {
  return (
    <EmailLayout
      preview={`Nueva reserva de ${ctx.client.displayName}`}
      salonName={ctx.salon.name}
      salonLogoUrl={ctx.salon.logoUrl}
      salonAddress={null}
      salonPhone={null}
      cancellationPolicyText={null}
    >
      <Text
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 600,
          color: emailColors.accent,
        }}
      >
        Nueva reserva
      </Text>
      <Text
        style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: emailColors.text,
          lineHeight: 1.6,
        }}
      >
        Acaba de entrar una reserva online de{' '}
        <strong>{ctx.client.displayName}</strong>
        {ctx.client.email ? (
          <>
            {' '}
            (
            <span style={{ color: emailColors.muted }}>{ctx.client.email}</span>
            )
          </>
        ) : null}
        .
      </Text>

      <BookingSummary booking={ctx.booking} timezone={ctx.salon.timezone} />
    </EmailLayout>
  )
}
