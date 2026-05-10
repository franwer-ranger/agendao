export function formatPriceEur(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function centsToEurInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
