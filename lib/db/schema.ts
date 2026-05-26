import { sql } from 'drizzle-orm'
import {
  check,
  customType,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'text collate nocase'
  },
})

const NOW_MS = sql`(unixepoch() * 1000)`
const TODAY_DATE = sql`(date('now'))`

export const salons = sqliteTable(
  'salons',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    slug: text().notNull().unique(),
    name: text().notNull(),
    timezone: text().notNull().default('Europe/Madrid'),
    locale: text().notNull().default('es-ES'),
    slot_granularity_minutes: integer().notNull().default(15),
    settings: text({ mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    address: text(),
    phone: text(),
    contact_email: text(),
    logo_path: text(),
    booking_min_hours_ahead: integer().notNull().default(2),
    booking_max_days_ahead: integer().notNull().default(60),
    cancellation_min_hours: integer().notNull().default(12),
    cancellation_policy_text: text(),
    terms_text: text(),
    notify_salon_on_new_booking: integer({ mode: 'boolean' })
      .notNull()
      .default(true),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check(
      'salons_slot_granularity_range',
      sql`${t.slot_granularity_minutes} > 0 and ${t.slot_granularity_minutes} <= 120`,
    ),
    check(
      'salons_booking_min_hours_ahead_range',
      sql`${t.booking_min_hours_ahead} >= 0 and ${t.booking_min_hours_ahead} <= 168`,
    ),
    check(
      'salons_booking_max_days_ahead_range',
      sql`${t.booking_max_days_ahead} >= 1 and ${t.booking_max_days_ahead} <= 365`,
    ),
    check(
      'salons_cancellation_min_hours_range',
      sql`${t.cancellation_min_hours} >= 0 and ${t.cancellation_min_hours} <= 720`,
    ),
  ],
)

export const app_users = sqliteTable(
  'app_users',
  {
    id: text().primaryKey(),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    role: text().notNull(),
    email: citext().notNull(),
    password_hash: text().notNull(),
    display_name: text().notNull(),
    is_active: integer({ mode: 'boolean' }).notNull().default(true),
    email_verified_at: integer({ mode: 'timestamp_ms' }),
    last_login_at: integer({ mode: 'timestamp_ms' }),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('app_users_role_check', sql`${t.role} in ('admin','staff')`),
    uniqueIndex('app_users_email_unique').on(t.email),
    index('app_users_salon_id_idx').on(t.salon_id),
  ],
)

export const auth_sessions = sqliteTable(
  'auth_sessions',
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => app_users.id, { onDelete: 'cascade' }),
    expires_at: integer({ mode: 'timestamp_ms' }).notNull(),
    user_agent: text(),
    ip: text(),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
    last_used_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    index('auth_sessions_user_id_idx').on(t.user_id),
    index('auth_sessions_expires_at_idx').on(t.expires_at),
  ],
)

export const auth_password_reset_tokens = sqliteTable(
  'auth_password_reset_tokens',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    user_id: text()
      .notNull()
      .references(() => app_users.id, { onDelete: 'cascade' }),
    token_hash: text().notNull().unique(),
    expires_at: integer({ mode: 'timestamp_ms' }).notNull(),
    used_at: integer({ mode: 'timestamp_ms' }),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [index('auth_password_reset_user_id_idx').on(t.user_id)],
)

export const employees = sqliteTable(
  'employees',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    app_user_id: text().references(() => app_users.id, {
      onDelete: 'set null',
    }),
    display_name: text().notNull(),
    slug: text().notNull(),
    bio: text(),
    photo_path: text(),
    is_active: integer({ mode: 'boolean' }).notNull().default(true),
    display_order: integer().notNull().default(0),
    color_hex: text(),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    uniqueIndex('employees_salon_slug_unique').on(t.salon_id, t.slug),
    index('employees_salon_id_idx').on(t.salon_id),
    index('employees_app_user_id_idx')
      .on(t.app_user_id)
      .where(sql`${t.app_user_id} is not null`),
    check(
      'employees_color_hex_format',
      sql`${t.color_hex} is null or ${t.color_hex} glob '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'`,
    ),
  ],
)

export const services = sqliteTable(
  'services',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    duration_minutes: integer().notNull(),
    price_cents: integer().notNull(),
    max_concurrent: integer(),
    color_hex: text(),
    is_active: integer({ mode: 'boolean' }).notNull().default(true),
    display_order: integer().notNull().default(0),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    uniqueIndex('services_salon_slug_unique').on(t.salon_id, t.slug),
    index('services_salon_id_idx').on(t.salon_id),
    check(
      'services_duration_minutes_check',
      sql`${t.duration_minutes} > 0 and ${t.duration_minutes} % 5 = 0`,
    ),
    check('services_price_cents_check', sql`${t.price_cents} >= 0`),
    check(
      'services_max_concurrent_check',
      sql`${t.max_concurrent} is null or ${t.max_concurrent} > 0`,
    ),
    check(
      'services_color_hex_format',
      sql`${t.color_hex} is null or ${t.color_hex} glob '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'`,
    ),
  ],
)

