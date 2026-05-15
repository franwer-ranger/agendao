import { describe, expect, it } from 'vitest'
import {
  chunkBySlot,
  intersect,
  normalize,
  parseTstzRange,
  subtract,
  tstzRangeToInterval,
} from '../intervals'
import type { Interval } from '../types'

// Helper para escribir intervalos como ISO sin saturar el código de los tests.
const iv = (start: string, end: string): Interval => ({
  start: new Date(start),
  end: new Date(end),
})

const iso = (iv: Interval) => [iv.start.toISOString(), iv.end.toISOString()]

describe('normalize', () => {
  it('descarta intervalos con end <= start', () => {
    const out = normalize([
      iv('2026-05-22T09:00:00Z', '2026-05-22T09:00:00Z'), // vacío
      iv('2026-05-22T10:00:00Z', '2026-05-22T09:00:00Z'), // invertido
      iv('2026-05-22T11:00:00Z', '2026-05-22T12:00:00Z'),
    ])
    expect(out).toHaveLength(1)
    expect(iso(out[0])).toEqual([
      '2026-05-22T11:00:00.000Z',
      '2026-05-22T12:00:00.000Z',
    ])
  })

  it('fusiona intervalos solapados y adyacentes', () => {
    const out = normalize([
      iv('2026-05-22T09:00:00Z', '2026-05-22T10:00:00Z'),
      iv('2026-05-22T10:00:00Z', '2026-05-22T11:00:00Z'), // adyacente
      iv('2026-05-22T10:30:00Z', '2026-05-22T12:00:00Z'), // solapado
    ])
    expect(out).toHaveLength(1)
    expect(iso(out[0])).toEqual([
      '2026-05-22T09:00:00.000Z',
      '2026-05-22T12:00:00.000Z',
    ])
  })

  it('mantiene intervalos disjuntos ordenados por start', () => {
    const out = normalize([
      iv('2026-05-22T17:00:00Z', '2026-05-22T20:00:00Z'),
      iv('2026-05-22T09:00:00Z', '2026-05-22T14:00:00Z'),
    ])
    expect(out.map(iso)).toEqual([
      ['2026-05-22T09:00:00.000Z', '2026-05-22T14:00:00.000Z'],
      ['2026-05-22T17:00:00.000Z', '2026-05-22T20:00:00.000Z'],
    ])
  })
})

describe('subtract', () => {
  it('resta un hueco que parte el intervalo en dos', () => {
    const out = subtract(
      [iv('2026-05-22T09:00:00Z', '2026-05-22T18:00:00Z')],
      [iv('2026-05-22T13:00:00Z', '2026-05-22T14:00:00Z')],
    )
    expect(out.map(iso)).toEqual([
      ['2026-05-22T09:00:00.000Z', '2026-05-22T13:00:00.000Z'],
      ['2026-05-22T14:00:00.000Z', '2026-05-22T18:00:00.000Z'],
    ])
  })

  it('un hueco que cubre por completo elimina el intervalo', () => {
    const out = subtract(
      [iv('2026-05-22T10:00:00Z', '2026-05-22T11:00:00Z')],
      [iv('2026-05-22T09:00:00Z', '2026-05-22T12:00:00Z')],
    )
    expect(out).toEqual([])
  })

  it('un hueco adyacente (he == cursor) no recorta el inicio', () => {
    const out = subtract(
      [iv('2026-05-22T10:00:00Z', '2026-05-22T12:00:00Z')],
      [iv('2026-05-22T09:00:00Z', '2026-05-22T10:00:00Z')],
    )
    expect(out.map(iso)).toEqual([
      ['2026-05-22T10:00:00.000Z', '2026-05-22T12:00:00.000Z'],
    ])
  })

  it('sin huecos devuelve la base normalizada', () => {
    const out = subtract(
      [iv('2026-05-22T09:00:00Z', '2026-05-22T14:00:00Z')],
      [],
    )
    expect(out.map(iso)).toEqual([
      ['2026-05-22T09:00:00.000Z', '2026-05-22T14:00:00.000Z'],
    ])
  })
})

