import { createHash } from 'node:crypto'
import { notFound, redirect } from 'next/navigation'
import { getAvailableSlots } from '@/lib/availability'
import { getPublicEmployeeName } from '@/lib/employees/queries'
import { getSalonBySlug } from '@/lib/salons/queries'
import { getServiceById } from '@/lib/services/queries'
import { BookingSummary } from '../_components/summary'
import { DetailsForm } from '../_components/details-form'
import { isoDateInTimezone } from '../_lib/format'

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

function deriveIdempotencyKey(
  salonSlug: string,
  serviceId: number,
  employeeId: number,
  startsAt: string,
): string {
  return createHash('sha256')
    .update(`${salonSlug}|${serviceId}|${employeeId}|${startsAt}`)
    .digest('hex')
}

export default async function DetailsStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ salonSlug: string }>
  searchParams: Promise<{
    serviceId?: string | string[]
    employeeId?: string | string[]
    startsAt?: string | string[]
    originalEmployeeChoice?: string | string[]
  }>
}) {
  const { salonSlug } = await params
  const sp = await searchParams
  const salon = await getSalonBySlug(salonSlug)
  if (!salon) notFound()

  const serviceId = parsePositiveInt(parseSearchParam(sp.serviceId))
  const employeeId = parsePositiveInt(parseSearchParam(sp.employeeId))
  const startsAt = parseSearchParam(sp.startsAt)
  const rawOriginalChoice = parseSearchParam(sp.originalEmployeeChoice)

  if (!serviceId) redirect(`/${salonSlug}/book/service`)
  if (!employeeId || !startsAt) {
    redirect(`/${salonSlug}/book/employee?serviceId=${serviceId}`)
  }

  if (Number.isNaN(new Date(startsAt).getTime())) {
    redirect(
      `/${salonSlug}/book/datetime?serviceId=${serviceId}&employeeId=${employeeId}`,
    )
  }

  const service = await getServiceById(serviceId, salon.id)
  if (!service || !service.is_active) {
    redirect(`/${salonSlug}/book/service`)
  }

  if (!service.employee_ids.includes(employeeId)) {
    redirect(`/${salonSlug}/book/employee?serviceId=${serviceId}`)
  }

  const employeeName = await getPublicEmployeeName({
    salonId: salon.id,
    employeeId,
  })
  if (!employeeName) {
    redirect(`/${salonSlug}/book/employee?serviceId=${serviceId}`)
  }

  const dayKey = isoDateInTimezone(new Date(startsAt), salon.timezone)

  // Re-validación defensiva: si el slot ya no está, vuelta al paso 3.
  const sameDaySlots = await getAvailableSlots({
    salonId: salon.id,
    serviceId,
    employeeId,
    from: dayKey,
    to: dayKey,
  })
  const stillThere = sameDaySlots.some((s) => s.startsAt === startsAt)
  if (!stillThere) {
    const params2 = new URLSearchParams({
      serviceId: String(serviceId),
      employeeId: rawOriginalChoice === 'any' ? 'any' : String(employeeId),
      preselectedDate: dayKey,
    })
    redirect(`/${salonSlug}/book/datetime?${params2.toString()}`)
  }

  const originalEmployeeChoice: 'any' | string =
    rawOriginalChoice === 'any' ? 'any' : String(employeeId)
  const idempotencyKey = deriveIdempotencyKey(
    salonSlug,
    serviceId,
    employeeId,
    startsAt,
  )
  const termsRequired = !!salon.terms_text

  return (
    <section aria-labelledby="details-step-heading" className="space-y-5">
      <header className="space-y-1">
        <h2 id="details-step-heading" className="text-xl font-semibold">
          Tus datos
        </h2>
        <p className="text-sm text-muted-foreground">
          Revisa la reserva y completa tus datos para confirmar.
        </p>
      </header>

      <BookingSummary
        serviceName={service.name}
        durationMinutes={service.duration_minutes}
        priceCents={service.price_cents}
        employeeName={employeeName}
        startsAt={startsAt}
        timezone={salon.timezone}
        fromAnyChoice={originalEmployeeChoice === 'any'}
      />

      <DetailsForm
        salonSlug={salonSlug}
        serviceId={serviceId}
        employeeId={employeeId}
        startsAt={startsAt}
        originalEmployeeChoice={originalEmployeeChoice}
        idempotencyKey={idempotencyKey}
        termsRequired={termsRequired}
        cancellationPolicyText={salon.cancellation_policy_text}
        termsText={salon.terms_text}
      />
    </section>
  )
}
