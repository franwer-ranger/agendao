import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL no está definida')

const pool = new Pool({ connectionString })
const db = drizzle(pool)

await migrate(db, { migrationsFolder: './drizzle' })
await pool.end()
process.stdout.write('Migrations applied to Postgres\n')