describe('intersect', () => {
  it('intersección no vacía toma min(end)/max(start)', () => {
    const out = intersect(
      [iv('2026-05-22T17:00:00Z', '2026-05-22T20:00:00Z')],
      [iv('2026-05-22T18:00:00Z', '2026-05-22T23:00:00Z')],
    )
    expect(out.map(iso)).toEqual([
      ['2026-05-22T18:00:00.000Z', '2026-05-22T20:00:00.000Z'],
    ])
  })

  it('intervalos disjuntos devuelven lista vacía', () => {
    const out = intersect(
      [iv('2026-05-22T09:00:00Z', '2026-05-22T10:00:00Z')],
      [iv('2026-05-22T11:00:00Z', '2026-05-22T12:00:00Z')],
    )
    expect(out).toEqual([])
  })

  it('intervalos que se tocan en el extremo (half-open) no intersectan', () => {
    // Regresión: el motor depende de que [09,10) ∩ [10,11) = ∅ para que
    // un slot adyacente al cierre no termine generándose en el "otro lado".
    const out = intersect(
      [iv('2026-05-22T09:00:00Z', '2026-05-22T10:00:00Z')],
      [iv('2026-05-22T10:00:00Z', '2026-05-22T11:00:00Z')],
    )
    expect(out).toEqual([])
  })
})

describe('chunkBySlot', () => {
  it('permite un slot que termina exactamente al cierre del intervalo', () => {
    // Caso clave del bug del viernes 19:00: el último slot que cabe debe
    // generarse aunque su `end` coincida con el `end` del intervalo base.
    const out = chunkBySlot(
      [iv('2026-05-22T17:00:00Z', '2026-05-22T20:00:00Z')],
      60, // duración 60min
      30, // granularidad 30min
    )
    expect(out.map(iso)).toEqual([
      ['2026-05-22T17:00:00.000Z', '2026-05-22T18:00:00.000Z'],
      ['2026-05-22T17:30:00.000Z', '2026-05-22T18:30:00.000Z'],
      ['2026-05-22T18:00:00.000Z', '2026-05-22T19:00:00.000Z'],
      ['2026-05-22T18:30:00.000Z', '2026-05-22T19:30:00.000Z'],
      ['2026-05-22T19:00:00.000Z', '2026-05-22T20:00:00.000Z'],
    ])
  })

  it('no genera slots si la duración no cabe', () => {
    const out = chunkBySlot(
      [iv('2026-05-22T17:00:00Z', '2026-05-22T17:30:00Z')],
      60,
      15,
    )
    expect(out).toEqual([])
  })

  it('respeta la granularidad para el step, no la duración', () => {
    const out = chunkBySlot(
      [iv('2026-05-22T17:00:00Z', '2026-05-22T18:00:00Z')],
      30, // duración 30min
      15, // step 15min
    )
    expect(out.map(iso)).toEqual([
      ['2026-05-22T17:00:00.000Z', '2026-05-22T17:30:00.000Z'],
      ['2026-05-22T17:15:00.000Z', '2026-05-22T17:45:00.000Z'],
      ['2026-05-22T17:30:00.000Z', '2026-05-22T18:00:00.000Z'],
    ])
  })

  it('trocea múltiples segmentos independientes', () => {
    const out = chunkBySlot(
      [
        iv('2026-05-22T09:00:00Z', '2026-05-22T10:00:00Z'),
        iv('2026-05-22T17:00:00Z', '2026-05-22T18:00:00Z'),
      ],
      30,
      30,
    )
    expect(out).toHaveLength(4)
    expect(iso(out[0])).toEqual([
      '2026-05-22T09:00:00.000Z',
      '2026-05-22T09:30:00.000Z',
    ])
    expect(iso(out[3])).toEqual([
      '2026-05-22T17:30:00.000Z',
      '2026-05-22T18:00:00.000Z',
    ])
  })
})

describe('parseTstzRange / tstzRangeToInterval', () => {
  it('parsea formato `["lower","upper")` con comillas', () => {
    const r = parseTstzRange(
      '["2026-05-10T00:00:00+02:00","2026-05-19T00:00:00+02:00")',
    )
    expect(r).not.toBeNull()
    expect(r!.starts_at).toBe('2026-05-09T22:00:00.000Z')
    expect(r!.ends_at).toBe('2026-05-18T22:00:00.000Z')
  })

  it('devuelve null para entrada inválida', () => {
    expect(parseTstzRange('not a range')).toBeNull()
  })

  it('tstzRangeToInterval devuelve Interval o null', () => {
    const i = tstzRangeToInterval(
      '["2026-05-22T17:00:00+02:00","2026-05-22T18:00:00+02:00")',
    )
    expect(i).not.toBeNull()
    expect(iso(i!)).toEqual([
      '2026-05-22T15:00:00.000Z',
      '2026-05-22T16:00:00.000Z',
    ])
  })
})
