import { Text } from '@react-email/components'
import type { BookingEmailContext } from '@/lib/email/types'
import { BookingSummary } from './_shared/booking-summary'
import { EmailLayout, emailColors } from './_shared/layout'

export function BookingConfirmationEmail({
  ctx,
}: {
  ctx: BookingEmailContext
}) {
  return (
    <EmailLayout
      preview={`Tu reserva en ${ctx.salon.name} está confirmada`}
      salonName={ctx.salon.name}
      salonLogoUrl={ctx.salon.logoUrl}
      salonAddress={ctx.salon.address}
      salonPhone={ctx.salon.phone}
      cancellationPolicyText={ctx.salon.cancellationPolicyText}
    >
      <Text
        style={{ margin: 0, fontSize: 20, fontWeight: 600, color: emailColors.accent }}
      >
        ¡Reserva confirmada!
      </Text>
      <Text
        style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: emailColors.text,
          lineHeight: 1.6,
        }}
      >
        Hola {ctx.client.displayName}, hemos recibido tu reserva. Te
        esperamos en {ctx.salon.name}.
      </Text>

      <BookingSummary booking={ctx.booking} timezone={ctx.salon.timezone} />

      <Text
        style={{
          margin: '20px 0 0',
          fontSize: 13,
          color: emailColors.muted,
          lineHeight: 1.6,
        }}
      >
        Si necesitas cancelar o cambiar la cita, contacta con el salón
        {ctx.salon.phone ? ` en el ${ctx.salon.phone}` : ''}
        {ctx.salon.contactEmail ? ` o escríbenos a ${ctx.salon.contactEmail}` : ''}
        . Te pedimos avisar con al menos {ctx.salon.cancellationMinHours} horas
        de antelación.
      </Text>
    </EmailLayout>
  )
}
