import { describe, expect, it } from 'vitest'
import {
  isoWeekdayFromLocalDate,
  iterateLocalDates,
  madridLocalDateOf,
  madridLocalDateTimeToUtc,
} from '../time'

describe('madridLocalDateTimeToUtc', () => {
  it('convierte hora local de verano (CEST = UTC+2)', () => {
    // 22 mayo 2026, 19:00 Madrid → 17:00 UTC
    const d = madridLocalDateTimeToUtc('2026-05-22', '19:00')
    expect(d.toISOString()).toBe('2026-05-22T17:00:00.000Z')
  })

  it('convierte hora local de invierno (CET = UTC+1)', () => {
    // 22 enero 2026, 19:00 Madrid → 18:00 UTC
    const d = madridLocalDateTimeToUtc('2026-01-22', '19:00')
    expect(d.toISOString()).toBe('2026-01-22T18:00:00.000Z')
  })

  it('respeta la transición DST (último domingo de marzo 2026)', () => {
    // 29 marzo 2026: cambio a horario de verano. Antes 02:00 → tras saltar a 03:00.
    // 09:00 ese día ya es CEST (UTC+2).
    const d = madridLocalDateTimeToUtc('2026-03-29', '09:00')
    expect(d.toISOString()).toBe('2026-03-29T07:00:00.000Z')
  })
})

describe('isoWeekdayFromLocalDate', () => {
  it('viernes 22 mayo 2026 → 5', () => {
    expect(isoWeekdayFromLocalDate('2026-05-22')).toBe(5)
  })

  it('domingo → 7 (no 0)', () => {
    expect(isoWeekdayFromLocalDate('2026-05-24')).toBe(7)
  })

  it('lunes → 1', () => {
    expect(isoWeekdayFromLocalDate('2026-05-18')).toBe(1)
  })
})

describe('madridLocalDateOf', () => {
  it('devuelve la fecha local Madrid para un instante UTC', () => {
    // 2026-05-22T22:30:00Z = 23 mayo 00:30 Madrid (verano)
    expect(madridLocalDateOf(new Date('2026-05-22T22:30:00Z'))).toBe(
      '2026-05-23',
    )
  })

  it('una hora antes de medianoche local sigue siendo el día previo', () => {
    // 22 mayo 21:30 Madrid (verano) = 19:30 UTC
    expect(madridLocalDateOf(new Date('2026-05-22T19:30:00Z'))).toBe(
      '2026-05-22',
    )
  })
})

describe('iterateLocalDates', () => {
  it('rango de un solo día devuelve esa fecha', () => {
    expect(iterateLocalDates('2026-05-22', '2026-05-22')).toEqual([
      '2026-05-22',
    ])
  })

  it('itera días consecutivos inclusivos', () => {
    expect(iterateLocalDates('2026-05-20', '2026-05-22')).toEqual([
      '2026-05-20',
      '2026-05-21',
      '2026-05-22',
    ])
  })

  it('cruza un cambio de mes correctamente', () => {
    const days = iterateLocalDates('2026-05-30', '2026-06-02')
    expect(days).toEqual([
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
      '2026-06-02',
    ])
  })
})
