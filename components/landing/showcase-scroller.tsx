'use client'

import { useEffect, useRef, useState } from 'react'
import { ShowcaseMockup } from '@/components/landing/showcase-mockup'
import './showcase.css'

const HIGHLIGHTS = [
  {
    eyebrow: 'Agenda',
    title: 'El día de tu equipo, ordenado',
    description:
      'Cada empleado con su columna y cada hueco a la vista. Nada de agendas de papel ni de acordarse de memoria quién viene a las once.',
  },
  {
    eyebrow: 'Clientes',
    title: 'Cada cliente con su historial',
    description:
      'Qué se hizo la última vez, con quién y cuándo. La ficha está lista antes de que se siente en el sillón.',
  },
  {
    eyebrow: 'Horarios',
    title: 'Cambios de horario sin llamadas',
    description:
      'Si alguien libra o cambia el turno, lo actualizas tú y la agenda se ajusta sola. Nadie tiene que llamar a nadie.',
  },
]

export function ShowcaseScroller() {
  const [active, setActive] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const highlightRefs = useRef<Array<HTMLDivElement | null>>([])
  const mintGlowRef = useRef<HTMLDivElement>(null)
  const violetGlowRef = useRef<HTMLDivElement>(null)

  // Activa el highlight cuyo bloque cruza el centro del viewport.
  useEffect(() => {
    const nodes = highlightRefs.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = nodes.indexOf(entry.target as HTMLDivElement)
          if (index !== -1) setActive(index)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    nodes.forEach((node) => node && observer.observe(node))
    return () => observer.disconnect()
  }, [])

  // Parallax sutil de los glows de fondo, desactivado con reduced motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const section = sectionRef.current
    const mint = mintGlowRef.current
    const violet = violetGlowRef.current
    if (!section || !mint || !violet) return

    let ticking = false
    const update = () => {
      ticking = false
      const rect = section.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const centerOffset = rect.top + rect.height / 2 - vh / 2
      const progress = Math.max(-1, Math.min(1, centerOffset / (vh + rect.height / 2)))
      mint.style.transform = `translate3d(0, ${progress * -50}px, 0)`
      violet.style.transform = `translate3d(0, ${progress * 36}px, 0)`
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div ref={sectionRef} className="relative">
      <div ref={mintGlowRef} className="showcase-glow showcase-glow--mint" aria-hidden="true" />
      <div ref={violetGlowRef} className="showcase-glow showcase-glow--violet" aria-hidden="true" />

      <div className="showcase-grid">
        <div className="showcase-highlights">
          {HIGHLIGHTS.map((highlight, index) => (
            <div
              key={highlight.title}
              ref={(node) => {
                highlightRefs.current[index] = node
              }}
              className="showcase-highlight"
              data-active={index === active ? 'true' : undefined}
            >
              <p className="text-xs font-medium tracking-wide text-[color:var(--mint)] uppercase">
                {highlight.eyebrow}
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {highlight.title}
              </h3>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/60">
                {highlight.description}
              </p>
              <ShowcaseMockup
                active={index}
                variant="static"
                className="showcase-highlight-mockup"
              />
            </div>
          ))}
        </div>

        <div className="showcase-sticky-col">
          <ShowcaseMockup active={active} variant="sticky" />
        </div>
      </div>
    </div>
  )
}
