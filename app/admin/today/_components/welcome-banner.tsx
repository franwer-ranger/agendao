'use client'

import { Check, Copy, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { dismissWelcomeAction } from '@/lib/auth/actions'

type Props = {
  bookingUrl: string
}

export function WelcomeBanner({ bookingUrl }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()

  if (dismissed) return null

  function handleCopy() {
    navigator.clipboard
      .writeText(bookingUrl)
      .then(() => {
        setCopied(true)
        toast.success('Enlace copiado')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('No se pudo copiar'))
  }

  function handleDismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissWelcomeAction().catch(() => {
        // No bloquear: si falla, el banner volverá la próxima vez que
        // se entre con ?welcome=true (que normalmente no vuelve a pasar).
      })
    })
  }

  return (
    <div className="relative mb-6 rounded-xl border border-emerald-300/60 bg-emerald-50 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/30">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar"
        className="absolute right-3 top-3 rounded-md p-1 text-emerald-900/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-100/70 dark:hover:bg-emerald-900/40"
      >
        <X className="size-4" />
      </button>

      <div className="space-y-3 pr-8">
        <div>
          <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-50">
            Tu salón está listo
          </h2>
          <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-50/80">
            Comparte este enlace con tus clientes para que reserven online:
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-md border border-emerald-300/60 bg-white px-3 py-2 text-sm font-mono text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-50">
            {bookingUrl}
          </code>
          <Button
            type="button"
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="gap-2 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-50"
          >
            {copied ? (
              <>
                <Check className="size-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copiar enlace
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
