import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'

import { SignupForm } from './_components/signup-form'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const session = await auth()
  if (session?.user) redirect('/admin/today')

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <SignupForm />
    </main>
  )
}
