import { Container } from '@/components/landing/container'
import { PillButton } from '@/components/landing/pill-button'
import { HeroAgenda } from '@/components/landing/hero-agenda'
import { SIGNUP_HREF, TRIAL_DAYS } from '@/components/landing/landing-data'
import './hero.css'

// Timings de la secuencia de entrada (eyebrow → H1 → subcopy → CTAs → agenda).
// Coordinados a mano con hero-fade-up en hero.css.
const INTRO_DELAYS_MS = {
  eyebrow: 0,
  headline: 90,
  subline: 220,
  subcopy: 340,
  ctas: 440,
  agenda: 300,
}

export function Hero() {
  return (
    <section className="band-dark overflow-clip pt-32 pb-20 md:pt-44 md:pb-28">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div>
            <p
              className="hero-intro-item mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/70"
              style={{ animationDelay: `${INTRO_DELAYS_MS.eyebrow}ms` }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--mint)]" />
              Reservas online para peluquerías y barberías
            </p>

            <h1 className="font-[family-name:var(--font-display)] tracking-[-0.03em]">
              <span
                className="hero-intro-item block text-balance text-[clamp(2.75rem,5.5vw,5.25rem)] leading-[0.98] font-semibold text-white"
                style={{ animationDelay: `${INTRO_DELAYS_MS.headline}ms` }}
              >
                Tu agenda
                <br />
                se llena sola.
              </span>
              <span
                className="hero-intro-item block text-[clamp(1.5rem,4.2vw,2.75rem)] leading-[1.1] font-medium text-[var(--ink-text-secondary)]"
                style={{ animationDelay: `${INTRO_DELAYS_MS.subline}ms` }}
              >
                Aunque tengas las manos en una melena.
              </span>
            </h1>

            <p
              className="hero-intro-item mt-6 max-w-lg text-base text-[var(--ink-text-secondary)] md:text-lg"
              style={{ animationDelay: `${INTRO_DELAYS_MS.subcopy}ms` }}
            >
              Tu propia página de reservas está abierta 24/7 y los recordatorios
              automáticos reducen los huecos de clientes que no vienen. Prueba
              gratis {TRIAL_DAYS} días, sin tarjeta.
            </p>

            <div
              className="hero-intro-item mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: `${INTRO_DELAYS_MS.ctas}ms` }}
            >
              <PillButton href={SIGNUP_HREF} variant="white" size="lg">
                Empieza gratis
              </PillButton>
              <PillButton href="#funciones" variant="ghost-dark" size="lg">
                Ver funciones
              </PillButton>
            </div>
          </div>

          <div
            className="hero-intro-item"
            style={{ animationDelay: `${INTRO_DELAYS_MS.agenda}ms` }}
          >
            <HeroAgenda />
          </div>
        </div>
      </Container>
    </section>
  )
}
