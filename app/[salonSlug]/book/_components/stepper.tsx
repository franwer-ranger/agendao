'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'service', label: 'Servicio' },
  { key: 'employee', label: 'Profesional' },
  { key: 'datetime', label: 'Fecha y hora' },
  { key: 'details', label: 'Tus datos' },
] as const

function currentStepIndex(pathname: string, salonSlug: string): number {
  const base = `/${salonSlug}/book/`
  if (!pathname.startsWith(base)) return -1
  const rest = pathname.slice(base.length).split('/')[0] ?? ''
  if (rest === 'done') return STEPS.length // ya confirmado
  const idx = STEPS.findIndex((s) => s.key === rest)
  return idx
}

export function Stepper({ salonSlug }: { salonSlug: string }) {
  const pathname = usePathname()
  const current = currentStepIndex(pathname, salonSlug)
  if (current < 0) return null

  return (
    <nav aria-label="Pasos de la reserva" className="w-full">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < current
          const isCurrent = idx === current
          return (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-1.5 flex-1 rounded-full transition-colors',
                  isCurrent
                    ? 'bg-primary'
                    : isDone
                      ? 'bg-primary/60'
                      : 'bg-muted',
                )}
              />
            </li>
          )
        })}
      </ol>
      <p
        className="mt-2 text-xs font-medium text-muted-foreground"
        aria-live="polite"
      >
        Paso {Math.min(current + 1, STEPS.length)} de {STEPS.length}
        {STEPS[current] ? ` · ${STEPS[current].label}` : ''}
      </p>
    </nav>
  )
}
