import { sql } from 'drizzle-orm'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../lib/db/schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL no está definida')
const pool = new Pool({ connectionString })
const db = drizzle(pool, { schema })

// El script usa su propio pool (no puede importar `@/lib/db`, que es
// `server-only`), así que replicamos `withTenant` sobre este `db`: bajo RLS
// todo INSERT/DELETE scoped necesita el GUC fijado en su misma tx.
type TxDb = Parameters<Parameters<typeof db.transaction>[0]>[0]
async function withTenant<T>(
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

const TZ = 'Europe/Madrid'

const SALON = {
  slug: 'estudio-aurora',
  name: 'Estudio Aurora',
  timezone: TZ,
  locale: 'es-ES',
  slot_granularity_minutes: 15,
  address: 'Calle de Fuencarral 78, 28004 Madrid',
  phone: '+34 91 555 12 34',
  contact_email: 'hola@estudioaurora.com',
  booking_min_hours_ahead: 2,
  booking_max_days_ahead: 60,
  cancellation_min_hours: 12,
  cancellation_policy_text:
    'Cancela con al menos 12 horas de antelación para no perder la reserva.',
  notify_salon_on_new_booking: true,
}

const WORKING_HOURS: Array<{
  weekday: number
  opens_at: string | null
  closes_at: string | null
}> = [
  { weekday: 1, opens_at: '09:00', closes_at: '20:00' },
  { weekday: 2, opens_at: '09:00', closes_at: '20:00' },
  { weekday: 3, opens_at: '09:00', closes_at: '20:00' },
  { weekday: 4, opens_at: '09:00', closes_at: '20:00' },
  { weekday: 5, opens_at: '09:00', closes_at: '20:00' },
  { weekday: 6, opens_at: '09:00', closes_at: '15:00' },
  { weekday: 7, opens_at: null, closes_at: null },
]

type ServiceSeed = {
  name: string
  slug: string
  duration_minutes: number
  price_cents: number
  color_hex: string
  description: string
}

const SERVICES: ServiceSeed[] = [
  {
    name: 'Corte de cabello',
    slug: 'corte-cabello',
    duration_minutes: 30,
    price_cents: 1800,
    color_hex: '#4F46E5',
    description: 'Corte clásico con acabado a secador.',
  },
  {
    name: 'Corte y peinado',
    slug: 'corte-peinado',
    duration_minutes: 45,
    price_cents: 2800,
    color_hex: '#0EA5E9',
    description: 'Lavado, corte y peinado completo.',
  },
  {
    name: 'Tinte completo',
    slug: 'tinte-completo',
    duration_minutes: 90,
    price_cents: 6500,
    color_hex: '#DB2777',
    description: 'Coloración completa con lavado y peinado.',
  },
  {
    name: 'Manicura',
    slug: 'manicura',
    duration_minutes: 45,
    price_cents: 2200,
    color_hex: '#10B981',
    description: 'Manicura con esmaltado tradicional.',
  },
]

type EmployeeSeed = {
  display_name: string
  slug: string
  color_hex: string
  bio: string
  display_order: number
  serviceIdx: number[]
  schedule: Array<{ weekday: number; starts_at: string; ends_at: string }>
  breaks: Array<{
    weekday: number
    starts_at: string
    ends_at: string
    label: string
  }>
  slots: number[]
}

const EMPLOYEES: EmployeeSeed[] = [
  {
    display_name: 'Marta Sánchez',
    slug: 'marta',
    color_hex: '#4F46E5',
    bio: 'Peluquera con 10 años de experiencia, especialista en color.',
    display_order: 0,
    serviceIdx: [0, 1, 2],
    schedule: [1, 2, 3, 4, 5].map((wd) => ({
      weekday: wd,
      starts_at: '09:00',
      ends_at: '17:00',
    })),
    breaks: [1, 2, 3, 4, 5].map((wd) => ({
      weekday: wd,
      starts_at: '13:00',
      ends_at: '14:00',
      label: 'Comida',
    })),
    slots: [10, 14, 16],
  },
  {
    display_name: 'Lucía Torres',
    slug: 'lucia',
    color_hex: '#DB2777',
    bio: 'Estilista y manicurista. Le encanta el color suave.',
    display_order: 1,
    serviceIdx: [0, 1, 3],
    schedule: [
      { weekday: 1, starts_at: '11:00', ends_at: '20:00' },
      { weekday: 3, starts_at: '11:00', ends_at: '20:00' },
      { weekday: 5, starts_at: '11:00', ends_at: '20:00' },
      { weekday: 6, starts_at: '09:00', ends_at: '15:00' },
    ],
    breaks: [],
    slots: [12, 16, 18],
  },
  {
    display_name: 'Diego Romero',
    slug: 'diego',
    color_hex: '#10B981',
    bio: 'Barbero clásico y especialista en cortes masculinos.',
    display_order: 2,
    serviceIdx: [0, 1, 2],
    schedule: [
      { weekday: 2, starts_at: '12:00', ends_at: '20:00' },
      { weekday: 4, starts_at: '12:00', ends_at: '20:00' },
      { weekday: 5, starts_at: '12:00', ends_at: '20:00' },
      { weekday: 6, starts_at: '10:00', ends_at: '15:00' },
    ],
    breaks: [],
    slots: [13, 15, 17],
  },
]

type ClientSeed = {
  display_name: string
  email: string | null
  phone: string | null
  marketing_consent: boolean
  internal_notes: string | null
}

const CLIENTS: ClientSeed[] = [
  {
    display_name: 'Sara López Ruiz',
    email: 'sara.lopez@example.com',
    phone: '+34 612 345 678',
    marketing_consent: true,
    internal_notes: 'Prefiere las mañanas. Alérgica a parabenos.',
  },
  {
    display_name: 'Pablo García Méndez',
    email: 'pablo.garcia@example.com',
    phone: '+34 622 456 789',
    marketing_consent: false,
    internal_notes: null,
  },
  {
    display_name: 'Elena Pérez Vidal',
    email: 'elena.perez@example.com',
    phone: '+34 633 567 890',
    marketing_consent: true,
    internal_notes: 'Cliente desde 2024.',
  },
  {
    display_name: 'Javier Ruiz Castro',
    email: 'javier.ruiz@example.com',
    phone: null,
    marketing_consent: false,
    internal_notes: null,
  },
  {
    display_name: 'María Fernández Soto',
    email: null,
    phone: '+34 644 678 901',
    marketing_consent: false,
    internal_notes: 'Solo confirma por WhatsApp.',
  },
  {
    display_name: 'Carlos Jiménez Ortiz',
    email: 'carlos.jimenez@example.com',
    phone: '+34 655 789 012',
    marketing_consent: true,
    internal_notes: null,
  },
]

function shiftYmd(yyyyMmDd: string, offset: number): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + offset))
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function isoWeekday(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 ? 7 : day
}

