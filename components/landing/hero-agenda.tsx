'use client'

import { useEffect, useRef, useState } from 'react'
import { PhoneOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import './hero.css'

// Elemento firma del hero: una agenda semanal que se rellena sola.
// Los huecos vacíos (líneas discontinuas) se convierten en reservas reales
// una a una, en el orden de `order` (que simula la hora punta real: las
// reservas no llegan en orden de columna, llegan mezcladas a lo largo del
// día y de la semana). El teléfono, mientras tanto, no suena.

type Accent = 'mint' | 'violet' | 'amber'

type Booking = {
  name: string
  service: string
  accent: Accent
  /** Orden de llegada simulado (no es el orden visual de la rejilla). */
  order: number
}

type Slot = {
  time: string
  booking?: Booking
}

type Day = {
  label: string
  isToday?: boolean
  slots: Slot[]
}

const DAYS: Day[] = [
  {
    label: 'Lun',
    slots: [
      { time: '9:00' },
      { time: '10:30', booking: { name: 'Lucía', service: 'Corte y peinado', accent: 'mint', order: 2 } },
      { time: '12:00' },
      { time: '13:00', booking: { name: 'Marcos', service: 'Arreglo de barba', accent: 'violet', order: 7 } },
      { time: '16:30' },
    ],
  },
  {
    label: 'Mar',
    slots: [
      { time: '9:30', booking: { name: 'Nuria', service: 'Mechas', accent: 'amber', order: 1 } },
      { time: '11:00' },
      { time: '12:30', booking: { name: 'Diego', service: 'Corte y peinado', accent: 'mint', order: 5 } },
      { time: '17:00', booking: { name: 'Sofía', service: 'Color raíz', accent: 'violet', order: 11 } },
    ],
  },
  {
    label: 'Mié',
    isToday: true,
    slots: [
      { time: '9:00', booking: { name: 'Carmen', service: 'Balayage', accent: 'violet', order: 0 } },
      { time: '10:30' },
      { time: '12:00', booking: { name: 'Pablo', service: 'Arreglo de barba', accent: 'mint', order: 4 } },
      { time: '13:30', booking: { name: 'Elena', service: 'Corte y peinado', accent: 'amber', order: 9 } },
      { time: '17:30', booking: { name: 'Hugo', service: 'Mechas', accent: 'mint', order: 13 } },
    ],
  },
  {
    label: 'Jue',
    slots: [
      { time: '9:30' },
      { time: '11:00', booking: { name: 'Irene', service: 'Mechas', accent: 'mint', order: 3 } },
      { time: '12:30' },
      { time: '16:00', booking: { name: 'Raúl', service: 'Corte y peinado', accent: 'violet', order: 10 } },
    ],
  },
  {
    label: 'Vie',
    slots: [
      { time: '9:00', booking: { name: 'Alba', service: 'Color raíz', accent: 'amber', order: 6 } },
      { time: '10:30', booking: { name: 'Javier', service: 'Arreglo de barba', accent: 'mint', order: 8 } },
      { time: '12:00' },
      { time: '13:30', booking: { name: 'Marta', service: 'Balayage', accent: 'violet', order: 12 } },
      { time: '17:00' },
    ],
  },
]

const TOTAL_BOOKINGS = DAYS.reduce(
  (acc, day) => acc + day.slots.filter((slot) => slot.booking).length,
  0,
)

// Días que se ocultan en móvil para que la rejilla no se rompa por debajo
// de los 5 columnas (se quedan Lun / Mié (hoy) / Vie como muestra representativa).
const HIDE_ON_MOBILE = new Set(['Mar', 'Jue'])

const REVEAL_STEP_MS = 220

export function HeroAgenda() {
  // Estado por defecto (sin JS / antes de decidir sobre reduced motion):
  // la agenda ya llena, para progressive enhancement igual que <Reveal>.
  const [revealCount, setRevealCount] = useState(TOTAL_BOOKINGS)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (prefersReducedMotion) return

    // El reset a 0 se difiere a un callback (en vez de setState directo en
    // el cuerpo del efecto) para respetar react-hooks/set-state-in-effect.
    const resetId = setTimeout(() => setRevealCount(0), 0)
    let current = 0
    const interval = setInterval(() => {
      current += 1
      setRevealCount(current)
      if (current >= TOTAL_BOOKINGS) {
        clearInterval(interval)
      }
    }, REVEAL_STEP_MS)

    return () => {
      clearTimeout(resetId)
      clearInterval(interval)
    }
  }, [])

  const today = DAYS.find((day) => day.isToday)
  const todayRevealed = today
    ? today.slots.filter((slot) => slot.booking && slot.booking.order < revealCount).length
    : 0

  return (
    // Decorativa en su conjunto: el H1 y el subcopy ya cuentan la historia.
    // Se oculta a lectores de pantalla en lugar de leerles 14 nombres y
    // horas de muestra.
    <div className="relative" aria-hidden="true">
      <div className="hero-agenda-glow pointer-events-none absolute -inset-10 -z-10 rounded-full" />

      <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--ink-soft)] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              agendao.com/tu-salon
            </p>
            <p className="font-[family-name:var(--font-display)] text-sm font-medium text-white/90">
              Agenda de esta semana
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/60">
            <span className="hero-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mint)]" />
            <PhoneOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline">Teléfono en silencio</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
          {DAYS.map((day) => (
            <div
              key={day.label}
              className={cn(
                'flex flex-col gap-2',
                HIDE_ON_MOBILE.has(day.label) && 'hidden sm:flex',
              )}
            >
              <p
                className={cn(
                  'text-center text-[11px] uppercase tracking-wide',
                  day.isToday ? 'text-[var(--mint)]' : 'text-white/40',
                )}
              >
                {day.label}
                {day.isToday && <span className="ml-1 normal-case">· hoy</span>}
              </p>

              {day.slots.map((slot) => {
                const filled = slot.booking && slot.booking.order < revealCount
                return (
                  <div key={slot.time} className="min-h-[3.5rem]">
                    {filled && slot.booking ? (
                      <div
                        className={cn(
                          'hero-chip flex h-full flex-col justify-center rounded-[10px] border px-2 py-1.5 leading-tight',
                          `hero-chip-${slot.booking.accent}`,
                        )}
                      >
                        <p className="truncate text-[11px] font-medium">{slot.booking.name}</p>
                        <p className="truncate text-[10px] opacity-80">{slot.booking.service}</p>
                        <p className="text-[10px] opacity-60">{slot.time}</p>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[3.5rem] items-center justify-center rounded-[10px] border border-dashed border-[color:var(--line)] text-[10px] text-white/25">
                        {slot.time}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[color:var(--line)] pt-4">
          <p className="text-xs text-white/50">Reservas de hoy</p>
          <p
            key={todayRevealed}
            className="hero-chip font-[family-name:var(--font-display)] text-2xl font-semibold text-white"
          >
            {todayRevealed}
          </p>
        </div>
      </div>
    </div>
  )
}
