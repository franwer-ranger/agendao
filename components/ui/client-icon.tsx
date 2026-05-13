'use client'

import { useSyncExternalStore } from 'react'
import { Scissors, Users, Store, type LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  scissors: Scissors,
  users: Users,
  store: Store,
}

interface ClientIconProps {
  name: string
  className?: string
}

function getServerSnapshot() {
  return false
}
function getSnapshot() {
  return true
}
function subscribe() {
  return () => {}
}

export function ClientIcon({ name, className }: ClientIconProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const Icon = iconMap[name]
  if (!Icon) return null

  if (!mounted) {
    return <span className={className} aria-hidden="true" />
  }

  return <Icon className={className} />
}
