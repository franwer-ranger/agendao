import { getCurrentSalon } from '@/lib/salon'
import { listServicesForSalon } from '@/lib/employees/queries'
import { EmployeeForm } from '../_components/employee-form'

export default async function NewEmployeePage() {
  const salon = await getCurrentSalon()
  const services = await listServicesForSalon(salon.id)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Nuevo empleado</h1>
        <p className="text-sm text-muted-foreground">
          Después de crearlo podrás definir su horario semanal, descansos y
          ausencias.
        </p>
      </div>
      <EmployeeForm
        mode="create"
        defaults={{
          display_name: '',
          bio: '',
          display_order: '0',
          is_active: true,
          service_ids: services.filter((s) => s.is_active).map((s) => s.id),
        }}
        services={services}
      />
    </div>
  )
}
