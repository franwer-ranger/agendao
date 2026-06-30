import 'server-only'

import { cache } from 'react'

import { db } from '@/lib/db'
import { salons } from '@/lib/db/schema'

// Cache a nivel de módulo (no per-request). Una vez que la instancia está
// configurada, lo está hasta el próximo reinicio del proceso (en el deploy).
// El estado "vacía → configurada" lo dispara `setupInstance`, que invalida
// explícitamente. Volver a "vacía" en runtime sin reinicio no es un escenario
// soportado (requeriría DROP del salon a mano por SSH).
let configuredCache: boolean | null = null

async function check(): Promise<boolean> {
  if (configuredCache === true) return true
  const row = db.select({ id: salons.id }).from(salons).limit(1).get()
  const result = row !== undefined
  if (result) configuredCache = true
  return result
}

// React.cache deduplica dentro de un mismo render RSC.
export const isInstanceConfigured = cache(check)

export function invalidateConfiguredCache(): void {
  configuredCache = null
}

// Solo para tests: vacía el cache incluso si era `true`.
export function __resetConfiguredCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') return
  configuredCache = null
}
