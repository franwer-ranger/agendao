import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { listTodaysBookings } from '@/lib/bookings/queries-today'
import { db } from '@/lib/db'
import { app_users } from '@/lib/db/schema'
import { listEmployees } from '@/lib/employees/queries'
import { getCurrentSalon } from '@/lib/salon'
import { addDaysIsoLocal, salonDateToUtc, salonToday } from '@/lib/time'

import { TodayShell } from './_components/today-shell'
import { WelcomeBanner } from './_components/welcome-banner'

type SearchParams = {
  date?: string
  show?: string
  welcome?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const salon = await getCurrentSalon()

  const today = salonToday()
  const date = params.date && DATE_RE.test(params.date) ? params.date : today
  const show = params.show === 'all' ? 'all' : 'active'

  const [employees, bookings, welcomeUrl] = await Promise.all([
    listEmployees({ salonId: salon.id }),
    listTodaysBookings({
      salonId: salon.id,
      rangeStartUtc: salonDateToUtc(date),
      rangeEndUtc: salonDateToUtc(addDaysIsoLocal(date, 1)),
    }),
    resolveWelcomeUrl(params.welcome === 'true', salon.slug),
  ])

  const activeEmployees = employees
    .filter((e) => e.is_active)
    .map((e) => ({
      id: e.id,
      display_name: e.display_name,
      color_hex: e.color_hex,
    }))

  return (
    <>
      {welcomeUrl ? <WelcomeBanner bookingUrl={welcomeUrl} /> : null}
      <TodayShell
        date={date}
        today={today}
        show={show}
        bookings={bookings}
        employees={activeEmployees}
      />
    </>
  )
}

// Devuelve la URL pública de reservas si toca mostrar el banner (admin que
// acaba de completar el wizard y aún no lo ha cerrado). Null en cualquier
// otro caso.
async function resolveWelcomeUrl(
  hasWelcomeParam: boolean,
  salonSlug: string,
): Promise<string | null> {
  if (!hasWelcomeParam) return null

  const session = await auth()
  if (!session?.user?.id) return null

  const user = (
    await db
      .select({ welcome_seen_at: app_users.welcome_seen_at })
      .from(app_users)
      .where(eq(app_users.id, session.user.id))
      .limit(1)
  )[0]
  if (user?.welcome_seen_at) return null

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}/${salonSlug}/book`
}