function toUtc(yyyyMmDd: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return fromZonedTime(`${yyyyMmDd}T${hh}:${mm}:00`, TZ)
}

async function clean(): Promise<void> {
  // Bajo RLS un DELETE sin GUC afecta 0 filas. Enumerar salones es SELECT
  // público (sin GUC); borramos cada salón dentro de su propio withTenant. La
  // fila de `salons` también se borra ahí (su policy DELETE exige `id = GUC`).
  const existing = await db.select({ id: schema.salons.id }).from(schema.salons)
  for (const { id: salonId } of existing) {
    await withTenant(salonId, async (tx) => {
      await tx.delete(schema.booking_notifications)
      await tx.delete(schema.booking_status_events)
      await tx.delete(schema.booking_tokens)
      await tx.delete(schema.booking_items)
      await tx.delete(schema.bookings)
      await tx.delete(schema.employee_services)
      await tx.delete(schema.employee_recurring_breaks)
      await tx.delete(schema.employee_weekly_schedule)
      await tx.delete(schema.employee_time_off)
      await tx.delete(schema.salon_closures)
      await tx.delete(schema.salon_working_hours)
      await tx.delete(schema.clients)
      await tx.delete(schema.employees)
      await tx.delete(schema.services)
      await tx.delete(schema.app_users)
      await tx.delete(schema.salons)
    })
  }
  // Postgres no necesita reset de secuencia tras el DELETE (a diferencia de
  // sqlite_sequence): las columnas IDENTITY siguen contando; los IDs no son
  // datos de negocio.
}

