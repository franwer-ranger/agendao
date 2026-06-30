// Sugerencia de slug del salón a partir del nombre. Igual algoritmo que
// `slugify` de lib/{services,employees}/slug.ts, pero acotado a 40 chars
// (límite de salonSlugSchema) y sin fallback (devuelve '' si vacío para que
// la UI no muestre un slug ficticio).
export function suggestSalonSlug(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || ''
  )
}
