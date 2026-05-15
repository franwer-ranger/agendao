'use client'

import Link from 'next/link'
import * as React from 'react'
import { useSidebar } from '@/components/ui/sidebar'

// Wrapper de `<Link>` para los items de navegación del sidebar admin. En
// mobile el `Sheet` que aloja el sidebar no se cierra al hacer click en un
// enlace interno (porque la navegación de Next.js no es un cambio de DOM que
// el Sheet detecte), así que cerramos su estado a mano vía contexto.
type Props = React.ComponentProps<typeof Link>

export function SidebarNavLink({ onClick, ...props }: Props) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e)
        if (isMobile) setOpenMobile(false)
      }}
    />
  )
}
