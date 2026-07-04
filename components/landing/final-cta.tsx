import { Container } from '@/components/landing/container'
import { PillButton } from '@/components/landing/pill-button'
import { Reveal } from '@/components/landing/reveal'
import { SIGNUP_HREF, TRIAL_DAYS } from '@/components/landing/landing-data'

export function FinalCta() {
  return (
    <section className="band-dark relative overflow-hidden py-24 md:py-32">
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(62,207,142,0.22),transparent_70%)] blur-3xl"
        aria-hidden="true"
      />
      <Container className="relative text-center">
        <Reveal className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.02] font-semibold tracking-tight text-white">
            ¿Llenamos tu agenda?
          </h2>
          <p className="mt-5 text-base text-white/64 md:text-lg">
            {TRIAL_DAYS} días gratis. Sin tarjeta. Cancela cuando quieras.
          </p>
          <PillButton href={SIGNUP_HREF} variant="white" size="lg" className="mt-8">
            Empieza gratis
          </PillButton>
        </Reveal>
      </Container>
    </section>
  )
}
