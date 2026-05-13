import { NextResponse } from 'next/server'
import { runReminderBatch } from '@/lib/email/triggers/send-reminders'

// Endpoint que dispara los recordatorios 24h antes.
//
// En producción lo invoca Vercel Cron cada hora (ver `vercel.json`). Vercel
// añade el header `Authorization: Bearer $CRON_SECRET` automáticamente, así
// que validar contra ese secreto basta para rechazar tráfico ajeno.
//
// En dev, donde no corre el cron de Vercel, también aceptamos `?secret=` en la
// query para que puedas lanzarlo a mano:
//
//   curl -i "http://localhost:3000/api/cron/send-reminders?secret=$CRON_SECRET"
//
// El handler nunca dura más de lo necesario: la ventana de búsqueda es de 2h y
// el volumen de reservas confirmadas en ese rango es naturalmente acotado.

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
