import { NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/availability'

// Endpoint de QA manual del motor de disponibilidad.
// Solo activo fuera de producción. Lo borraremos cuando 3.B aterrice la UI real.
//
// Ejemplo:
//   /api/_dev/availability?salonId=1&serviceId=2&employeeId=any&from=2026-05-13&to=2026-05-20
//   /api/_dev/availability?...&now=2026-05-13T08:00:00Z   (override "ahora" para testear ventanas y DST)
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const salonId = Number(url.searchParams.get('salonId'))
  const serviceId = Number(url.searchParams.get('serviceId'))
  const employeeIdParam = url.searchParams.get('employeeId') ?? 'any'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const nowParam = url.searchParams.get('now')

  if (!salonId || !serviceId || !from || !to) {
    return NextResponse.json(
      {
        error:
          'usage: ?salonId=<id>&serviceId=<id>&employeeId=<id|any>&from=YYYY-MM-DD&to=YYYY-MM-DD[&now=ISO]',
      },
      { status: 400 },
    )
  }

  const employeeId: number | 'any' =
    employeeIdParam === 'any' ? 'any' : Number(employeeIdParam)
  const now = nowParam ? new Date(nowParam) : undefined

  const slots = await getAvailableSlots(
    { salonId, serviceId, employeeId, from, to },
    now ? { now } : undefined,
  )

  return NextResponse.json({ count: slots.length, slots })
}
