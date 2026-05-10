import Link from 'next/link'
import { getCurrentSalon } from '@/lib/salon'
import { Toaster } from '@/components/ui/sonner'
import { ThemeToggle } from '@/components/theme-toggle'

// Admin dashboard is request-time only: it reads from a service-role-backed
// client and will gain cookie-based auth in Block 10. Skip the static
// prerender pass so missing env at build time doesn't break the build.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const salon = await getCurrentSalon()

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/admin/services" className="font-heading text-sm font-medium">
            {salon.name}
          </Link>
          <span className="text-xs text-muted-foreground">Panel admin</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="border-b md:w-56 md:border-r md:border-b-0">
          <ul className="flex gap-1 p-2 md:flex-col">
            <li>
              <Link
                href="/admin/services"
                className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                Servicios
              </Link>
            </li>
            <li className="text-sm text-muted-foreground px-3 py-2">
              Empleados <span className="text-xs">(próximamente)</span>
            </li>
            <li className="text-sm text-muted-foreground px-3 py-2">
              Salón <span className="text-xs">(próximamente)</span>
            </li>
          </ul>
        </nav>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  )
}
