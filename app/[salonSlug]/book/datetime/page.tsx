import { notFound, redirect } from 'next/navigation'
import {
  getAvailableSlots,
  groupSlotsByLocalDate,
  type AvailableSlot,
} from '@/lib/availability'
import { getSalonBySlug } from '@/lib/salons/queries'
import { getServiceById } from '@/lib/services/queries'
import { BookingCalendar } from '../_components/booking-calendar'
import { isoDateInTimezone } from '../_lib/format'

const DEFAULT_LOOKAHEAD_DAYS = 30

function parseSearchParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null
  return raw.trim() || null
}

function parsePositiveInt(raw: string | null): number | null {
  if (raw === null) return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + days)
  return [
    t.getUTCFullYear(),
    String(t.getUTCMonth() + 1).padStart(2, '0'),
    String(t.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export default async function DatetimeStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ salonSlug: string }>
  searchParams: Promise<{
    serviceId?: string | string[]
    employeeId?: string | string[]
    preselectedDate?: string | string[]
  }>
}) {
  const { salonSlug } = await params
  const sp = await searchParams
  const salon = await getSalonBySlug(salonSlug)
  if (!salon) notFound()

  const serviceId = parsePositiveInt(parseSearchParam(sp.serviceId))
  if (!serviceId) redirect(`/${salonSlug}/book/service`)

  const service = await getServiceById(serviceId, salon.id)
  if (!service || !service.is_active) {
    redirect(`/${salonSlug}/book/service`)
  }

  const rawEmployee = parseSearchParam(sp.employeeId)
  let employeeFilter: number | 'any'
  if (rawEmployee === 'any') {
    employeeFilter = 'any'
  } else {
    const parsedEmpId = parsePositiveInt(rawEmployee)
    if (!parsedEmpId || !service.employee_ids.includes(parsedEmpId)) {
      redirect(`/${salonSlug}/book/employee?serviceId=${serviceId}`)
    }
    employeeFilter = parsedEmpId
  }

  const today = new Date()
  const fromKey = isoDateInTimezone(today, salon.timezone)
  const lookahead = Math.min(
    DEFAULT_LOOKAHEAD_DAYS,
    Math.max(1, salon.booking_max_days_ahead),
  )
  const toKey = addDaysToDateKey(fromKey, lookahead - 1)

  const slots = await getAvailableSlots({
    salonId: salon.id,
    serviceId,
    employeeId: employeeFilter,
    from: fromKey,
    to: toKey,
  })

  const grouped = groupSlotsByLocalDate(slots, salon.timezone)
  const slotsByDate: Record<string, AvailableSlot[]> = {}
  for (const [key, list] of grouped) {
    slotsByDate[key] = list
  }

  const preselectedDate = parseSearchParam(sp.preselectedDate) ?? undefined
  const originalEmployeeChoice =
    employeeFilter === 'any' ? 'any' : String(employeeFilter)

  return (
    <section aria-labelledby="datetime-step-heading" className="space-y-4">
      <header className="space-y-1">
        <h2 id="datetime-step-heading" className="text-xl font-semibold">
          ¿Cuándo quieres venir?
        </h2>
        <p className="text-sm text-muted-foreground">
          Para <span className="font-medium">{service.name}</span>.
        </p>
      </header>

      <BookingCalendar
        salonSlug={salonSlug}
        serviceId={serviceId}
        originalEmployeeChoice={originalEmployeeChoice}
        timezone={salon.timezone}
        slotsByDate={slotsByDate}
        initialDateKey={preselectedDate}
        minDateKey={fromKey}
        maxDateKey={toKey}
      />
    </section>
  )
}
