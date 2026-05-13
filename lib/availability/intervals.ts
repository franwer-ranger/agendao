import type { Interval } from './types'

// Operaciones puras sobre listas de Interval. Todos los intervalos son half-open [start, end).
// Las funciones devuelven listas normalizadas (ordenadas y sin solapes/adyacencias).

export function normalize(list: Interval[]): Interval[] {
  const valid = list.filter((i) => i.end.getTime() > i.start.getTime())
  if (valid.length === 0) return []
  const sorted = [...valid].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )
  const out: Interval[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1]
    const curr = sorted[i]
    if (curr.start.getTime() <= prev.end.getTime()) {
      if (curr.end.getTime() > prev.end.getTime()) prev.end = curr.end
    } else {
      out.push({ start: curr.start, end: curr.end })
    }
  }
  return out
}

// Resta de holes a base. Devuelve normalizado.
export function subtract(base: Interval[], holes: Interval[]): Interval[] {
  const b = normalize(base)
  const h = normalize(holes)
  if (h.length === 0) return b
  const out: Interval[] = []
  for (const seg of b) {
    let cursor = seg.start.getTime()
    const end = seg.end.getTime()
    for (const hole of h) {
      const hs = hole.start.getTime()
      const he = hole.end.getTime()
      if (he <= cursor) continue
      if (hs >= end) break
      if (hs > cursor) out.push({ start: new Date(cursor), end: new Date(hs) })
      cursor = Math.max(cursor, he)
      if (cursor >= end) break
    }
    if (cursor < end) out.push({ start: new Date(cursor), end: new Date(end) })
  }
  return out
}

// Intersección entre dos listas. Útil para "horario semanal ∩ working hours del salón".
export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const A = normalize(a)
  const B = normalize(b)
  const out: Interval[] = []
  let i = 0
  let j = 0
  while (i < A.length && j < B.length) {
    const s = Math.max(A[i].start.getTime(), B[j].start.getTime())
    const e = Math.min(A[i].end.getTime(), B[j].end.getTime())
    if (e > s) out.push({ start: new Date(s), end: new Date(e) })
    if (A[i].end.getTime() < B[j].end.getTime()) i++
    else j++
  }
  return out
}

// Trocea los intervalos en slots de longitud `durationMin` que empiezan en
// múltiplos de `granularityMin` desde el inicio de cada intervalo redondeado
// hacia arriba a la granularidad respecto a la medianoche UTC del día del slot.
//
// Decisión: el "anclaje" de la rejilla son los múltiplos de granularityMin
// contados desde el inicio del intervalo. Como los intervalos parten de horas
// locales válidas (09:00, 09:15...), esto produce slots alineados con la
// rejilla local del salón sin necesidad de razonar sobre TZ aquí.
export function chunkBySlot(
  intervals: Interval[],
  durationMin: number,
  granularityMin: number,
): Interval[] {
  const out: Interval[] = []
  const durMs = durationMin * 60_000
  const granMs = granularityMin * 60_000
  for (const seg of intervals) {
    let start = seg.start.getTime()
    const end = seg.end.getTime()
    while (start + durMs <= end) {
      out.push({ start: new Date(start), end: new Date(start + durMs) })
      start += granMs
    }
  }
  return out
}

// Parser de tstzrange devuelto por PostgREST. Acepta '["lower","upper")' o sin comillas.
// Ej: '["2026-05-10T00:00:00+02:00","2026-05-19T00:00:00+02:00")'
export function parseTstzRange(
  value: string,
): { starts_at: string; ends_at: string } | null {
  const m = value.match(/^[[(]\s*"?([^",]+)"?\s*,\s*"?([^",)]+)"?\s*[\])]$/)
  if (!m) return null
  const [, lower, upper] = m
  return {
    starts_at: new Date(lower).toISOString(),
    ends_at: new Date(upper).toISOString(),
  }
}

export function tstzRangeToInterval(value: string): Interval | null {
  const r = parseTstzRange(value)
  if (!r) return null
  return { start: new Date(r.starts_at), end: new Date(r.ends_at) }
}
