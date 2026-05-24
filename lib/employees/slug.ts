import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'

type TxLike = Pick<typeof db, 'select'>

export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'empleado'
  )
}

// Devuelve un slug único para el empleado dentro del salón. Si `excludeId` se
// pasa, ignora ese empleado (caso "renombrar y conservar slug propio").
// `txDb` permite reutilizar la transacción de Drizzle si la llamada está
// dentro de una. La UNIQUE de `employees_salon_slug_unique` aborta el INSERT
// si entre comprobación y persistencia se colara otro slug igual.
export function resolveUniqueEmployeeSlug(
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
        ? and(eq(employees.salon_id, salonId), eq(employees.slug, candidate))
        : and(
            eq(employees.salon_id, salonId),
            eq(employees.slug, candidate),
            ne(employees.id, excludeId),
          )
    const hit = txDb
      .select({ id: employees.id })
      .from(employees)
      .where(where)
      .limit(1)
      .get()
    if (!hit) return candidate

    n += 1
    candidate = `${base}-${n}`
  }
}
