'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// useLayoutEffect no funciona en el servidor. Como este componente sí se
// renderiza en SSR (es 'use client' pero no islas puras), usamos useEffect
// ahí para evitar el warning, y el layout effect real solo en el navegador.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type RevealState = 'idle' | 'hidden' | 'visible'

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  /** Retraso en ms, para escalonar (stagger) varios <Reveal> hermanos. */
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // 'idle' es el estado sin JS / antes de hidratar: contenido siempre visible
  // (progressive enhancement). Solo pasamos a 'hidden' si el navegador
  // soporta animación y el usuario no pidió reduced motion.
  const [state, setState] = useState<RevealState>('idle')

  useIsomorphicLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    setState(prefersReducedMotion ? 'visible' : 'hidden')
  }, [])

  useEffect(() => {
    if (state !== 'hidden') return
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('visible')
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [state])

  return (
    <div
      ref={ref}
      className={cn(
        state === 'hidden' && 'opacity-0 translate-y-5',
        // .is-revealed dispara el keyframe compartido landing-fade-up
        // definido en landing.css (que ya respeta prefers-reduced-motion).
        state === 'visible' && 'is-revealed',
        className,
      )}
      style={state === 'visible' && delay ? { animationDelay: `${delay}ms` } : undefined}
      data-revealed={state === 'visible' ? 'true' : undefined}
    >
      {children}
    </div>
  )
}
