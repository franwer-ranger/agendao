import { Text } from '@react-email/components'
import type { BookingEmailContext } from '@/lib/email/types'
import { BookingSummary } from './_shared/booking-summary'
import { EmailLayout, emailColors } from './_shared/layout'

export function BookingReminderEmail({
  ctx,
}: {
  ctx: BookingEmailContext
}) {
  return (
    <EmailLayout
      preview={`Recordatorio: mañana tienes cita en ${ctx.salon.name}`}
      salonName={ctx.salon.name}
      salonLogoUrl={ctx.salon.logoUrl}
      salonAddress={ctx.salon.address}
      salonPhone={ctx.salon.phone}
      cancellationPolicyText={ctx.salon.cancellationPolicyText}
    >
      <Text
        style={{ margin: 0, fontSize: 20, fontWeight: 600, color: emailColors.accent }}
      >
        Tu cita es mañana
      </Text>
      <Text
        style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: emailColors.text,
          lineHeight: 1.6,
        }}
      >
        Hola {ctx.client.displayName}, te recordamos que mañana te
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
        Si no puedes acudir, contacta con el salón cuanto antes
        {ctx.salon.phone ? ` (${ctx.salon.phone})` : ''} para liberar el
        horario.
      </Text>
    </EmailLayout>
  )
}
