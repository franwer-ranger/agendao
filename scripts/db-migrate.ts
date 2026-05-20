import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const url = process.env.DATABASE_URL ?? './data/dev.db'
mkdirSync(dirname(url), { recursive: true })

const sqlite = new Database(url)
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite)

migrate(db, { migrationsFolder: './drizzle' })
sqlite.close()
process.stdout.write(`Migrations applied to ${url}\n`)
