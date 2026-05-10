import { notFound } from 'next/navigation'

import { getCurrentSalon } from '@/lib/salon'
import {
  getServiceById,
  listEmployeesForSalon,
} from '@/lib/services/queries'
import { centsToEurInput } from '@/lib/format'
import { ServiceForm } from '../../_components/service-form'

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const salon = await getCurrentSalon()
  const [service, employees] = await Promise.all([
    getServiceById(id, salon.id),
    listEmployeesForSalon(salon.id),
  ])
  if (!service) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">
          Editar servicio
        </h1>
        <p className="text-sm text-muted-foreground">{service.name}</p>
      </div>
      <ServiceForm
        mode="edit"
        serviceId={service.id}
        defaults={{
          id: service.id,
          name: service.name,
          description: service.description ?? '',
          duration_minutes: service.duration_minutes,
          price_eur: centsToEurInput(service.price_cents),
          max_concurrent:
            service.max_concurrent === null ? '' : String(service.max_concurrent),
          is_active: service.is_active,
          employee_ids: service.employee_ids,
        }}
        employees={employees}
      />
    </div>
  )
}
