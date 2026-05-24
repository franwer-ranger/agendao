import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const path = process.env.DATABASE_URL ?? '/app/data/dev.db'
mkdirSync(dirname(path), { recursive: true })

const sqlite = new Database(path)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

migrate(drizzle(sqlite), { migrationsFolder: './drizzle' })
sqlite.close()

console.log(`Migrations applied to ${path}`)
