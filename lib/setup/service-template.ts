export type ServiceTemplateEntry = {
  name: string
  duration_minutes: number
  price_cents: number
}

export const DEFAULT_SERVICE_TEMPLATE: readonly ServiceTemplateEntry[] = [
  { name: 'Corte caballero', duration_minutes: 30, price_cents: 1800 },
  { name: 'Corte señora', duration_minutes: 45, price_cents: 2500 },
  { name: 'Lavado y peinado', duration_minutes: 45, price_cents: 2200 },
  { name: 'Tinte completo', duration_minutes: 90, price_cents: 4500 },
  { name: 'Mechas', duration_minutes: 120, price_cents: 7000 },
  { name: 'Mascarilla capilar', duration_minutes: 30, price_cents: 1500 },
  { name: 'Arreglo de barba', duration_minutes: 20, price_cents: 1200 },
  { name: 'Corte niños', duration_minutes: 30, price_cents: 1500 },
] as const
