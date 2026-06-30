'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { WizardNav } from '../_components/wizard-nav'
import type { WizardDraft } from '../_lib/draft'

type Props = {
  draft: WizardDraft
  update: (fn: (d: WizardDraft) => WizardDraft) => void
  onBack: () => void
  onNext: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function StepAdmin({ draft, update, onBack, onNext }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!draft.admin.display_name.trim()) e.display_name = 'Obligatorio'
    if (!EMAIL_RE.test(draft.admin.email.trim())) e.email = 'Email no válido'
    if (draft.admin.password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (draft.admin.password !== draft.admin.passwordConfirm)
      e.passwordConfirm = 'No coincide'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tu cuenta de administrador</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Será la cuenta con acceso total al panel. Podrás añadir más cuentas
          después.
        </p>
      </div>

      <div className="space-y-4">
        <Field label="Tu nombre" id="admin-name" error={errors.display_name}>
          <Input
            id="admin-name"
            value={draft.admin.display_name}
            onChange={(e) =>
              update((d) => ({
                ...d,
                admin: { ...d.admin, display_name: e.target.value },
              }))
            }
            aria-invalid={!!errors.display_name}
          />
        </Field>

        <Field label="Email" id="admin-email" error={errors.email}>
          <Input
            id="admin-email"
            type="email"
            value={draft.admin.email}
            onChange={(e) =>
              update((d) => ({
                ...d,
                admin: { ...d.admin, email: e.target.value },
              }))
            }
            aria-invalid={!!errors.email}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contraseña" id="admin-pw" error={errors.password}>
            <Input
              id="admin-pw"
              type="password"
              value={draft.admin.password}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  admin: { ...d.admin, password: e.target.value },
                }))
              }
              aria-invalid={!!errors.password}
              autoComplete="new-password"
            />
          </Field>
          <Field
            label="Repite la contraseña"
            id="admin-pw2"
            error={errors.passwordConfirm}
          >
            <Input
              id="admin-pw2"
              type="password"
              value={draft.admin.passwordConfirm}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  admin: { ...d.admin, passwordConfirm: e.target.value },
                }))
              }
              aria-invalid={!!errors.passwordConfirm}
              autoComplete="new-password"
            />
          </Field>
        </div>
      </div>

      <WizardNav
        onBack={onBack}
        onNext={() => {
          if (validate()) onNext()
        }}
      />
    </div>
  )
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
