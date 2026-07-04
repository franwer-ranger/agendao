'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PillButton } from '@/components/landing/pill-button'
import { LOGIN_HREF, SIGNUP_HREF } from '@/components/landing/landing-data'

const NAV_LINKS = [
  { href: '#funciones', label: 'Funciones' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#precio', label: 'Precio' },
  { href: '#faq', label: 'FAQ' },
]

const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--mint)] rounded-sm'

export function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4">
      <nav
        className={cn(
          'flex w-full max-w-3xl items-center justify-between gap-4 rounded-full border border-[color:var(--line)] backdrop-blur-xl transition-[padding,background-color] duration-300 ease-out',
          isScrolled
            ? 'bg-[var(--ink)]/85 px-4 py-2 sm:px-5'
            : 'bg-[var(--ink)]/50 px-5 py-3 sm:px-6',
        )}
      >
        <Link
          href="/"
          className={cn(
            'shrink-0 font-[family-name:var(--font-display)] text-lg font-semibold lowercase tracking-tight text-white',
            FOCUS_RING,
          )}
        >
          agendao
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm text-white/70 transition-colors hover:text-white',
                FOCUS_RING,
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <PillButton
            href={LOGIN_HREF}
            variant="ghost-dark"
            size="md"
            className="hidden md:inline-flex"
          >
            Iniciar sesión
          </PillButton>
          <PillButton href={SIGNUP_HREF} variant="white" size="md">
            Empieza gratis
          </PillButton>
        </div>
      </nav>
    </header>
  )
}
