import argon2 from 'argon2'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

import * as schema from '../lib/db/schema'

const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

function die(message: string, code = 1): never {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

async function main(): Promise<void> {
  const [emailRaw, password, slugArg] = process.argv.slice(2)
  if (!emailRaw || !password) {
    die(
      'Uso: tsx scripts/create-admin.ts <email> <password> [salon_slug]\n' +
        '   Si solo hay un salón en la DB, el slug es opcional.',
    )
  }

  const email = emailRaw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    die(`Email inválido: ${emailRaw}`, 2)
  }
  if (password.length < 8) {
    die('La contraseña debe tener al menos 8 caracteres.', 2)
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) die('DATABASE_URL no está definida.', 1)
  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })

  try {
    let salon: { id: number; slug: string } | undefined
    if (slugArg) {
      salon = (
        await db
          .select({ id: schema.salons.id, slug: schema.salons.slug })
          .from(schema.salons)
          .where(eq(schema.salons.slug, slugArg))
          .limit(1)
      )[0]
      if (!salon) die(`Salón "${slugArg}" no encontrado.`, 3)
    } else {
      const all = await db
        .select({ id: schema.salons.id, slug: schema.salons.slug })
        .from(schema.salons)
      if (all.length === 0) {
        die(
          'No hay salones en la DB. Ejecuta primero `npm run db:migrate && npm run db:seed`.',
          3,
        )
      }
      if (all.length > 1) {
        die(`Hay ${all.length} salones. Pasa el slug como tercer argumento.`, 3)
      }
      salon = all[0]
    }

    const exists = (
      await db
        .select({ id: schema.app_users.id })
        .from(schema.app_users)
        .where(eq(schema.app_users.email, email))
        .limit(1)
    )[0]
    if (exists) die(`Ya existe un usuario con email ${email}.`, 4)

    const hash = await argon2.hash(password, ARGON_OPTIONS)
    const id = randomUUID()

    // app_users INSERT está scoped por GUC bajo RLS (0003_rls.sql). Fijamos el
    // tenant del salón destino en la misma tx que el insert. Sin rol BYPASSRLS.
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_salon_id', ${String(salon!.id)}, true)`,
      )
      await tx.insert(schema.app_users).values({
        id,
        salon_id: salon!.id,
        role: 'admin',
        email,
        password_hash: hash,
        display_name: email.split('@')[0]!,
        is_active: true,
      })
    })

    process.stdout.write(
      `Admin creado:\n  id=${id}\n  email=${email}\n  salon=${salon!.slug}\n`,
    )
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  process.stderr.write(`Falló create-admin: ${err?.message ?? err}\n`)
  process.exit(99)
})
