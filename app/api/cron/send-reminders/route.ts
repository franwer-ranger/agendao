import { runReminderBatch } from '@/lib/email/triggers/send-reminders'
import { NextResponse } from 'next/server'

// Endpoint que dispara los recordatorios 24h antes.
//
// NOTA: Vercel Hobby solo permite crons diarios (1/día). Mientras estemos en
// plan free, NO hay `vercel.json` con schedule — el endpoint queda colgado y
// se invoca a mano o desde un cron externo (cron-job.org, GitHub Actions, etc.).
// La autenticación con `$CRON_SECRET` sigue activa para que solo lo dispare
// quien deba.
//
// Para lanzarlo a mano:
//   curl -i "https://TU_DOMINIO/api/cron/send-reminders?secret=$CRON_SECRET"
//   curl -i "http://localhost:3000/api/cron/send-reminders?secret=$CRON_SECRET"
//
// Cuando pasemos a Vercel Pro (o equivalente), basta con re-añadir un
// `vercel.json` con `{"crons":[{"path":"/api/cron/send-reminders","schedule":"0 * * * *"}]}`.

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
