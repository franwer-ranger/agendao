import { listTodaysBookings } from '@/lib/bookings/queries-today'
import { listEmployees } from '@/lib/employees/queries'
import { getCurrentSalon } from '@/lib/salon'
import { addDaysIsoLocal, salonDateToUtc, salonToday } from '@/lib/time'

import { TodayShell } from './_components/today-shell'

type SearchParams = {
  date?: string
  show?: string
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

  const rangeStartUtc = salonDateToUtc(date)
  const rangeEndUtc = salonDateToUtc(addDaysIsoLocal(date, 1))

  const [employees, bookings] = await Promise.all([
    listEmployees({ salonId: salon.id }),
    listTodaysBookings({
      salonId: salon.id,
      rangeStartUtc,
      rangeEndUtc,
    }),
  ])

  const activeEmployees = employees
    .filter((e) => e.is_active)
    .map((e) => ({
      id: e.id,
      display_name: e.display_name,
      color_hex: e.color_hex,
    }))

  return (
    <TodayShell
      date={date}
      today={today}
      show={show}
      bookings={bookings}
      employees={activeEmployees}
    />
  )
}
