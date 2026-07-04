'use client'

import { useEffect, useRef, useState } from 'react'
import { Container } from '@/components/landing/container'

// Franja de cierre del hero: 3 cifras honestas de producto (no hay clientes
// reales todavía, así que nada de "X salones confían en..."). Cuentan hacia
// arriba al entrar en el viewport; con reduced motion se muestra directamente
// el valor final.

type Stat = {
  value: number
  prefix?: string
  suffix: string
  label: string
}

const STATS: Stat[] = [
  {
    value: 24,
    suffix: '/7',
    label: 'Tu salón acepta reservas, también fuera de horario',
  },
  {
    value: 67,
    prefix: '−',
    suffix: '%',
    label: 'Menos ausencias posibles gracias a los recordatorios',
  },
  {
    value: 5,
    suffix: ' min',
    label: 'Para configurar servicios, equipo y horarios',
  },
]

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (prefersReducedMotion) {
      // Diferido a un callback (en vez de setState directo en el cuerpo del
      // efecto) para respetar react-hooks/set-state-in-effect.
      const id = setTimeout(() => setValue(target), 0)
      return () => clearTimeout(id)
    }

    const durationMs = 1200
    const start = performance.now()

    let frame: number
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [active, target])

  return value
}

function StatItem({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  // Si el observer nunca dispara (o el elemento ya pasó por encima del
  // viewport antes de que se registrara, p. ej. tras un scroll muy rápido
  // o una restauración de scroll), este fallback pinta directamente el
  // valor final para que el usuario nunca vea "0/7".
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Si al montar el elemento ya quedó por encima del viewport (scroll
    // muy rápido, restauración de scroll del navegador, etc.), el
    // IntersectionObserver puede no llegar a disparar nunca: fijamos el
    // valor final directamente en vez de depender del count-up.
    const rect = node.getBoundingClientRect()
    if (rect.top < 0) {
      setSettled(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true)
          observer.disconnect()
        }
      },
      { threshold: 0, rootMargin: '0px 0px 15% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const value = useCountUp(stat.value, active)
  const displayValue = settled ? stat.value : value

  return (
    <div ref={ref} className="px-6 py-6 text-center md:py-2">
      <p className="font-[family-name:var(--font-display)] text-[clamp(2.5rem,6vw,4rem)] leading-none font-semibold tracking-[-0.03em] text-white tabular-nums">
        {stat.prefix}
        {displayValue}
        {stat.suffix}
      </p>
      <p className="mx-auto mt-3 max-w-[16rem] text-sm text-[var(--ink-text-secondary)]">
        {stat.label}
      </p>
    </div>
  )
}

export function Stats() {
  return (
    <section className="band-dark border-t border-[color:var(--line)] py-16 md:py-20">
      <Container>
        <div className="grid divide-y divide-[color:var(--line)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {STATS.map((stat) => (
            <StatItem key={stat.label} stat={stat} />
          ))}
        </div>
      </Container>
    </section>
  )
}
