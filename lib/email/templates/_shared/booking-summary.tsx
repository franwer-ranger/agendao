import { Section, Text } from '@react-email/components'
import {
  formatBookingDateTime,
  formatPriceEur,
} from '@/lib/email/format'
import type { BookingEmailContext } from '@/lib/email/types'
import { emailColors } from './layout'

type Props = {
  booking: BookingEmailContext['booking']
  timezone: string
}

export function BookingSummary({ booking, timezone }: Props) {
  return (
    <Section
      style={{
        border: `1px solid ${emailColors.border}`,
        borderRadius: 10,
        padding: 16,
        marginTop: 16,
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: emailColors.muted,
        }}
      >
        Tu cita
      </Text>
      <Text
        style={{
          margin: '4px 0 0',
          fontSize: 18,
          fontWeight: 600,
          color: emailColors.text,
        }}
      >
        {formatBookingDateTime(booking.startsAt, timezone)}
      </Text>

      {booking.items.map((item, idx) => (
        <Text
          key={idx}
          style={{
            margin: idx === 0 ? '12px 0 0' : '6px 0 0',
            fontSize: 14,
            color: emailColors.text,
            lineHeight: 1.5,
          }}
        >
          <strong>{item.serviceName}</strong>
          <br />
          <span style={{ color: emailColors.muted }}>
            con {item.employeeName} · {item.durationMinutes} min ·{' '}
            {formatPriceEur(item.priceCents)}
          </span>
        </Text>
      ))}

      {booking.items.length > 1 ? (
        <Text
          style={{
            margin: '12px 0 0',
            fontSize: 14,
            color: emailColors.text,
            fontWeight: 600,
          }}
        >
          Total: {formatPriceEur(booking.totalCents)}
        </Text>
      ) : null}

      <Text
        style={{
          margin: '12px 0 0',
          fontSize: 12,
          color: emailColors.muted,
        }}
      >
        Referencia: {booking.publicId}
      </Text>
    </Section>
  )
}
