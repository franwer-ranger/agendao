'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  LOGO_ALLOWED_MIME,
  LOGO_MAX_BYTES,
  validateLogoFile,
} from '@/lib/salons/schema'

import { WizardNav } from '../_components/wizard-nav'
import type { WizardDraft } from '../_lib/draft'
import { suggestSalonSlug } from '../_lib/slugify'

const WEEKDAYS = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 7, label: 'Domingo' },
] as const

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type Props = {
  draft: WizardDraft
  update: (fn: (d: WizardDraft) => WizardDraft) => void
  logoFile: File | null
  setLogoFile: (f: File | null) => void
  onBack: () => void
  onNext: () => void
}

export function StepSalon({
  draft,
  update,
  logoFile,
  setLogoFile,
  onBack,
  onNext,
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!draft.salon.slugManuallyEdited && draft.salon.identity.name) {
      const suggested = suggestSalonSlug(draft.salon.identity.name)
      if (suggested !== draft.salon.slug) {
        update((d) => ({ ...d, salon: { ...d.salon, slug: suggested } }))
      }
    }
  }, [
    draft.salon.identity.name,
    draft.salon.slugManuallyEdited,
    draft.salon.slug,
    update,
  ])

  // Preview del logo. FileReader es async, por eso vive en useEffect en
  // lugar de derivarse en render.
  useEffect(() => {
    if (!logoFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset cuando se quita el logo.
      setLogoPreview(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(logoFile)
  }, [logoFile])

  function handleLogoChange(file: File | null) {
    if (!file) {
      setLogoFile(null)
      return
    }
    const err = validateLogoFile(file)
    if (err) {
      setErrors((prev) => ({ ...prev, logo: err }))
      return
    }
    setErrors((prev) => {
      const next = { ...prev }
      delete next.logo
      return next
    })
    setLogoFile(file)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!draft.salon.identity.name.trim())
      e.name = 'El nombre del salón es obligatorio'
    if (!draft.salon.slug.trim()) e.slug = 'El identificador es obligatorio'
    else if (!SLUG_RE.test(draft.salon.slug))
      e.slug = 'Solo minúsculas, números y guiones (sin acentos)'
    draft.salon.workingHours.days.forEach((d, i) => {
      if (d.closed) return
      if (!d.opens_at || !d.closes_at) {
        e[`hours_${i}`] =
          'Define apertura y cierre, o marca el día como cerrado'
      } else if (d.closes_at <= d.opens_at) {
        e[`hours_${i}`] = 'El cierre debe ser posterior a la apertura'
      }
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Datos del salón</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esto es lo que verán tus clientes en la página pública de reservas.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Identidad
        </h3>

        <div className="space-y-1.5">
          <Label htmlFor="salon-name">Nombre del salón</Label>
          <Input
            id="salon-name"
            value={draft.salon.identity.name}
            onChange={(e) =>
              update((d) => ({
                ...d,
                salon: {
                  ...d.salon,
                  identity: { ...d.salon.identity, name: e.target.value },
                },
              }))
            }
            aria-invalid={!!errors.name}
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="salon-slug">Identificador en la URL</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              tu-dominio.com/
            </span>
            <Input
              id="salon-slug"
              value={draft.salon.slug}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  salon: {
                    ...d.salon,
                    slug: e.target.value,
                    slugManuallyEdited: true,
                  },
                }))
              }
              aria-invalid={!!errors.slug}
              className="font-mono"
            />
            <span className="text-xs text-muted-foreground">/book</span>
          </div>
          {errors.slug ? (
            <p className="text-xs text-destructive">{errors.slug}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salon-phone">Teléfono</Label>
            <Input
              id="salon-phone"
              value={draft.salon.identity.phone}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  salon: {
                    ...d.salon,
                    identity: { ...d.salon.identity, phone: e.target.value },
                  },
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salon-email">Email de contacto</Label>
            <Input
              id="salon-email"
              type="email"
              value={draft.salon.identity.contact_email}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  salon: {
                    ...d.salon,
                    identity: {
                      ...d.salon.identity,
                      contact_email: e.target.value,
                    },
                  },
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="salon-address">Dirección</Label>
          <Input
            id="salon-address"
            value={draft.salon.identity.address}
            onChange={(e) =>
              update((d) => ({
                ...d,
                salon: {
                  ...d.salon,
                  identity: { ...d.salon.identity, address: e.target.value },
                },
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Logo (opcional)</Label>
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <div className="relative">
                <Image
                  src={logoPreview}
                  alt="Vista previa del logo"
                  width={64}
                  height={64}
                  className="size-16 rounded-md object-cover ring-1 ring-border"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => {
                    handleLogoChange(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 ring-1 ring-border hover:bg-muted"
                  aria-label="Quitar logo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="flex size-16 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                Sin logo
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={LOGO_ALLOWED_MIME.join(',')}
              onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG o WEBP. Máximo {Math.round(LOGO_MAX_BYTES / 1024 / 1024)}{' '}
            MB.
          </p>
          {errors.logo ? (
            <p className="text-xs text-destructive">{errors.logo}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Horario semanal
        </h3>
        <div className="space-y-2">
          {draft.salon.workingHours.days.map((day, i) => {
            const weekday = WEEKDAYS.find((w) => w.id === day.weekday)!
            return (
              <div
                key={day.weekday}
                className="grid grid-cols-[100px_auto_1fr] items-center gap-3 sm:grid-cols-[100px_auto_auto_auto_auto]"
              >
                <span className="text-sm">{weekday.label}</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!day.closed}
                    onCheckedChange={(checked) =>
                      update((d) => {
                        const days = [...d.salon.workingHours.days]
                        days[i] = { ...days[i], closed: !checked }
                        return {
                          ...d,
                          salon: { ...d.salon, workingHours: { days } },
                        }
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {day.closed ? 'Cerrado' : 'Abierto'}
                  </span>
                </div>
                {!day.closed ? (
                  <>
                    <Input
                      type="time"
                      value={day.opens_at}
                      onChange={(e) =>
                        update((d) => {
                          const days = [...d.salon.workingHours.days]
                          days[i] = { ...days[i], opens_at: e.target.value }
                          return {
                            ...d,
                            salon: { ...d.salon, workingHours: { days } },
                          }
                        })
                      }
                      aria-invalid={!!errors[`hours_${i}`]}
                      className="w-[110px]"
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={day.closes_at}
                      onChange={(e) =>
                        update((d) => {
                          const days = [...d.salon.workingHours.days]
                          days[i] = { ...days[i], closes_at: e.target.value }
                          return {
                            ...d,
                            salon: { ...d.salon, workingHours: { days } },
                          }
                        })
                      }
                      aria-invalid={!!errors[`hours_${i}`]}
                      className="w-[110px]"
                    />
                  </>
                ) : null}
                {errors[`hours_${i}`] ? (
                  <p className="col-span-full text-xs text-destructive">
                    {errors[`hours_${i}`]}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Política de cancelación
        </h3>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="cancel-hours">Antelación mínima (horas)</Label>
            <Input
              id="cancel-hours"
              type="number"
              min={0}
              max={720}
              value={draft.salon.cancellation.cancellation_min_hours}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  salon: {
                    ...d.salon,
                    cancellation: {
                      ...d.salon.cancellation,
                      cancellation_min_hours: Number(e.target.value) || 0,
                    },
                  },
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-text">Texto de política (opcional)</Label>
            <Textarea
              id="cancel-text"
              rows={3}
              value={draft.salon.cancellation.cancellation_policy_text}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  salon: {
                    ...d.salon,
                    cancellation: {
                      ...d.salon.cancellation,
                      cancellation_policy_text: e.target.value,
                    },
                  },
                }))
              }
              placeholder="Ej: Las cancelaciones con menos de 12 horas de antelación…"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aviso legal (opcional)
        </h3>
        <Textarea
          rows={3}
          value={draft.salon.legal.terms_text}
          onChange={(e) =>
            update((d) => ({
              ...d,
              salon: { ...d.salon, legal: { terms_text: e.target.value } },
            }))
          }
          placeholder="Términos y condiciones, aviso RGPD, etc."
        />
      </section>

      <WizardNav
        onBack={onBack}
        onNext={() => {
          if (validate()) onNext()
        }}
      />
    </div>
  )
}
