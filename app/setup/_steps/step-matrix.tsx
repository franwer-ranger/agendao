'use client'

import { Checkbox } from '@/components/ui/checkbox'

import { WizardNav } from '../_components/wizard-nav'
import type { WizardDraft } from '../_lib/draft'

type Props = {
  draft: WizardDraft
  update: (fn: (d: WizardDraft) => WizardDraft) => void
  onBack: () => void
  onNext: () => void
}

export function StepMatrix({ draft, update, onBack, onNext }: Props) {
  function toggle(serviceIdx: number, employeeIdx: number) {
    update((d) => {
      const matrix = d.matrix.map((row) => [...row])
      const current = matrix[serviceIdx]?.[employeeIdx] ?? true
      if (!matrix[serviceIdx]) matrix[serviceIdx] = []
      matrix[serviceIdx][employeeIdx] = !current
      return { ...d, matrix }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Quién hace qué</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Marca qué empleados pueden hacer cada servicio. Por defecto, todos los
          pueden hacer todo.
        </p>
      </div>

      {draft.employees.length === 0 || draft.services.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Necesitas al menos un servicio y un empleado para configurar la
          matriz.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b py-2 pr-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Servicio
                </th>
                {draft.employees.map((e, i) => (
                  <th
                    key={i}
                    className="border-b px-2 py-2 text-center text-xs font-medium"
                  >
                    {e.display_name || `Empleado ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.services.map((s, si) => (
                <tr key={si} className="border-b last:border-b-0">
                  <td className="py-2 pr-2">
                    {s.name || `Servicio ${si + 1}`}
                  </td>
                  {draft.employees.map((emp, ei) => (
                    <td key={ei} className="px-2 py-2 text-center">
                      <Checkbox
                        checked={draft.matrix[si]?.[ei] ?? true}
                        onCheckedChange={() => toggle(si, ei)}
                        aria-label={`${s.name} - ${emp.display_name}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  )
}