async function main(): Promise<void> {
  await clean()

  const todayMadrid = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
  const effectiveFrom = shiftYmd(todayMadrid, -60)
  const now = new Date()

  const [salon] = await db
    .insert(schema.salons)
    .values({ ...SALON, settings: {} })
    .returning()

  // salons INSERT es policy abierta (sin GUC). TODOS los hijos del salón están
  // scoped por RLS → se insertan dentro del withTenant de este salón.
  let clientCursor = 0
  let bookingsInserted = 0
  let skipped = 0

  await withTenant(salon.id, async (tx) => {
    await tx.insert(schema.salon_lifecycle).values({ salon_id: salon.id })

    await tx.insert(schema.salon_working_hours).values(
      WORKING_HOURS.map((wh) => ({
        salon_id: salon.id,
        ...wh,
      })),
    )

    const serviceRows = await tx
      .insert(schema.services)
      .values(
        SERVICES.map((s, idx) => ({
          salon_id: salon.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          duration_minutes: s.duration_minutes,
          price_cents: s.price_cents,
          color_hex: s.color_hex,
          is_active: true,
          display_order: idx,
        })),
      )
      .returning()

    const employeeIds: number[] = []
    for (const e of EMPLOYEES) {
      const [emp] = await tx
        .insert(schema.employees)
        .values({
          salon_id: salon.id,
          display_name: e.display_name,
          slug: e.slug,
          bio: e.bio,
          color_hex: e.color_hex,
          display_order: e.display_order,
          is_active: true,
        })
        .returning()
      employeeIds.push(emp.id)

      if (e.schedule.length) {
        await tx.insert(schema.employee_weekly_schedule).values(
          e.schedule.map((s) => ({
            employee_id: emp.id,
            weekday: s.weekday,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            effective_from: effectiveFrom,
          })),
        )
      }

      if (e.breaks.length) {
        await tx.insert(schema.employee_recurring_breaks).values(
          e.breaks.map((b) => ({
            employee_id: emp.id,
            weekday: b.weekday,
            starts_at: b.starts_at,
            ends_at: b.ends_at,
            label: b.label,
            effective_from: effectiveFrom,
          })),
        )
      }

      await tx.insert(schema.employee_services).values(
        e.serviceIdx.map((idx) => ({
          employee_id: emp.id,
          service_id: serviceRows[idx].id,
        })),
      )
    }

    const clientRows = await tx
      .insert(schema.clients)
      .values(
        CLIENTS.map((c) => ({
          salon_id: salon.id,
          display_name: c.display_name,
          email: c.email,
          phone: c.phone,
          marketing_consent: c.marketing_consent,
          internal_notes: c.internal_notes,
        })),
      )
      .returning()

    type Plan = { offset: number; count: number }
    const plan: Plan[] = [
      { offset: -1, count: 1 },
      { offset: 0, count: 4 },
      { offset: 1, count: 3 },
      { offset: 2, count: 2 },
      { offset: 3, count: 2 },
      { offset: 5, count: 1 },
      { offset: 7, count: 1 },
    ]

    for (const { offset, count } of plan) {
      const ymd = shiftYmd(todayMadrid, offset)
      const dow = isoWeekday(ymd)

      if (dow === 7) {
        skipped += count
        continue
      }

      const available = EMPLOYEES.map((emp, idx) => ({
        emp,
        idx,
        sched: emp.schedule.find((s) => s.weekday === dow),
      })).filter((x) => x.sched !== undefined)

      if (!available.length) {
        skipped += count
        continue
      }

      for (let i = 0; i < count; i++) {
        const slot = available[i % available.length]
        const empData = slot.emp
        const empId = employeeIds[slot.idx]
        const openHour = parseInt(slot.sched!.starts_at.slice(0, 2), 10)
        const closeHour = parseInt(slot.sched!.ends_at.slice(0, 2), 10)

        const svcIdx =
          empData.serviceIdx[(i + offset + 7) % empData.serviceIdx.length]
        const svc = SERVICES[svcIdx]
        const svcId = serviceRows[svcIdx].id

        const startIdx = i % empData.slots.length
        let hour: number | null = null
        for (let j = 0; j < empData.slots.length; j++) {
          const candidate = empData.slots[(startIdx + j) % empData.slots.length]
          const endHour = candidate + Math.ceil(svc.duration_minutes / 60)
          if (candidate >= openHour && endHour <= closeHour) {
            hour = candidate
            break
          }
        }
        if (hour === null) {
          skipped++
          continue
        }

        const startsAt = toUtc(ymd, hour, 0)
        const endsAt = new Date(
          startsAt.getTime() + svc.duration_minutes * 60_000,
        )

        let status: string
        if (offset < 0) {
          status = 'completed'
        } else if (offset > 0) {
          status = i === count - 1 && offset === 1 ? 'pending' : 'confirmed'
        } else if (endsAt.getTime() <= now.getTime()) {
          status = 'completed'
        } else if (startsAt.getTime() <= now.getTime()) {
          status = 'in_progress'
        } else {
          status = 'confirmed'
        }

        if (offset === 2 && i === 1) {
          status = 'cancelled_client'
        }

        const clientId = clientRows[clientCursor % clientRows.length].id
        clientCursor++

        const confirmedAt =
          status === 'completed' ||
          status === 'in_progress' ||
          status === 'confirmed'
            ? new Date(startsAt.getTime() - 60 * 60_000)
            : null
        const cancelledAt = status.startsWith('cancelled') ? new Date() : null
        const cancellationReason = status.startsWith('cancelled')
          ? 'El cliente no podrá asistir'
          : null

        const [booking] = await tx
          .insert(schema.bookings)
          .values({
            salon_id: salon.id,
            client_id: clientId,
            starts_at: startsAt,
            ends_at: endsAt,
            status,
            source: 'admin',
            version: 0,
            confirmed_at: confirmedAt,
            cancelled_at: cancelledAt,
            cancellation_reason: cancellationReason,
          })
          .returning()

        await tx.insert(schema.booking_items).values({
          booking_id: booking.id,
          salon_id: salon.id,
          position: 0,
          service_id: svcId,
          employee_id: empId,
          starts_at: startsAt,
          ends_at: endsAt,
          service_snapshot: {
            name: svc.name,
            slug: svc.slug,
            duration_minutes: svc.duration_minutes,
            price_cents: svc.price_cents,
            color_hex: svc.color_hex,
          },
          booking_status: status,
        })

        bookingsInserted++
      }
    }
  })

  process.stdout.write(
    [
      'Seed completado',
      `  Salón: ${SALON.name}`,
      `  Servicios: ${SERVICES.length}`,
      `  Empleados: ${EMPLOYEES.length}`,
      `  Clientes: ${CLIENTS.length}`,
      `  Bookings insertados: ${bookingsInserted}`,
      `  Bookings saltados (día no laborable / empleado libre): ${skipped}`,
      '',
    ].join('\n'),
  )
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    await pool.end()
    process.stderr.write(`Seed falló: ${err?.message ?? err}\n`)
    process.exit(1)
  })
