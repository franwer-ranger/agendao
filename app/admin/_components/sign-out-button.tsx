'use client'

import { useTransition } from 'react'

import { SidebarMenuButton } from '@/components/ui/sidebar'
import { ClientIcon } from '@/components/ui/client-icon'

import { signOutAction } from '../actions'

export function SignOutButton() {
  const [pending, start] = useTransition()

  return (
    <SidebarMenuButton
      tooltip="Cerrar sesión"
      disabled={pending}
      onClick={() => start(() => signOutAction())}
    >
      <ClientIcon name="log-out" className="size-4" />
      <span>{pending ? 'Saliendo…' : 'Cerrar sesión'}</span>
    </SidebarMenuButton>
  )
}