export const employee_services = sqliteTable(
  'employee_services',
  {
    employee_id: integer()
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    service_id: integer()
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    primaryKey({ columns: [t.employee_id, t.service_id] }),
    index('employee_services_service_id_idx').on(t.service_id),
  ],
)

export const clients = sqliteTable(
  'clients',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    email: citext(),
    phone: text(),
    display_name: text().notNull(),
    internal_notes: text(),
    marketing_consent: integer({ mode: 'boolean' }).notNull().default(false),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check(
      'clients_email_or_phone_present',
      sql`${t.email} is not null or ${t.phone} is not null`,
    ),
    uniqueIndex('clients_salon_email_unique')
      .on(t.salon_id, t.email)
      .where(sql`${t.email} is not null`),
    uniqueIndex('clients_salon_phone_unique')
      .on(t.salon_id, t.phone)
      .where(sql`${t.phone} is not null`),
    index('clients_salon_id_idx').on(t.salon_id),
  ],
)

export const employee_weekly_schedule = sqliteTable(
  'employee_weekly_schedule',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    employee_id: integer()
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    weekday: integer().notNull(),
    starts_at: text().notNull(),
    ends_at: text().notNull(),
    effective_from: text().notNull().default(TODAY_DATE),
    effective_until: text(),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('ews_weekday_range', sql`${t.weekday} between 1 and 7`),
    check('ews_ends_after_starts', sql`${t.ends_at} > ${t.starts_at}`),
    check(
      'ews_effective_until_after_from',
      sql`${t.effective_until} is null or ${t.effective_until} >= ${t.effective_from}`,
    ),
    index('employee_weekly_schedule_employee_id_idx').on(t.employee_id),
    index('employee_weekly_schedule_lookup_idx').on(
      t.employee_id,
      t.weekday,
      t.effective_from,
      t.effective_until,
    ),
  ],
)

export const employee_recurring_breaks = sqliteTable(
  'employee_recurring_breaks',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    employee_id: integer()
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    weekday: integer().notNull(),
    starts_at: text().notNull(),
    ends_at: text().notNull(),
    effective_from: text().notNull().default(TODAY_DATE),
    effective_until: text(),
    label: text(),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('erb_weekday_range', sql`${t.weekday} between 1 and 7`),
    check('erb_ends_after_starts', sql`${t.ends_at} > ${t.starts_at}`),
    check(
      'erb_effective_until_after_from',
      sql`${t.effective_until} is null or ${t.effective_until} >= ${t.effective_from}`,
    ),
    index('employee_recurring_breaks_employee_id_idx').on(t.employee_id),
    index('employee_recurring_breaks_lookup_idx').on(
      t.employee_id,
      t.weekday,
      t.effective_from,
      t.effective_until,
    ),
  ],
)

export const employee_time_off = sqliteTable(
  'employee_time_off',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    employee_id: integer()
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    starts_at: integer({ mode: 'timestamp_ms' }).notNull(),
    ends_at: integer({ mode: 'timestamp_ms' }).notNull(),
    reason: text().notNull(),
    note: text(),
    created_by: text().references(() => app_users.id),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('eto_ends_after_starts', sql`${t.ends_at} > ${t.starts_at}`),
    check(
      'eto_reason_check',
      sql`${t.reason} in ('vacation','sick','personal','training','other')`,
    ),
    index('employee_time_off_employee_id_idx').on(t.employee_id),
  ],
)

export const salon_closures = sqliteTable(
  'salon_closures',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    starts_at: integer({ mode: 'timestamp_ms' }).notNull(),
    ends_at: integer({ mode: 'timestamp_ms' }).notNull(),
    label: text().notNull(),
    created_by: text().references(() => app_users.id),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('sc_ends_after_starts', sql`${t.ends_at} > ${t.starts_at}`),
    index('salon_closures_salon_id_idx').on(t.salon_id),
  ],
)

export const salon_working_hours = sqliteTable(
  'salon_working_hours',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    weekday: integer().notNull(),
    opens_at: text(),
    closes_at: text(),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('swh_weekday_range', sql`${t.weekday} between 1 and 7`),
    check(
      'swh_open_close_consistency',
      sql`(${t.opens_at} is null and ${t.closes_at} is null) or (${t.opens_at} is not null and ${t.closes_at} is not null and ${t.closes_at} > ${t.opens_at})`,
    ),
    uniqueIndex('salon_working_hours_salon_weekday_unique').on(
      t.salon_id,
      t.weekday,
    ),
    index('salon_working_hours_salon_idx').on(t.salon_id),
  ],
)

