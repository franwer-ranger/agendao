'use client'

import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { WizardDraft } from '../_lib/draft'

const WEEKDAY_LABEL: Record<number, string> = {
  1: 'L',
  2: 'M',
  3: 'X',
  4: 'J',
  5: 'V',
  6: 'S',
  7: 'D',
}

type Props = {
  draft: WizardDraft
  logoFile: File | null
  submitting: boolean
  onBack: () => void
  onSubmit: () => void
}

export function StepReview({
  draft,
  logoFile,
  submitting,
  onBack,
  onSubmit,
}: Props) {
  const matrixCount = draft.matrix.reduce(
    (acc, row) => acc + row.filter(Boolean).length,
    0,
  )
  const openDays = draft.salon.workingHours.days.filter((d) => !d.closed).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Casi listo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa el resumen y crea tu salón cuando estés conforme.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard title="Administrador">
          <p className="font-medium">{draft.admin.display_name}</p>
          <p className="text-xs text-muted-foreground">{draft.admin.email}</p>
        </SummaryCard>

        <SummaryCard title="Salón">
          <p className="font-medium">{draft.salon.identity.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            /{draft.salon.slug}/book
          </p>
          {logoFile ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Logo: {logoFile.name}
            </p>
          ) : null}
        </SummaryCard>

        <SummaryCard title={`Servicios (${draft.services.length})`}>
          <ul className="space-y-0.5 text-xs">
            {draft.services.slice(0, 4).map((s, i) => (
              <li key={i}>
                {s.name || `Servicio ${i + 1}`} · {s.duration_minutes}min ·{' '}
                {(s.price_cents / 100).toFixed(2)}€
              </li>
            ))}
            {draft.services.length > 4 ? (
              <li className="text-muted-foreground">
                …y {draft.services.length - 4} más
              </li>
            ) : null}
          </ul>
        </SummaryCard>

        <SummaryCard title={`Empleados (${draft.employees.length})`}>
          <ul className="space-y-0.5 text-xs">
            {draft.employees.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                {e.color_hex ? (
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: e.color_hex }}
                  />
                ) : null}
                <span>{e.display_name || `Empleado ${i + 1}`}</span>
                <span className="text-muted-foreground">
                  ·{' '}
                  {e.weeklySchedule
                    .map((s) => WEEKDAY_LABEL[s.weekday])
                    .join('')}
                </span>
              </li>
            ))}
          </ul>
        </SummaryCard>
      </div>

      <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        Horario del salón: {openDays} día{openDays === 1 ? '' : 's'} a la semana
        · Cancelación: mínimo {draft.salon.cancellation.cancellation_min_hours}h
        antes · Matriz servicio↔empleado: {matrixCount} combinaciones activas
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={submitting}
        >
          <ArrowLeft className="size-4" />
          Anterior
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          size="lg"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creando…
            </>
          ) : (
            'Crear mi salón'
          )}
        </Button>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div>{children}</div>
    </div>
  )
}
