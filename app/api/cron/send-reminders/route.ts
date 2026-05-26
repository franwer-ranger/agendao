import { runReminderBatch } from '@/lib/email/triggers/send-reminders'
import { NextResponse } from 'next/server'

// Endpoint que dispara los recordatorios 24h antes.
//
// Disparo: cron externo (cron-job.org) cada 30 min con
// `Authorization: Bearer $CRON_SECRET`. La ventana de scan en
// `runReminderBatch` es 23h-25h, así que cada reserva entra en ~4 batches
// y la idempotencia de `booking_notifications` garantiza un único envío.
//
// Disparo manual:
//   curl -i -H "Authorization: Bearer $CRON_SECRET" \
//        https://app.agendao.xyz/api/cron/send-reminders
//
// En no-prod también vale `?secret=$CRON_SECRET` para pruebas locales.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    )
  }

  const auth = req.headers.get('authorization') ?? ''
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret') ?? ''

  const authorized =
    auth === `Bearer ${secret}` ||
    (process.env.VERCEL_ENV !== 'production' && querySecret === secret)

  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await runReminderBatch()

  if (result.errors.length > 0) {
    console.error('[cron:send-reminders] errors', result)
  } else {
    console.warn('[cron:send-reminders] ok', {
      scanned: result.scanned,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
    })
  }

  return NextResponse.json(result)
}
