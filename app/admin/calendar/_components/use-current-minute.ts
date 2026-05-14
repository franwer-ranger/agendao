'use client'

import { useEffect, useState } from 'react'

// Re-renderiza el árbol cada minuto en punto, alineado al reloj real. Útil
// para que la "línea ahora" del calendario no se quede desfasada. Tras el
// primer tick alineado, sigue con un setInterval de 60s.
export function useCurrentMinute(): number {
  const [tick, setTick] = useState(() => Date.now())

  useEffect(() => {
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    let interval: ReturnType<typeof setInterval> | null = null

    const timeout = setTimeout(() => {
      setTick(Date.now())
      interval = setInterval(() => setTick(Date.now()), 60_000)
    }, msToNextMinute)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [])

  return tick
}
