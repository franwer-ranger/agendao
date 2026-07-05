import { Container } from '@/components/landing/container'
import { ShowcaseScroller } from '@/components/landing/showcase-scroller'

export function Showcase() {
  return (
    <section className="band-dark relative overflow-clip py-24 md:py-32">
      <Container>
        <p className="text-xs font-medium tracking-wide text-white/40 uppercase">El panel</p>
        <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] font-semibold tracking-tight text-white">
          Esto es lo que ve tu equipo cada mañana
        </h2>

        <div className="mt-16">
          <ShowcaseScroller />
        </div>
      </Container>
    </section>
  )
}
