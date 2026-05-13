import { notFound } from 'next/navigation'
import { getSalonBySlug } from '@/lib/salons/queries'
import { Toaster } from '@/components/ui/sonner'

// Resolución del salón por slug. Servimos siempre dinámico: el slug viene de
// la URL pública y queremos un 404 inmediato si no existe (el cache de
// getSalonBySlug es per-request, no entre requests).
export const dynamic = 'force-dynamic'

export default async function SalonLayout({
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
    <>
      {children}
      <Toaster position="top-right" richColors />
    </>
  )
}
