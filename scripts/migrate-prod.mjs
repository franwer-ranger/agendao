import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Réplica mínima de drizzle-orm/better-sqlite3/migrator que solo depende
// de better-sqlite3. Necesario porque Next standalone bundlea drizzle-orm
// dentro de server.js y no lo deja accesible como paquete en node_modules.

const dbPath = process.env.DATABASE_URL ?? '/app/data/dev.db'
const migrationsDir = './drizzle'

mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash text NOT NULL,
    created_at numeric
  )
`)

const journal = JSON.parse(
  readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8'),
)

const applied = new Set(
  sqlite
    .prepare('SELECT hash FROM __drizzle_migrations')
    .all()
    .map((row) => row.hash),
)

const insertMigration = sqlite.prepare(
  'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
)

let appliedCount = 0
for (const entry of journal.entries) {
  const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8')
  const hash = createHash('sha256').update(sql).digest('hex')

  if (applied.has(hash)) continue

  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)

  const tx = sqlite.transaction(() => {
    for (const stmt of statements) sqlite.exec(stmt)
    insertMigration.run(hash, Date.now())
  })

  tx()
  appliedCount++
  console.warn(`Applied migration: ${entry.tag}`)
}

sqlite.close()
console.warn(
  `Migrations done (${appliedCount} new, ${journal.entries.length} total) at ${dbPath}`,
)
