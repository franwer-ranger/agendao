import { redirect } from 'next/navigation'

import { isInstanceConfigured } from '@/lib/setup/is-configured'

export const dynamic = 'force-dynamic'

export default async function Home() {
  if (!(await isInstanceConfigured())) {
    redirect('/setup')
  }
  redirect('/login')
}
