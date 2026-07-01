import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function withTenant<T>(
  salonId: number,
  fn: (tx: TxDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_salon_id', ${String(salonId)}, true)`,
    )
    return fn(tx)
  })
}
