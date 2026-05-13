import { Text } from '@react-email/components'
import type { BookingEmailContext } from '@/lib/email/types'
import { BookingSummary } from './_shared/booking-summary'
import { EmailLayout, emailColors } from './_shared/layout'

type Props = {
  ctx: BookingEmailContext
  cancelledBy: 'client' | 'salon'
}

export function BookingCancellationEmail({ ctx, cancelledBy }: Props) {
  const heading =
    cancelledBy === 'client'
      ? 'Hemos cancelado tu reserva'
      : 'Tu reserva ha sido cancelada'

  const bodyIntro =
    cancelledBy === 'client'
      ? `Hola ${ctx.client.displayName}, confirmamos que tu cita ha quedado cancelada.`
      : `Hola ${ctx.client.displayName}, lamentamos comunicarte que ${ctx.salon.name} ha tenido que cancelar tu cita.`

  return (
    <EmailLayout
      preview={`Cancelación de tu reserva en ${ctx.salon.name}`}
      salonName={ctx.salon.name}
      salonLogoUrl={ctx.salon.logoUrl}
      salonAddress={ctx.salon.address}
      salonPhone={ctx.salon.phone}
      cancellationPolicyText={ctx.salon.cancellationPolicyText}
    >
      <Text
        style={{ margin: 0, fontSize: 20, fontWeight: 600, color: emailColors.accent }}
      >
        {heading}
      </Text>
      <Text
        style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: emailColors.text,
          lineHeight: 1.6,
        }}
      >
        {bodyIntro}
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
        Si quieres reservar otra cita, contacta con el salón
        {ctx.salon.phone ? ` en el ${ctx.salon.phone}` : ''}
        {ctx.salon.contactEmail ? ` o en ${ctx.salon.contactEmail}` : ''}.
      </Text>
    </EmailLayout>
  )
}
