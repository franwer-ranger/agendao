import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// Set DATABASE_URL antes de importar nada que toque `lib/db` (que abre la
// conexión en import-time). UPLOADS_DIR también, aunque no subimos logo aquí.
const TMP = mkdtempSync(join(tmpdir(), 'agendao-setup-'))
const DB_PATH = join(TMP, 'test.db')
process.env.DATABASE_URL = DB_PATH
process.env.UPLOADS_DIR = join(TMP, 'uploads')

type PerformSetupMod = typeof import('@/lib/setup/perform-setup')
type SchemaMod = typeof import('@/lib/db/schema')
type DbMod = typeof import('@/lib/db')

let performSetup: PerformSetupMod['performSetup']
let db: DbMod['db']
let schema: SchemaMod

beforeAll(async () => {
  // Aplicar migraciones a la BD tmp ANTES de importar lib/db.
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('foreign_keys = ON')
  migrate(drizzle(sqlite), { migrationsFolder: './drizzle' })
  sqlite.close()

  // Ahora sí, los módulos que abren conexión cogerán la BD tmp.
  // Importamos perform-setup (no actions) para no arrastrar next-auth, que
  // peta bajo el resolver ESM estricto de Vitest.
  ;({ performSetup } = await import('@/lib/setup/perform-setup'))
  ;({ db } = await import('@/lib/db'))
  schema = await import('@/lib/db/schema')
})

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

const VALID_PAYLOAD = {
  admin: {
    email: 'dueno@salonprueba.es',
    password: 'supersecret',
    display_name: 'Dueño Prueba',
  },
  salon: {
    slug: 'salon-prueba',
    identity: {
      name: 'Salón de Prueba',
      address: 'Calle Falsa 123',
      phone: '+34 666 666 666',
      contact_email: 'hola@salonprueba.es',
    },
    workingHours: {
      days: [
        { weekday: 1, closed: false, opens_at: '09:00', closes_at: '19:00' },
        { weekday: 2, closed: false, opens_at: '09:00', closes_at: '19:00' },
        { weekday: 3, closed: false, opens_at: '09:00', closes_at: '19:00' },
        { weekday: 4, closed: false, opens_at: '09:00', closes_at: '19:00' },
        { weekday: 5, closed: false, opens_at: '09:00', closes_at: '19:00' },
        { weekday: 6, closed: false, opens_at: '09:00', closes_at: '14:00' },
        { weekday: 7, closed: true, opens_at: '', closes_at: '' },
      ],
    },
    cancellation: {
      cancellation_min_hours: 12,
      cancellation_policy_text: 'Cancelaciones con 12h de antelación.',
    },
    legal: { terms_text: 'Términos básicos.' },
  },
  services: [
    { name: 'Corte mujer', duration_minutes: 45, price_cents: 2500 },
    { name: 'Corte hombre', duration_minutes: 30, price_cents: 1800 },
  ],
  employees: [
    {
      display_name: 'Ana García',
      color_hex: '#ef4444',
      weeklySchedule: [
        { weekday: 1, starts_at: '09:00', ends_at: '17:00' },
        { weekday: 2, starts_at: '09:00', ends_at: '17:00' },
      ],
    },
    {
      display_name: 'Luis Pérez',
      color_hex: '#22c55e',
      weeklySchedule: [{ weekday: 3, starts_at: '10:00', ends_at: '19:00' }],
    },
  ],
  matrix: [
    { serviceIndex: 0, employeeIndex: 0 },
    { serviceIndex: 0, employeeIndex: 1 },
    { serviceIndex: 1, employeeIndex: 1 },
  ],
}

describe('performSetup (wizard inicial)', () => {
  test('crea salón, admin, servicios, empleados y matriz atómicamente', async () => {
    const result = await performSetup(VALID_PAYLOAD, null)
    expect(result.salonSlug).toBe('salon-prueba')
    expect(result.salonId).toBeGreaterThan(0)

    const salon = db
      .select()
      .from(schema.salons)
      .where(eq(schema.salons.slug, 'salon-prueba'))
      .get()
    expect(salon?.name).toBe('Salón de Prueba')
    expect(salon?.cancellation_min_hours).toBe(12)
    expect(salon?.cancellation_policy_text).toMatch(/12h/)
    expect(salon?.terms_text).toBe('Términos básicos.')

    const admin = db
      .select()
      .from(schema.app_users)
      .where(eq(schema.app_users.email, 'dueno@salonprueba.es'))
      .get()
    expect(admin?.role).toBe('admin')
    expect(admin?.salon_id).toBe(salon!.id)
    expect(admin?.password_hash).toMatch(/^\$argon2id\$/)
    expect(admin?.id).toBe(result.adminId)

    const hours = db
      .select()
      .from(schema.salon_working_hours)
      .where(eq(schema.salon_working_hours.salon_id, salon!.id))
      .all()
    expect(hours).toHaveLength(6)

    const svcs = db
      .select()
      .from(schema.services)
      .where(eq(schema.services.salon_id, salon!.id))
      .all()
    expect(svcs).toHaveLength(2)
    expect(svcs.map((s) => s.name).sort()).toEqual([
      'Corte hombre',
      'Corte mujer',
    ])
    expect(svcs.every((s) => /^[a-z0-9-]+$/.test(s.slug))).toBe(true)

    const emps = db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.salon_id, salon!.id))
      .all()
    expect(emps).toHaveLength(2)
    expect(emps.map((e) => e.display_name).sort()).toEqual([
      'Ana García',
      'Luis Pérez',
    ])

    const shifts = db.select().from(schema.employee_weekly_schedule).all()
    expect(shifts).toHaveLength(3) // 2 de Ana + 1 de Luis

    const links = db.select().from(schema.employee_services).all()
    expect(links).toHaveLength(3) // matrix tenía 3 pares
  })

  test('verifica que el slug del salón es resoluble por la query pública', async () => {
    const { getSalonBySlug } = await import('@/lib/salons/queries')
    const salon = await getSalonBySlug('salon-prueba')
    expect(salon).not.toBeNull()
    expect(salon?.slug).toBe('salon-prueba')
  })

  test('rechaza un segundo setup cuando ya hay una instancia configurada', async () => {
    await expect(performSetup(VALID_PAYLOAD, null)).rejects.toThrow(
      /ya está configurada/i,
    )
  })
})
