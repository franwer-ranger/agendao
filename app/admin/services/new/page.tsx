import { getCurrentSalon } from '@/lib/salon'
import { listEmployeesForSalon } from '@/lib/services/queries'
import { ServiceForm } from '../_components/service-form'

export default async function NewServicePage() {
  const salon = await getCurrentSalon()
  const employees = await listEmployeesForSalon(salon.id)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Nuevo servicio</h1>
        <p className="text-sm text-muted-foreground">
          Define duración, precio y qué empleados pueden realizarlo.
        </p>
      </div>
      <ServiceForm
        mode="create"
        defaults={{
          name: '',
          description: '',
          duration_minutes: 30,
          price_eur: '',
          max_concurrent: '',
          is_active: true,
          employee_ids: employees.filter((e) => e.is_active).map((e) => e.id),
        }}
        employees={employees}
      />
    </div>
  )
}
