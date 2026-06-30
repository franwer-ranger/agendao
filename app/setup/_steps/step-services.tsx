'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { WizardNav } from '../_components/wizard-nav'
import type { ServiceDraft, WizardDraft } from '../_lib/draft'

type Props = {
  draft: WizardDraft
  update: (fn: (d: WizardDraft) => WizardDraft) => void
  onBack: () => void
  onNext: () => void
}

export function StepServices({ draft, update, onBack, onNext }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  function updateRow(idx: number, patch: Partial<ServiceDraft>) {
    update((d) => {
      const services = [...d.services]
      services[idx] = { ...services[idx], ...patch }
      return { ...d, services }
    })
  }

  function addRow() {
    update((d) => ({
      ...d,
      services: [
        ...d.services,
        { name: '', duration_minutes: 30, price_cents: 0 },
      ],
    }))
  }

  function removeRow(idx: number) {
    update((d) => ({ ...d, services: d.services.filter((_, i) => i !== idx) }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (draft.services.length === 0) {
      e.__list = 'Añade al menos un servicio'
    }
    draft.services.forEach((s, i) => {
      if (!s.name.trim()) e[`row_${i}`] = 'El nombre es obligatorio'
      else if (s.duration_minutes < 5 || s.duration_minutes % 5 !== 0)
        e[`row_${i}`] = 'Duración debe ser múltiplo de 5 (min 5)'
      else if (s.price_cents < 0) e[`row_${i}`] = 'Precio no válido'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Servicios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hemos pre-rellenado los servicios más comunes en peluquería. Edita,
          elimina o añade los tuyos.
        </p>
      </div>

      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_100px_120px_36px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
          <Label>Servicio</Label>
          <Label>Duración (min)</Label>
          <Label>Precio (€)</Label>
          <span />
        </div>
        {draft.services.map((s, i) => (
          <div key={i} className="space-y-1">
            <div className="grid grid-cols-[1fr_36px] items-center gap-2 sm:grid-cols-[1fr_100px_120px_36px]">
              <Input
                value={s.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                aria-invalid={!!errors[`row_${i}`]}
                placeholder="Nombre del servicio"
                className="col-span-2 sm:col-span-1"
              />
              <Input
                type="number"
                min={5}
                step={5}
                max={480}
                value={s.duration_minutes}
                onChange={(e) =>
                  updateRow(i, {
                    duration_minutes: Number(e.target.value) || 0,
                  })
                }
                aria-invalid={!!errors[`row_${i}`]}
                placeholder="min"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={(s.price_cents / 100).toFixed(2)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  updateRow(i, {
                    price_cents: Number.isFinite(v) ? Math.round(v * 100) : 0,
                  })
                }}
                aria-invalid={!!errors[`row_${i}`]}
                placeholder="€"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label={`Eliminar ${s.name || 'servicio'}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {errors[`row_${i}`] ? (
              <p className="px-1 text-xs text-destructive">
                {errors[`row_${i}`]}
              </p>
            ) : null}
          </div>
        ))}
        {errors.__list ? (
          <p className="text-xs text-destructive">{errors.__list}</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addRow}
        className="gap-1.5"
      >
        <Plus className="size-4" />
        Añadir servicio
      </Button>

      <WizardNav
        onBack={onBack}
        onNext={() => {
          if (validate()) onNext()
        }}
      />
    </div>
  )
}
