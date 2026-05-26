import 'server-only'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { getDefaultFrom, getResendClient, resolveRecipient } from './client'

export type SendTransactionalEmailParams = {
  to: string
  subject: string
  react: ReactElement
  replyTo?: string
}

export type SendTransactionalResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string }

export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<SendTransactionalResult> {
  try {
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
      return { ok: false, error: error.message }
    }
    return { ok: true, messageId: data?.id ?? '' }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_send_error',
    }
  }
}
