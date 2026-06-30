'use client'

import { ArrowRight, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6 py-4 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-6" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Bienvenido a Agendao</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Vamos a configurar tu salón en unos minutos: tu cuenta, los datos del
          salón, tus servicios y tu equipo. Podrás cambiar todo después desde el
          panel.
        </p>
      </div>
      <Button onClick={onNext} size="lg" className="mx-auto">
        Empezar
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}
