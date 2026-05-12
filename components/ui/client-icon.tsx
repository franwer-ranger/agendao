'use client'

import { useEffect, useState } from 'react'
import { Scissors, Users, Store } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  scissors: Scissors,
  users: Users,
  store: Store,
}

interface ClientIconProps {
  name: string
  className?: string
}

export function ClientIcon({ name, className }: ClientIconProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const Icon = iconMap[name]
  if (!Icon) return null

  if (!mounted) {
    return <span className={className} aria-hidden="true" />
  }

  return <Icon className={className} />
}
