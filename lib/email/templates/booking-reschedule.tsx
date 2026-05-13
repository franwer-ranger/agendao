import { Text } from '@react-email/components'
import { formatBookingDateTime } from '@/lib/email/format'
import type { BookingEmailContext } from '@/lib/email/types'
import { BookingSummary } from './_shared/booking-summary'
import { EmailLayout, emailColors } from './_shared/layout'

type Props = {
  ctx: BookingEmailContext
  previousStartsAt: string // ISO UTC del horario anterior
}

export function BookingRescheduleEmail({ ctx, previousStartsAt }: Props) {
  return (
    <EmailLayout
      preview={`Tu reserva en ${ctx.salon.name} se ha movido`}
      salonName={ctx.salon.name}
      salonLogoUrl={ctx.salon.logoUrl}
      salonAddress={ctx.salon.address}
      salonPhone={ctx.salon.phone}
      cancellationPolicyText={ctx.salon.cancellationPolicyText}
    >
      <Text
        style={{ margin: 0, fontSize: 20, fontWeight: 600, color: emailColors.accent }}
      >
        Tu reserva se ha reprogramado
      </Text>
      <Text
        style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: emailColors.text,
          lineHeight: 1.6,
        }}
      >
        Hola {ctx.client.displayName}, tu cita en {ctx.salon.name} se ha
        movido. El nuevo horario es el que ves abajo.
      </Text>

      <Text
        style={{
          margin: '16px 0 0',
          fontSize: 13,
          color: emailColors.muted,
        }}
      >
        Horario anterior:{' '}
        <span style={{ textDecoration: 'line-through' }}>
          {formatBookingDateTime(previousStartsAt, ctx.salon.timezone)}
        </span>
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
        Si el nuevo horario no te encaja, contacta con el salón
        {ctx.salon.phone ? ` en el ${ctx.salon.phone}` : ''}
        {ctx.salon.contactEmail ? ` o en ${ctx.salon.contactEmail}` : ''}.
      </Text>
    </EmailLayout>
  )
}
