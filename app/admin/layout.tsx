import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import { ThemeToggle } from '@/components/theme-toggle'
import { ClientIcon } from '@/components/ui/client-icon'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { auth } from '@/lib/auth'
import { getCurrentSalon } from '@/lib/salon'

import { SidebarNavLink } from './_components/sidebar-nav-link'
import { SignOutButton } from './_components/sign-out-button'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const [salon, cookieStore] = await Promise.all([getCurrentSalon(), cookies()])
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'
  const isAdmin = session.user.role === 'admin'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip={salon.name}>
                <SidebarNavLink href="/admin/today">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <ClientIcon name="scissors" className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">{salon.name}</span>
                    <span className="text-xs text-sidebar-foreground/60">
                      Panel admin
                    </span>
                  </div>
                </SidebarNavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Hoy">
                    <SidebarNavLink href="/admin/today">
                      <ClientIcon name="clock" className="size-4" />
                      <span>Hoy</span>
                    </SidebarNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Calendario">
                    <SidebarNavLink href="/admin/calendar">
                      <ClientIcon name="calendar" className="size-4" />
                      <span>Calendario</span>
                    </SidebarNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isAdmin ? (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Servicios">
                        <SidebarNavLink href="/admin/services">
                          <ClientIcon name="scissors" className="size-4" />
                          <span>Servicios</span>
                        </SidebarNavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Empleados">
                        <SidebarNavLink href="/admin/employees">
                          <ClientIcon name="users" className="size-4" />
                          <span>Empleados</span>
                        </SidebarNavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Salón">
                        <SidebarNavLink href="/admin/salon">
                          <ClientIcon name="store" className="size-4" />
                          <span>Salón</span>
                        </SidebarNavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={`${session.user.name ?? session.user.email} · ${session.user.role}`}
                className="cursor-default"
              >
                <ClientIcon name="users" className="size-4" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="truncate text-sm font-medium">
                    {session.user.name ?? session.user.email}
                  </span>
                  <span className="text-xs text-sidebar-foreground/60">
                    {session.user.role}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SignOutButton />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </SidebarInset>

      <Toaster position="top-right" richColors />
    </SidebarProvider>
  )
}
