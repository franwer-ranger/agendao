import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSalonBySlug } from '@/lib/salons/queries'
import { Stepper } from './_components/stepper'

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ salonSlug: string }>
}) {
  const { salonSlug } = await params
  const salon = await getSalonBySlug(salonSlug)
  if (!salon) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/${salonSlug}/book/service`}
            className="text-base font-semibold tracking-tight"
          >
            {salon.name}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4 md:pt-6">
        <Stepper salonSlug={salonSlug} />
        <div className="mt-5 md:mt-8">{children}</div>
      </main>
    </div>
  )
}
