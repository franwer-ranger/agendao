import { Container } from '@/components/landing/container'
import { PillButton } from '@/components/landing/pill-button'
import { Reveal } from '@/components/landing/reveal'
import { SIGNUP_HREF } from '@/components/landing/landing-data'

// Aquí SÍ es una secuencia real (cuenta → configuración → enlace), así que
// los números 1-2-3 están justificados, a diferencia del catálogo de arriba.
const STEPS = [
  {
    number: '01',
    title: 'Crea tu cuenta',
    copy: 'Prueba 14 días gratis. Sin tarjeta.',
  },
  {
    number: '02',
    title: 'Configura tu salón',
    copy: 'Servicios, equipo y horarios en unos minutos.',
  },
  {
    number: '03',
    title: 'Comparte tu enlace',
    copy: 'Tus clientes reservan solos; tú lo ves todo en el panel.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="band-light py-24 md:py-32"
      style={{ background: 'var(--mist)' }}
    >
      <Container>
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-[var(--paper-text-secondary)]">
              Cómo funciona
            </p>
            <h2
              className="mt-3 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              En marcha esta misma tarde
            </h2>
          </div>
        </Reveal>

        <ol className="relative mt-16 grid list-none grid-cols-1 gap-10 p-0 md:mt-20 md:grid-cols-3 md:gap-8">
          {/* Línea conectora sutil entre pasos, solo en escritorio: decorativa. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-8 right-0 left-0 hidden h-px md:block"
            style={{ background: 'var(--line)' }}
          />

          {STEPS.map((step, index) => (
            <li key={step.number} className="relative">
              <Reveal delay={index * 100} className="flex flex-col gap-4">
                <span
                  className="relative w-fit bg-[var(--mist)] pr-4 text-5xl font-medium tracking-[-0.03em] md:text-6xl"
                  style={{ fontFamily: 'var(--font-display)', color: 'rgba(11,12,14,0.18)' }}
                >
                  {step.number}
                </span>
                <h3
                  className="text-xl font-medium tracking-[-0.01em] md:text-2xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {step.title}
                </h3>
                <p className="text-[var(--paper-text-secondary)]">{step.copy}</p>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal delay={300} className="mt-16 flex flex-col items-center gap-3 text-center md:mt-20">
          <PillButton href={SIGNUP_HREF} variant="dark">
            Empieza gratis
          </PillButton>
          <span className="text-sm text-[var(--paper-text-secondary)]">
            14 días gratis, sin tarjeta.
          </span>
        </Reveal>
      </Container>
    </section>
  )
}
