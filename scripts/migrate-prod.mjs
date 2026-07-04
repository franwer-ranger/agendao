import { Client } from 'pg'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Réplica mínima del migrator drizzle-orm/node-postgres que solo depende de `pg`.
// Necesario porque Next standalone bundlea drizzle-orm dentro de server.js y no
// lo deja accesible como paquete en node_modules; `pg` sí queda traceado (lo
// importa lib/db). Mantiene el MISMO esquema de tracking que el migrator real
// (schema "drizzle", tabla "__drizzle_migrations", created_at = journal.when en
// ms) para no re-aplicar migraciones ya corridas por `npm run db:migrate`.

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida')
}

const migrationsDir = './drizzle'

const journal = JSON.parse(
  readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8'),
)

const client = new Client({ connectionString })
await client.connect()

try {
  await client.query('create schema if not exists "drizzle"')
  await client.query(
    `create table if not exists "drizzle"."__drizzle_migrations" (
       id serial primary key,
       hash text not null,
       created_at bigint
     )`,
  )

  const { rows } = await client.query(
    'select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1',
  )
  const lastMillis = rows[0] ? Number(rows[0].created_at) : -1

  let appliedCount = 0
  for (const entry of journal.entries) {
    if (entry.when <= lastMillis) continue

    const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')

    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    await client.query('begin')
    try {
      for (const stmt of statements) await client.query(stmt)
      await client.query(
        'insert into "drizzle"."__drizzle_migrations" (hash, created_at) values ($1, $2)',
        [hash, entry.when],
      )
      await client.query('commit')
    } catch (err) {
      await client.query('rollback')
      throw err
    }

    appliedCount++
    console.warn(`Applied migration: ${entry.tag}`)
  }

  console.warn(
    `Migrations done (${appliedCount} new, ${journal.entries.length} total)`,
  )
} finally {
  await client.end()
}
