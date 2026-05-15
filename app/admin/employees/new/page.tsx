import { getCurrentSalon } from '@/lib/salon'
import { listEmployees, listServicesForSalon } from '@/lib/employees/queries'
import { EmployeeForm } from '../_components/employee-form'

// Misma paleta que `_components/employee-form.tsx` y el backfill SQL — se
// duplica aquí porque el `EmployeeForm` es client component y no podemos
// importar de él desde un server component sin arrastrar runtime cliente.
const DEFAULT_PALETTE = [
  '#4F46E5',
  '#0EA5E9',
  '#DB2777',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
]

export default async function NewEmployeePage() {
  const salon = await getCurrentSalon()
  const [services, existing] = await Promise.all([
    listServicesForSalon(salon.id),
    listEmployees({ salonId: salon.id }),
  ])

  // Sugerimos el siguiente color libre de la paleta para minimizar duplicados
  // visuales en el calendario.
  const usedColors = new Set(
    existing
      .map((e) => e.color_hex?.toLowerCase())
      .filter((c): c is string => Boolean(c)),
  )
  const suggested =
    DEFAULT_PALETTE.find((c) => !usedColors.has(c.toLowerCase())) ??
    DEFAULT_PALETTE[existing.length % DEFAULT_PALETTE.length]

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
          color_hex: suggested,
          display_order: '0',
          is_active: true,
          service_ids: services.filter((s) => s.is_active).map((s) => s.id),
        }}
        services={services}
      />
    </div>
  )
}
