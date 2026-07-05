import { LandingNav } from '@/components/landing/nav'
import { Hero } from '@/components/landing/hero'
import { Stats } from '@/components/landing/stats'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Showcase } from '@/components/landing/showcase'
import { Pricing } from '@/components/landing/pricing'
import { Faq } from '@/components/landing/faq'
import { FinalCta } from '@/components/landing/final-cta'
import { LandingFooter } from '@/components/landing/footer'

// Landing comercial: 100% estática, sin DB ni auth. No importar lib/db ni auth aquí.
export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Showcase />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  )
}
