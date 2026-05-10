import { notFound } from 'next/navigation'

import { getCurrentSalon } from '@/lib/salon'
import {
  getEmployeeById,
  getWeeklySchedule,
  listServicesForSalon,
} from '@/lib/employees/queries'
import { Separator } from '@/components/ui/separator'
import { EmployeeForm } from '../../_components/employee-form'
import { WeeklyScheduleEditor } from '../../_components/weekly-schedule-editor'

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = Number(idStr)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const salon = await getCurrentSalon()
  const [employee, services, weeklyShifts] = await Promise.all([
    getEmployeeById(id, salon.id),
    listServicesForSalon(salon.id),
    getWeeklySchedule(id),
  ])
  if (!employee) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">
          {employee.display_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Edita los datos básicos, los servicios que puede realizar y su
          horario semanal. Descansos y ausencias llegan en la siguiente
          iteración.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-semibold">Datos</h2>
        <EmployeeForm
          mode="edit"
          employeeId={employee.id}
          defaults={{
            id: employee.id,
            display_name: employee.display_name,
            bio: employee.bio ?? '',
            display_order: String(employee.display_order),
            is_active: employee.is_active,
            service_ids: employee.service_ids,
          }}
          services={services}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Horario semanal
          </h2>
          <p className="text-sm text-muted-foreground">
            Define las horas en las que trabaja cada día. Para una comida
            partida, añade dos tramos en el mismo día.
          </p>
        </div>
        <WeeklyScheduleEditor
          employeeId={employee.id}
          defaults={weeklyShifts}
        />
      </section>
    </div>
  )
}
