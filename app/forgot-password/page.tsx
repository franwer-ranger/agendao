import { redirect } from 'next/navigation'

import { isInstanceConfigured } from '@/lib/setup/is-configured'

import { ForgotPasswordForm } from './_components/forgot-form'

export const dynamic = 'force-dynamic'

export default async function ForgotPasswordPage() {
  if (!(await isInstanceConfigured())) {
    redirect('/setup')
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Restablecer contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Te enviaremos un enlace por email para crear una nueva contraseña.
          </p>
        </header>
        <ForgotPasswordForm />
      </div>
    </main>
  )
}
