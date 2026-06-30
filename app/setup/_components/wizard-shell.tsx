'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { setupInstance } from '@/lib/setup/actions'
import type { SetupPayload } from '@/lib/setup/schema'

import { resizeMatrix, TOTAL_STEPS, type WizardDraft } from '../_lib/draft'
import { useWizardDraft } from '../_lib/use-wizard-draft'
import { StepAdmin } from '../_steps/step-admin'
import { StepEmployees } from '../_steps/step-employees'
import { StepMatrix } from '../_steps/step-matrix'
import { StepReview } from '../_steps/step-review'
import { StepSalon } from '../_steps/step-salon'
import { StepServices } from '../_steps/step-services'
import { StepWelcome } from '../_steps/step-welcome'
import { Stepper } from './stepper'

export function WizardShell() {
  const { draft, setDraft, hydrated, clear } = useWizardDraft()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [submitting, startSubmit] = useTransition()

  if (!hydrated) {
    // Evita el flash de defaults mientras leemos localStorage.
    return null
  }

  function go(delta: number) {
    setDraft((d) => ({
      ...d,
      step: Math.max(0, Math.min(TOTAL_STEPS - 1, d.step + delta)),
    }))
  }

  function update(updater: (d: WizardDraft) => WizardDraft) {
    setDraft((d) => {
      const next = updater(d)
      if (next.services !== d.services || next.employees !== d.employees) {
        return {
          ...next,
          matrix: resizeMatrix(
            next.matrix,
            next.services.length,
            next.employees.length,
          ),
        }
      }
      return next
    })
  }

  function handleSubmit() {
    const payload = buildPayload(draft)
    startSubmit(async () => {
      try {
        const res = await setupInstance(payload, logoFile)
        if (res?.ok === false && res.message) {
          toast.error(res.message)
        } else {
          // setupInstance redirige con NEXT_REDIRECT en éxito; aquí solo
          // limpiamos por si la promesa resolviera sin error (caso raro).
          clear()
        }
      } catch (err) {
        // NEXT_REDIRECT debe propagarse al runtime de Next; otros errores
        // los mostramos al usuario.
        if (
          err &&
          typeof err === 'object' &&
          'digest' in err &&
          typeof (err as { digest?: string }).digest === 'string' &&
          (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
        ) {
          clear()
          throw err
        }
        toast.error('No se pudo crear la instancia. Inténtalo de nuevo.')
      }
    })
  }

  const steps = [
    <StepWelcome key="welcome" onNext={() => go(1)} />,
    <StepAdmin
      key="admin"
      draft={draft}
      update={update}
      onBack={() => go(-1)}
      onNext={() => go(1)}
    />,
    <StepSalon
      key="salon"
      draft={draft}
      update={update}
      logoFile={logoFile}
      setLogoFile={setLogoFile}
      onBack={() => go(-1)}
      onNext={() => go(1)}
    />,
    <StepServices
      key="services"
      draft={draft}
      update={update}
      onBack={() => go(-1)}
      onNext={() => go(1)}
    />,
    <StepEmployees
      key="employees"
      draft={draft}
      update={update}
      onBack={() => go(-1)}
      onNext={() => go(1)}
    />,
    <StepMatrix
      key="matrix"
      draft={draft}
      update={update}
      onBack={() => go(-1)}
      onNext={() => go(1)}
    />,
    <StepReview
      key="review"
      draft={draft}
      logoFile={logoFile}
      submitting={submitting}
      onBack={() => go(-1)}
      onSubmit={handleSubmit}
    />,
  ]

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Stepper current={draft.step} />
      <Card>
        <CardContent className="p-6 sm:p-8">{steps[draft.step]}</CardContent>
      </Card>
    </div>
  )
}

function buildPayload(draft: WizardDraft): SetupPayload {
  return {
    admin: {
      email: draft.admin.email,
      password: draft.admin.password,
      display_name: draft.admin.display_name,
    },
    salon: {
      slug: draft.salon.slug,
      identity: {
        name: draft.salon.identity.name,
        address: draft.salon.identity.address,
        phone: draft.salon.identity.phone,
        contact_email: draft.salon.identity.contact_email,
      },
      workingHours: { days: draft.salon.workingHours.days },
      cancellation: {
        cancellation_min_hours: draft.salon.cancellation.cancellation_min_hours,
        cancellation_policy_text:
          draft.salon.cancellation.cancellation_policy_text,
      },
      legal: { terms_text: draft.salon.legal.terms_text },
    },
    services: draft.services.map((s) => ({
      name: s.name,
      duration_minutes: s.duration_minutes,
      price_cents: s.price_cents,
    })),
    employees: draft.employees.map((e) => ({
      display_name: e.display_name,
      color_hex: e.color_hex,
      weeklySchedule: e.weeklySchedule,
    })),
    matrix: matrixToEntries(draft.matrix),
  } as SetupPayload
}

function matrixToEntries(m: boolean[][]) {
  const out: { serviceIndex: number; employeeIndex: number }[] = []
  for (let s = 0; s < m.length; s++) {
    const row = m[s] ?? []
    for (let e = 0; e < row.length; e++) {
      if (row[e]) out.push({ serviceIndex: s, employeeIndex: e })
    }
  }
  return out
}
