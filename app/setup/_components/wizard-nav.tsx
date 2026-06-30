'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

type Props = {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  hideBack?: boolean
}

export function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Siguiente',
  nextDisabled = false,
  hideBack = false,
}: Props) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {hideBack ? (
        <span />
      ) : (
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Anterior
        </Button>
      )}
      <Button type="button" onClick={onNext} disabled={nextDisabled} size="lg">
        {nextLabel}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}
