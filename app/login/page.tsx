import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'

import { LoginForm } from './_components/login-form'

export const dynamic = 'force-dynamic'

type SearchParams = { from?: string; reset?: string }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await auth()
  if (session?.user) {
    redirect('/admin/today')
  }

  const params = await searchParams
  const from =
    params.from && params.from.startsWith('/admin') ? params.from : undefined

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">
            Accede al panel de administración.
          </p>
        </header>
        <LoginForm from={from} resetSuccess={params.reset === '1'} />
      </div>
    </main>
  )
}
