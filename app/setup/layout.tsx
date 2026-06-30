import { redirect } from 'next/navigation'

import { Toaster } from '@/components/ui/sonner'
import { isInstanceConfigured } from '@/lib/setup/is-configured'

export const dynamic = 'force-dynamic'

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (await isInstanceConfigured()) {
    redirect('/login')
  }

  return (
    <>
      <main className="min-h-svh bg-muted/20 px-4 py-10 sm:py-16">
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </>
  )
}
