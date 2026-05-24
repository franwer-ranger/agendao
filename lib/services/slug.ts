import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { services } from '@/lib/db/schema'

type TxLike = Pick<typeof db, 'select'>

export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'servicio'
  )
}

// Devuelve un slug único para el servicio dentro del salón. Si `excludeId` se
// pasa, ignora ese servicio (caso "renombrar y conservar slug propio").
// `txDb` permite reutilizar la transacción de Drizzle si la llamada está
// dentro de una. Sin transacción hay una ventana TOCTOU mínima; la UNIQUE
// de `services.salon_slug_unique` hará abortar el INSERT en ese improbable caso.
export function resolveUniqueServiceSlug(
  salonId: number,
  desired: string,
  excludeId?: number,
  txDb: TxLike = db,
): string {
  const base = slugify(desired)
  let candidate = base
  let n = 1

  while (true) {
    const where =
      excludeId === undefined
        ? and(eq(services.salon_id, salonId), eq(services.slug, candidate))
        : and(
            eq(services.salon_id, salonId),
            eq(services.slug, candidate),
            ne(services.id, excludeId),
          )
    const hit = txDb
      .select({ id: services.id })
      .from(services)
      .where(where)
      .limit(1)
      .get()
    if (!hit) return candidate

    n += 1
    candidate = `${base}-${n}`
  }
}
