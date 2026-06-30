'use client'

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

import { STEP_TITLES } from '../_lib/draft'

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs sm:gap-3">
      {STEP_TITLES.map((title, idx) => {
        const isPast = idx < current
        const isCurrent = idx === current
        return (
          <li key={title} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-xs font-medium',
                isCurrent &&
                  'border-primary bg-primary text-primary-foreground',
                isPast && 'border-primary bg-primary/10 text-primary',
                !isCurrent &&
                  !isPast &&
                  'border-border bg-muted text-muted-foreground',
              )}
            >
              {isPast ? <Check className="size-3.5" /> : idx + 1}
            </span>
            <span
              className={cn(
                'hidden text-xs sm:inline',
                isCurrent
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {title}
            </span>
            {idx < STEP_TITLES.length - 1 && (
              <span
                className="hidden h-px w-4 bg-border sm:inline-block"
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
