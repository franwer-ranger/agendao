import { Check, Sparkles } from 'lucide-react'
import { Container } from '@/components/landing/container'
import { PillButton } from '@/components/landing/pill-button'
import { Reveal } from '@/components/landing/reveal'
import { PRICE_EUR_MONTH, SIGNUP_HREF, TRIAL_DAYS } from '@/components/landing/landing-data'

const INCLUDED = [
  'Reservas online ilimitadas',
  'Tu página de reservas en agendao.com/tu-salon',
  'Recordatorios automáticos por email',
  'Equipo y horarios sin límite',
  'Historial de clientes',
  'Soporte cuando lo necesites',
]

const priceFormatted = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(PRICE_EUR_MONTH)

export function Pricing() {
  return (
    <section id="precio" className="band-light py-24 md:py-32">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wide text-[color:var(--paper-text-secondary)] uppercase">
            Precio
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] font-semibold tracking-tight text-[var(--ink)]">
            Un plan. Todo dentro.
          </h2>
          <p className="mt-4 text-base text-[color:var(--paper-text-secondary)] md:text-lg">
            Sin niveles, sin letra pequeña por función. Pruébalo gratis y decide con calma.
          </p>
        </Reveal>

        <Reveal delay={100} className="mx-auto mt-14 max-w-md">
          <div className="relative rounded-[1.25rem] border border-[color:rgba(62,207,142,0.35)] bg-white p-8 shadow-[0_30px_70px_-30px_rgba(11,12,14,0.25)] sm:p-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(62,207,142,0.12)] px-3 py-1 text-sm font-medium text-[#1f8f5e]">
              <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
              {TRIAL_DAYS} días gratis
            </div>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-[var(--ink)]">
                {priceFormatted}
              </span>
              <span className="text-base text-[color:var(--paper-text-secondary)]">/mes</span>
            </div>
            <p className="mt-1.5 text-sm text-[color:var(--paper-text-secondary)]">
              Después de la prueba · IVA no incluido
            </p>

            <ul className="mt-8 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                  <Check
                    size={18}
                    strokeWidth={2.5}
                    className="mt-0.5 shrink-0 text-[color:var(--mint)]"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>

            <PillButton href={SIGNUP_HREF} variant="dark" size="lg" className="mt-8 w-full">
              Empieza gratis
            </PillButton>

            <p className="mt-4 text-center text-xs text-[color:var(--paper-text-secondary)]">
              Sin permanencia. Sin tarjeta para probar. Cancela cuando quieras.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
