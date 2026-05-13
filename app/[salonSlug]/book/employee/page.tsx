import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSalonBySlug } from '@/lib/salons/queries'
import { getServiceById } from '@/lib/services/queries'
import { listPublicEmployeesForService } from '@/lib/employees/queries'
import { AnyEmployeeOption } from '../_components/any-employee-option'
import { EmployeeCard } from '../_components/employee-card'

function parseServiceId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export default async function EmployeeStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ salonSlug: string }>
  searchParams: Promise<{ serviceId?: string | string[] }>
}) {
  const { salonSlug } = await params
  const sp = await searchParams
  const salon = await getSalonBySlug(salonSlug)
  if (!salon) notFound()

  const serviceId = parseServiceId(sp.serviceId)
  if (!serviceId) redirect(`/${salonSlug}/book/service`)

  const service = await getServiceById(serviceId, salon.id)
  if (!service || !service.is_active) {
    redirect(`/${salonSlug}/book/service`)
  }

  const employees = await listPublicEmployeesForService({
    salonId: salon.id,
    serviceId,
  })

  const buildHref = (employeeId: number | 'any') =>
    `/${salonSlug}/book/datetime?serviceId=${serviceId}&employeeId=${employeeId}`

  return (
    <section aria-labelledby="employee-step-heading" className="space-y-4">
      <header className="space-y-1">
        <h2 id="employee-step-heading" className="text-xl font-semibold">
          ¿Con quién prefieres?
        </h2>
        <p className="text-sm text-muted-foreground">
          Para <span className="font-medium">{service.name}</span>.
        </p>
      </header>

      {employees.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Ahora mismo no hay ningún profesional disponible para este
            servicio.
          </p>
          <Link
            href={`/${salonSlug}/book/service`}
            className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Elegir otro servicio
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          <li>
            <AnyEmployeeOption href={buildHref('any')} />
          </li>
          {employees.map((employee) => (
            <li key={employee.id}>
              <EmployeeCard
                employee={employee}
                href={buildHref(employee.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
