'use client'

import * as React from 'react'
import { useActionState, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateIdentityAction, type ActionState } from '@/lib/salons/actions'
import { LOGO_ALLOWED_MIME, LOGO_MAX_BYTES } from '@/lib/salons/schema'

const clientSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  address: z.string().trim().max(300, 'Máximo 300 caracteres'),
  phone: z.string().trim().max(30, 'Máximo 30 caracteres'),
  contact_email: z.string().trim().max(254, 'Demasiado largo'),
})

type FormValues = z.infer<typeof clientSchema>

export type IdentityFormDefaults = {
  name: string
  address: string
  phone: string
  contact_email: string
}

const initialState: ActionState = { ok: false }

export function IdentityForm({
  defaults,
  logoUrl,
}: {
  defaults: IdentityFormDefaults
  logoUrl: string | null
}) {
  const [state, formAction, pending] = useActionState(
    updateIdentityAction,
    initialState,
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaults,
  })

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [clientLogoError, setClientLogoError] = useState<string | null>(null)
  // El input file es uncontrolled — bumpamos esta key para limpiarlo.
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    if (state === initialState) return
    if (state.ok) {
      toast.success('Datos guardados')
      return
    }
    if (state.errors) {
      for (const [field, msgs] of Object.entries(state.errors)) {
        if (field === 'logo') continue // se renderiza desde state directamente
        if (msgs && msgs.length > 0 && field in form.getValues()) {
          form.setError(field as keyof FormValues, { message: msgs[0] })
        }
      }
    }
    if (state.message) toast.error(state.message)
  }, [state, form])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setClientLogoError(null)
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      setLogoPreview(null)
      return
    }
    if (!(LOGO_ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setClientLogoError('Formato no soportado (PNG, JPG, WEBP o SVG)')
      setSelectedFile(null)
      setLogoPreview(null)
      setFileInputKey((k) => k + 1)
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setClientLogoError('El archivo supera 2 MB')
      setSelectedFile(null)
      setLogoPreview(null)
      setFileInputKey((k) => k + 1)
      return
    }
    setRemoveLogo(false)
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (evt) => setLogoPreview(evt.target?.result as string)
    reader.readAsDataURL(file)
  }

  function onRemoveLogoClick() {
    setRemoveLogo(true)
    setSelectedFile(null)
    setLogoPreview(null)
    setFileInputKey((k) => k + 1)
  }

  const onSubmit = form.handleSubmit((values) => {
    setClientLogoError(null)
    const fd = new FormData()
    fd.set('name', values.name)
    fd.set('address', values.address)
    fd.set('phone', values.phone)
    fd.set('contact_email', values.contact_email)
    fd.set('remove_logo', removeLogo ? 'true' : 'false')
    if (selectedFile) fd.set('logo', selectedFile)
    // Optimista: tras enviar, dejamos el input limpio.
    setSelectedFile(null)
    setLogoPreview(null)
    setRemoveLogo(false)
    setFileInputKey((k) => k + 1)
    React.startTransition(() => formAction(fd))
  })

  const errors = form.formState.errors
  const serverLogoError =
    state !== initialState && !state.ok ? state.errors?.logo?.[0] : null
  const logoError = clientLogoError ?? serverLogoError ?? null
  const showLogo = !removeLogo && (logoPreview || logoUrl)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="off" {...form.register('name')} />
        </Field>
        <Field label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
          <Input
            id="phone"
            inputMode="tel"
            placeholder="+34 600 000 000"
            {...form.register('phone')}
          />
        </Field>
      </div>

      <Field
        label="Dirección"
        htmlFor="address"
        error={errors.address?.message}
        hint="Aparece en la landing y en los emails de confirmación."
      >
        <Textarea id="address" rows={2} {...form.register('address')} />
      </Field>

      <Field
        label="Email de contacto"
        htmlFor="contact_email"
        error={errors.contact_email?.message}
        hint="Visible para el cliente. Para notificaciones internas, configurar aparte."
      >
        <Input
          id="contact_email"
          type="email"
          autoComplete="off"
          {...form.register('contact_email')}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Label>Logo</Label>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(logoPreview ?? logoUrl) as string}
                alt="Logo del salón"
                className="size-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">Sin logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              key={fileInputKey}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFile}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP o SVG. Máximo 2 MB.
            </p>
            {logoUrl && !logoPreview && !removeLogo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemoveLogoClick}
                className="self-start"
              >
                <X className="size-4" /> Quitar logo actual
              </Button>
            ) : null}
            {removeLogo ? (
              <p className="text-xs text-muted-foreground">
                El logo se eliminará al guardar.{' '}
                <button
                  type="button"
                  onClick={() => setRemoveLogo(false)}
                  className="underline"
                >
                  Cancelar
                </button>
              </p>
            ) : null}
            {logoError ? (
              <p className="text-xs text-destructive">{logoError}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
