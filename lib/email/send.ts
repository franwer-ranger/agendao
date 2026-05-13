import 'server-only'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { getDefaultFrom, getResendClient, resolveRecipient } from './client'
import {
  recordProviderMessageId,
  releaseNotificationSlot,
  reserveNotificationSlot,
} from './notifications-log'
import type { EmailKind } from './types'

export type SendBookingEmailParams = {
  to: string
  subject: string
  react: ReactElement
  kind: EmailKind
  bookingId: number
  salonId: number
  version?: number
  replyTo?: string
}

export type SendResult =
  | { ok: true; messageId: string; skipped?: false }
  | { ok: true; skipped: true; reason: 'already_sent' }
  | { ok: false; error: string }

// Envía un email transaccional ligado a una reserva.
//
// - Idempotencia: reserva primero la fila en `booking_notifications`. Si ya
//   existía (otro hilo se nos adelantó), no envía y devuelve `skipped`.
// - Override de destinatario: en no-prod redirige al sandbox de Resend
//   (EMAIL_EXAMPLE). El contenido del email no cambia (refleja al cliente real).
//   Solo se prefija el asunto con [DEV → destinatario-real] para no perder
//   trazabilidad al ojo humano.
// - No lanza: ante cualquier fallo devuelve { ok:false } y libera la reserva
//   para permitir reintentos. El caller decide si loguea (típicamente sí).
export async function sendBookingEmail(
  params: SendBookingEmailParams,
): Promise<SendResult> {
  let reservedRowId: number | null = null
  try {
    const reservation = await reserveNotificationSlot({
      bookingId: params.bookingId,
      salonId: params.salonId,
      kind: params.kind,
      version: params.version,
    })

    if (!reservation.reserved) {
      return { ok: true, skipped: true, reason: 'already_sent' }
    }
    reservedRowId = reservation.rowId

    const recipient = resolveRecipient(params.to)
    const subject = recipient.isOverridden
      ? `[DEV → ${recipient.originalTo}] ${params.subject}`
      : params.subject

    const html = await render(params.react)
    const text = await render(params.react, { plainText: true })

    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: getDefaultFrom(),
      to: recipient.to,
      subject,
      html,
      text,
      replyTo: params.replyTo,
    })

    if (error) {
      if (reservedRowId !== null) await releaseNotificationSlot(reservedRowId)
      return { ok: false, error: error.message }
    }

    if (data?.id && reservedRowId !== null) {
      await recordProviderMessageId(reservedRowId, data.id)
    }
    return { ok: true, messageId: data?.id ?? '' }
  } catch (err) {
    if (reservedRowId !== null) {
      try {
        await releaseNotificationSlot(reservedRowId)
      } catch {
        // Si ni siquiera podemos liberar, no hay mucho que hacer.
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_send_error',
    }
  }
}