export const bookings = sqliteTable(
  'bookings',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    public_id: text()
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    client_id: integer()
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    starts_at: integer({ mode: 'timestamp_ms' }).notNull(),
    ends_at: integer({ mode: 'timestamp_ms' }).notNull(),
    status: text().notNull(),
    client_note: text(),
    internal_note: text(),
    source: text().notNull().default('web'),
    idempotency_key: text().unique(),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
    confirmed_at: integer({ mode: 'timestamp_ms' }),
    cancelled_at: integer({ mode: 'timestamp_ms' }),
    cancellation_reason: text(),
    version: integer().notNull().default(0),
  },
  (t) => [
    check('bookings_ends_after_starts', sql`${t.ends_at} > ${t.starts_at}`),
    check(
      'bookings_status_check',
      sql`${t.status} in ('pending','confirmed','in_progress','completed','cancelled_client','cancelled_salon','no_show')`,
    ),
    check(
      'bookings_source_check',
      sql`${t.source} in ('web','admin','phone','walk_in')`,
    ),
    index('bookings_salon_id_idx').on(t.salon_id),
    index('bookings_client_id_idx').on(t.client_id),
    index('bookings_salon_starts_idx').on(t.salon_id, t.starts_at),
  ],
)

export const booking_items = sqliteTable(
  'booking_items',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    booking_id: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    position: integer().notNull(),
    service_id: integer()
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    employee_id: integer()
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    starts_at: integer({ mode: 'timestamp_ms' }).notNull(),
    ends_at: integer({ mode: 'timestamp_ms' }).notNull(),
    service_snapshot: text({ mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull(),
    booking_status: text().notNull(),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('booking_items_position_nonneg', sql`${t.position} >= 0`),
    check(
      'booking_items_ends_after_starts',
      sql`${t.ends_at} > ${t.starts_at}`,
    ),
    uniqueIndex('booking_items_booking_position_unique').on(
      t.booking_id,
      t.position,
    ),
    index('booking_items_booking_id_idx').on(t.booking_id),
    index('booking_items_service_id_idx').on(t.service_id),
    index('booking_items_employee_id_idx').on(t.employee_id),
    index('booking_items_employee_starts_active_idx')
      .on(t.employee_id, t.starts_at)
      .where(sql`${t.booking_status} in ('pending','confirmed','in_progress')`),
    index('booking_items_service_starts_active_idx')
      .on(t.service_id, t.starts_at)
      .where(sql`${t.booking_status} in ('pending','confirmed','in_progress')`),
  ],
)

export const booking_status_events = sqliteTable(
  'booking_status_events',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    booking_id: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    from_status: text(),
    to_status: text().notNull(),
    actor_type: text().notNull(),
    actor_id: text(),
    reason: text(),
    at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check(
      'booking_status_events_actor_type_check',
      sql`${t.actor_type} in ('client','staff','system')`,
    ),
    index('booking_status_events_booking_id_idx').on(t.booking_id),
  ],
)

export const booking_tokens = sqliteTable(
  'booking_tokens',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    booking_id: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    token_hash: text().notNull().unique(),
    purpose: text().notNull().default('manage'),
    expires_at: integer({ mode: 'timestamp_ms' }).notNull(),
    used_at: integer({ mode: 'timestamp_ms' }),
    created_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
  },
  (t) => [
    check('booking_tokens_purpose_check', sql`${t.purpose} in ('manage')`),
    index('booking_tokens_booking_id_idx').on(t.booking_id),
  ],
)

export const booking_notifications = sqliteTable(
  'booking_notifications',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    booking_id: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salon_id: integer()
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    version: integer().notNull().default(0),
    sent_at: integer({ mode: 'timestamp_ms' }).notNull().default(NOW_MS),
    provider_message_id: text(),
  },
  (t) => [
    check(
      'booking_notifications_kind_check',
      sql`${t.kind} in ('booking_confirmation','booking_reminder','booking_cancellation','booking_reschedule','salon_new_booking')`,
    ),
    uniqueIndex('booking_notifications_booking_kind_version_unique').on(
      t.booking_id,
      t.kind,
      t.version,
    ),
    index('booking_notifications_salon_idx').on(t.salon_id),
    index('booking_notifications_booking_idx').on(t.booking_id),
  ],
)

export type Salon = typeof salons.$inferSelect
export type AppUser = typeof app_users.$inferSelect
export type Employee = typeof employees.$inferSelect
export type Service = typeof services.$inferSelect
export type EmployeeService = typeof employee_services.$inferSelect
export type Client = typeof clients.$inferSelect
export type EmployeeWeeklySchedule =
  typeof employee_weekly_schedule.$inferSelect
export type EmployeeRecurringBreak =
  typeof employee_recurring_breaks.$inferSelect
export type EmployeeTimeOff = typeof employee_time_off.$inferSelect
export type SalonClosure = typeof salon_closures.$inferSelect
export type SalonWorkingHours = typeof salon_working_hours.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type BookingItem = typeof booking_items.$inferSelect
export type BookingStatusEvent = typeof booking_status_events.$inferSelect
export type BookingToken = typeof booking_tokens.$inferSelect
export type BookingNotification = typeof booking_notifications.$inferSelect
export type AuthSession = typeof auth_sessions.$inferSelect
export type AuthPasswordResetToken =
  typeof auth_password_reset_tokens.$inferSelect
