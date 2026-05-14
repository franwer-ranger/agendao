import { render } from '@react-email/render'
import { NextResponse } from 'next/server'
import {
  getDefaultFrom,
  getResendClient,
  resolveRecipient,
} from '@/lib/email/client'
import { loadBookingEmailContext } from '@/lib/email/load-context'
import { BookingConfirmationEmail } from '@/lib/email/templates/booking-confirmation'
import { SalonNewBookingEmail } from '@/lib/email/templates/salon-new-booking'
import type { BookingEmailContext } from '@/lib/email/types'
import { createAdminClient } from '@/lib/supabase/admin'

// Endpoint de diagnóstico de emails. Protegido por `?secret=$CRON_SECRET`.
// Modos:
//   ?mode=env-check                       → estado de env vars (enmascaradas).
//   ?mode=smoketest                       → email mock vía Resend, sin BD.
//   ?mode=replay&bookingId=<id>           → reenvía emails de una reserva real
//                                            saltándose idempotencia.
//
// Ejemplos:
//   curl ".../api/dev/test-email?mode=env-check&secret=$CRON_SECRET" | jq
//   curl ".../api/dev/test-email?mode=smoketest&secret=$CRON_SECRET" | jq
//   curl ".../api/dev/test-email?mode=replay&bookingId=5&secret=$CRON_SECRET" | jq

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'env-check'
  const secret = url.searchParams.get('secret') ?? ''

  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    if (mode === 'env-check') return NextResponse.json(envCheck())
    if (mode === 'smoketest') return NextResponse.json(await smoketest())
    if (mode === 'replay') {
      const bookingId = Number(url.searchParams.get('bookingId'))
      if (!bookingId) {
        return NextResponse.json(
          { error: 'bookingId required' },
          { status: 400 },
        )
      }
      return NextResponse.json(await replay(bookingId))
    }
    return NextResponse.json({ error: 'unknown mode' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

function mask(v: string | undefined): string {
  if (!v) return '<missing>'
  if (v.length <= 8) return '***'
  return `${v.slice(0, 4)}…${v.slice(-3)}`
}

function envCheck() {
  return {
    mode: 'env-check',
    env: {
      RESEND_API_KEY: mask(process.env.RESEND_API_KEY),
      EMAIL_EXAMPLE: process.env.EMAIL_EXAMPLE ?? '<missing>',
      EMAIL_FROM:
        process.env.EMAIL_FROM ?? '<default: Agendao <onboarding@resend.dev>>',
      CRON_SECRET: mask(process.env.CRON_SECRET),
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '<missing>',
      SUPABASE_SERVICE_ROLE_KEY: mask(process.env.SUPABASE_SERVICE_ROLE_KEY),
      VERCEL_ENV: process.env.VERCEL_ENV ?? '<not vercel>',
      NODE_ENV: process.env.NODE_ENV ?? '<unset>',
    },
  }
}

function buildMockContext(): BookingEmailContext {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  return {
    salon: {
      id: 0,
      name: 'Salón de prueba',
      timezone: 'Europe/Madrid',
      address: 'Calle Falsa 123, Madrid',
      phone: '+34 600 000 000',
      contactEmail: 'contacto@salon-prueba.test',
      logoUrl: null,
      cancellationMinHours: 12,
      cancellationPolicyText:
        'Avísanos con al menos 12h de antelación para cancelar o reprogramar.',
    },
    client: {
      displayName: 'Cliente de prueba',
      email: 'cliente@example.test',
    },
    booking: {
      publicId: `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      totalCents: 4500,
      items: [
        {
          serviceName: 'Corte y peinado',
          employeeName: 'Ana',
          durationMinutes: 30,
          priceCents: 4500,
        },
      ],
    },
  }
}

async function smoketest() {
  const ctx = buildMockContext()
  const recipient = resolveRecipient(ctx.client.email)
  const subject = `[SMOKETEST]${recipient.isOverridden ? ` [→ ${recipient.originalTo}]` : ''} Confirmación de tu reserva en ${ctx.salon.name}`
  const react = BookingConfirmationEmail({ ctx })
  const html = await render(react)
  const text = await render(react, { plainText: true })

  const resend = getResendClient()
  const { data, error } = await resend.emails.send({
    from: getDefaultFrom(),
    to: recipient.to,
    subject,
    html,
    text,
  })
  if (error) {
    return { mode: 'smoketest', ok: false, error: error.message }
  }
  return {
    mode: 'smoketest',
    ok: true,
    messageId: data?.id,
    sentTo: recipient.to,
    originalTo: recipient.originalTo,
    isOverridden: recipient.isOverridden,
  }
}

async function replay(bookingId: number) {
  const ctx = await loadBookingEmailContext(bookingId)
  if (!ctx) {
    return { mode: 'replay', ok: false, error: 'booking not found' }
  }

  const results: Array<Record<string, unknown>> = []

  if (ctx.client.email) {
    results.push(
      await sendDirect({
        to: ctx.client.email,
        subject: `[REPLAY] Confirmación de tu reserva en ${ctx.salon.name}`,
        react: BookingConfirmationEmail({ ctx }),
        kind: 'booking_confirmation',
      }),
    )
  } else {
    results.push({
      kind: 'booking_confirmation',
      ok: false,
      skipped: true,
      reason: 'client has no email',
    })
  }

  const supabase = createAdminClient()
  const { data: salonRow, error: salonErr } = await supabase
    .from('salons')
    .select('notify_salon_on_new_booking, contact_email')
    .eq('id', ctx.salon.id)
    .maybeSingle()
  if (salonErr) {
    results.push({
      kind: 'salon_new_booking',
      ok: false,
      error: `salon row query failed: ${salonErr.message}`,
    })
  } else if (!salonRow?.notify_salon_on_new_booking) {
    results.push({
      kind: 'salon_new_booking',
      ok: false,
      skipped: true,
      reason: 'notify_salon_on_new_booking is false',
    })
  } else if (!salonRow.contact_email) {
    results.push({
      kind: 'salon_new_booking',
      ok: false,
      skipped: true,
      reason: 'salon has no contact_email',
    })
  } else {
    results.push(
      await sendDirect({
        to: salonRow.contact_email,
        subject: `[REPLAY] Nueva reserva · ${ctx.client.displayName}`,
        react: SalonNewBookingEmail({ ctx }),
        kind: 'salon_new_booking',
      }),
    )
  }

  return {
    mode: 'replay',
    bookingId,
    bookingPublicId: ctx.booking.publicId,
    clientEmail: ctx.client.email || null,
    salonContactEmail: salonRow?.contact_email ?? null,
    notifySalonFlag: salonRow?.notify_salon_on_new_booking ?? null,
    results,
  }
}

async function sendDirect(params: {
  to: string
  subject: string
  react: React.ReactElement
  kind: string
}): Promise<Record<string, unknown>> {
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
    })
    if (error) {
      return { kind: params.kind, ok: false, error: error.message }
    }
    return {
      kind: params.kind,
      ok: true,
      messageId: data?.id,
      sentTo: recipient.to,
      originalTo: recipient.originalTo,
    }
  } catch (err) {
    return {
      kind: params.kind,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
