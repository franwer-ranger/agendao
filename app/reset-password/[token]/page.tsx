import Link from 'next/link'

import { validateResetToken } from '@/lib/auth/password-reset'

import { ResetPasswordForm } from './_components/reset-form'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const valid = await validateResetToken(token)

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Elige una contraseña nueva para tu cuenta.
          </p>
        </header>

        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-3">
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              El enlace ha expirado o ya se usó.
            </p>
            <Link
              href="/forgot-password"
              className="text-sm underline-offset-4 hover:underline"
            >
              Solicitar uno nuevo
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
