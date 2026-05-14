import { getCurrentSalon } from '@/lib/salon'
import { listEmployees } from '@/lib/employees/queries'
import { listActiveServicesWithEmployees } from '@/lib/services/queries'
import {
  listBlocksInRange,
  listBookingsInRange,
} from '@/lib/bookings/queries-calendar'
import {
  addDaysIsoLocal,
  salonDateToUtc,
  startOfIsoWeek,
  salonToday,
} from '@/lib/time'
import { CalendarShell } from './_components/calendar-shell'

type SearchParams = {
  date?: string
  view?: string
  employeeId?: string | string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const salon = await getCurrentSalon()

  // Normaliza params: fecha actual Madrid por defecto, view 'day'.
  const today = salonToday()
  const date = params.date && DATE_RE.test(params.date) ? params.date : today
  const view = params.view === 'week' ? 'week' : 'day'

  // Rango de carga según vista.
  let rangeFrom: string
  let rangeTo: string
  if (view === 'day') {
    rangeFrom = date
    rangeTo = addDaysIsoLocal(date, 1)
  } else {
    rangeFrom = startOfIsoWeek(date)
    rangeTo = addDaysIsoLocal(rangeFrom, 7)
  }
  const rangeStartUtc = salonDateToUtc(rangeFrom)
  const rangeEndUtc = salonDateToUtc(rangeTo)

  // Carga paralela.
  const [employees, bookings, services] = await Promise.all([
    listEmployees({ salonId: salon.id }),
    listBookingsInRange({
      salonId: salon.id,
      rangeStartUtc,
      rangeEndUtc,
    }),
    listActiveServicesWithEmployees(salon.id),
  ])

  const activeEmployees = employees.filter((e) => e.is_active)
  const blocks = await listBlocksInRange({
    employeeIds: activeEmployees.map((e) => e.id),
    rangeStartUtc,
    rangeEndUtc,
  })

  // Filtro empleado: en day puede ser múltiple (todos por defecto), en week
  // siempre uno (el primero por defecto si no llega).
  const rawEmpParam = params.employeeId
  const empParam: string[] = Array.isArray(rawEmpParam)
    ? rawEmpParam
    : rawEmpParam
      ? [rawEmpParam]
      : []
  const empIds = empParam
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)
  const validEmpIds = empIds.filter((id) =>
    activeEmployees.some((e) => e.id === id),
  )

  const selectedEmployeeIds =
    view === 'day'
      ? validEmpIds.length > 0
        ? validEmpIds
        : activeEmployees.map((e) => e.id)
      : validEmpIds.length > 0
        ? [validEmpIds[0]]
        : activeEmployees.length > 0
          ? [activeEmployees[0].id]
          : []

  return (
    <CalendarShell
      date={date}
      view={view}
      employees={activeEmployees.map((e) => ({
        id: e.id,
        display_name: e.display_name,
        color_hex: e.color_hex,
      }))}
      selectedEmployeeIds={selectedEmployeeIds}
      bookings={bookings}
      blocks={blocks}
      services={services}
      salonTimezone={salon.timezone}
      slotGranularityMinutes={salon.slot_granularity_minutes}
    />
  )
}
