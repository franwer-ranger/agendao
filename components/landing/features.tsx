import type { ReactNode } from 'react'
import { Container } from '@/components/landing/container'
import { Reveal } from '@/components/landing/reveal'
import {
  BookingMockup,
  DayMockup,
  ReminderMockup,
  SiteMockup,
  TeamMockup,
} from '@/components/landing/feature-mockups'
import '@/components/landing/features.css'

type Feature = {
  area: 'reservas' | 'recordatorios' | 'pagina' | 'equipo' | 'dia'
  title: string
  copy: string
  mockup: ReactNode
}

// Orden = orden de lectura en móvil (una columna). En escritorio el bento
// grid (ver features.css) reordena visualmente por grid-area, no por DOM,
// así que este orden sigue siendo el orden accesible/semántico correcto.
const FEATURES: Feature[] = [
  {
    area: 'reservas',
    title: 'Reservas online 24/7',
    copy: 'Tus clientes reservan cuando les va bien, sin llamar. Tú ves la cita entrar sola en la agenda.',
    mockup: <BookingMockup />,
  },
  {
    area: 'recordatorios',
    title: 'Recordatorios que evitan plantones',
    copy: 'Un email automático 24 horas antes recuerda la cita. Menos huecos vacíos de última hora.',
    mockup: <ReminderMockup />,
  },
  {
    area: 'pagina',
    title: 'Tu página, tu enlace',
    copy: 'Cada salón tiene su propia web de reservas en agendao.com. La compartes y ya está.',
    mockup: <SiteMockup />,
  },
  {
    area: 'equipo',
    title: 'Equipo y horarios',
    copy: 'Cada profesional con sus servicios y su horario propio, sin líos de agenda compartida.',
    mockup: <TeamMockup />,
  },
  {
    area: 'dia',
    title: 'El día de un vistazo',
    copy: 'La agenda de hoy, clara desde que entras: quién viene, a qué hora y con qué servicio.',
    mockup: <DayMockup />,
  },
]

export function Features() {
  return (
    <section id="funciones" className="band-light py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-[var(--paper-text-secondary)]">
              Funciones
            </p>
            <h2
              className="mt-3 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Todo lo que tu salón necesita para llenar la agenda
            </h2>
            <p className="mt-4 text-base text-[var(--paper-text-secondary)] md:text-lg">
              Sin llamadas que atender ni cuadernos que rellenar: una sola herramienta para
              reservas, equipo y agenda.
            </p>
          </div>
        </Reveal>

        <div className="features-grid mt-12 md:mt-16">
          {FEATURES.map((feature, index) => (
            <Reveal
              key={feature.area}
              delay={index * 80}
              className={`features-card features-card--${feature.area}`}
            >
              <div>
                <h3
                  className="text-xl font-medium tracking-[-0.01em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--paper-text-secondary)]">{feature.copy}</p>
              </div>
              {feature.mockup}
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
