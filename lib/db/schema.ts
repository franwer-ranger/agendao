import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// email case-insensitive (extensión citext, creada en Task 4)
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext'
  },
})

export const salons = pgTable(
  'salons',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    timezone: text().notNull().default('Europe/Madrid'),
    locale: text().notNull().default('es-ES'),
    slot_granularity_minutes: integer().notNull().default(15),
    settings: jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    address: text(),
    phone: text(),
    contact_email: text(),
    logo_path: text(),
    booking_min_hours_ahead: integer().notNull().default(2),
    booking_max_days_ahead: integer().notNull().default(60),
    cancellation_min_hours: integer().notNull().default(12),
    cancellation_policy_text: text(),
    terms_text: text(),
    notify_salon_on_new_booking: boolean().notNull().default(true),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    onboarding_completed_at: timestamp({ withTimezone: true, mode: 'date' }),
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

export const salon_lifecycle = pgTable(
  'salon_lifecycle',
  {
    salon_id: bigint({ mode: 'number' })
      .primaryKey()
      .references(() => salons.id, { onDelete: 'cascade' }),
    billing_status: text().notNull().default('trialing'),
    trial_ends_at: timestamp({ withTimezone: true, mode: 'date' }).default(
      sql`now() + interval '14 days'`,
    ),
    suspended_at: timestamp({ withTimezone: true, mode: 'date' }),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'salon_lifecycle_billing_status_check',
      sql`${t.billing_status} in ('trialing','active','past_due','canceled')`,
    ),
    check(
      'salon_lifecycle_trial_end_check',
      sql`${t.billing_status} <> 'trialing' or ${t.trial_ends_at} is not null`,
    ),
  ],
)

export const app_users = pgTable(
  'app_users',
  {
    id: text().primaryKey(),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    role: text().notNull(),
    email: citext().notNull(),
    password_hash: text().notNull(),
    display_name: text().notNull(),
    is_active: boolean().notNull().default(true),
    email_verified_at: timestamp({ withTimezone: true, mode: 'date' }),
    last_login_at: timestamp({ withTimezone: true, mode: 'date' }),
    welcome_seen_at: timestamp({ withTimezone: true, mode: 'date' }),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('app_users_role_check', sql`${t.role} in ('admin','staff')`),
    uniqueIndex('app_users_email_unique').on(t.email),
    index('app_users_salon_id_idx').on(t.salon_id),
  ],
)

export const auth_sessions = pgTable(
  'auth_sessions',
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => app_users.id, { onDelete: 'cascade' }),
    expires_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    user_agent: text(),
    ip: text(),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    last_used_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('auth_sessions_user_id_idx').on(t.user_id),
    index('auth_sessions_expires_at_idx').on(t.expires_at),
  ],
)

export const auth_password_reset_tokens = pgTable(
  'auth_password_reset_tokens',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    user_id: text()
      .notNull()
      .references(() => app_users.id, { onDelete: 'cascade' }),
    token_hash: text().notNull().unique(),
    expires_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    used_at: timestamp({ withTimezone: true, mode: 'date' }),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('auth_password_reset_user_id_idx').on(t.user_id)],
)

export const employees = pgTable(
  'employees',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    app_user_id: text().references(() => app_users.id, {
      onDelete: 'set null',
    }),
    display_name: text().notNull(),
    slug: text().notNull(),
    bio: text(),
    photo_path: text(),
    is_active: boolean().notNull().default(true),
    display_order: integer().notNull().default(0),
    color_hex: text(),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('employees_salon_slug_unique').on(t.salon_id, t.slug),
    index('employees_salon_id_idx').on(t.salon_id),
    index('employees_app_user_id_idx')
      .on(t.app_user_id)
      .where(sql`${t.app_user_id} is not null`),
    check(
      'employees_color_hex_format',
      sql`${t.color_hex} is null or ${t.color_hex} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
)

export const services = pgTable(
  'services',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    duration_minutes: integer().notNull(),
    price_cents: integer().notNull(),
    max_concurrent: integer(),
    color_hex: text(),
    is_active: boolean().notNull().default(true),
    display_order: integer().notNull().default(0),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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
      sql`${t.color_hex} is null or ${t.color_hex} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
)

export const employee_services = pgTable(
  'employee_services',
  {
    employee_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    service_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.employee_id, t.service_id] }),
    index('employee_services_service_id_idx').on(t.service_id),
  ],
)

export const clients = pgTable(
  'clients',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    email: citext(),
    phone: text(),
    display_name: text().notNull(),
    internal_notes: text(),
    marketing_consent: boolean().notNull().default(false),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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

export const employee_weekly_schedule = pgTable(
  'employee_weekly_schedule',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    employee_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    weekday: integer().notNull(),
    starts_at: text().notNull(),
    ends_at: text().notNull(),
    effective_from: text().notNull(),
    effective_until: text(),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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

export const employee_recurring_breaks = pgTable(
  'employee_recurring_breaks',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    employee_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    weekday: integer().notNull(),
    starts_at: text().notNull(),
    ends_at: text().notNull(),
    effective_from: text().notNull(),
    effective_until: text(),
    label: text(),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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

export const employee_time_off = pgTable(
  'employee_time_off',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    employee_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    starts_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ends_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    reason: text().notNull(),
    note: text(),
    created_by: text().references(() => app_users.id),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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

export const salon_closures = pgTable(
  'salon_closures',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    starts_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ends_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    label: text().notNull(),
    created_by: text().references(() => app_users.id),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('sc_ends_after_starts', sql`${t.ends_at} > ${t.starts_at}`),
    index('salon_closures_salon_id_idx').on(t.salon_id),
  ],
)

export const salon_working_hours = pgTable(
  'salon_working_hours',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    weekday: integer().notNull(),
    opens_at: text(),
    closes_at: text(),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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

export const bookings = pgTable(
  'bookings',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    public_id: text()
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    client_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    starts_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ends_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    status: text().notNull(),
    client_note: text(),
    internal_note: text(),
    source: text().notNull().default('web'),
    idempotency_key: text().unique(),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    confirmed_at: timestamp({ withTimezone: true, mode: 'date' }),
    cancelled_at: timestamp({ withTimezone: true, mode: 'date' }),
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

export const booking_items = pgTable(
  'booking_items',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    booking_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    position: integer().notNull(),
    service_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    employee_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    starts_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ends_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    service_snapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    booking_status: text().notNull(),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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

export const booking_status_events = pgTable(
  'booking_status_events',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    booking_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    from_status: text(),
    to_status: text().notNull(),
    actor_type: text().notNull(),
    actor_id: text(),
    reason: text(),
    at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'booking_status_events_actor_type_check',
      sql`${t.actor_type} in ('client','staff','system')`,
    ),
    index('booking_status_events_booking_id_idx').on(t.booking_id),
  ],
)

export const booking_tokens = pgTable(
  'booking_tokens',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    booking_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    token_hash: text().notNull().unique(),
    purpose: text().notNull().default('manage'),
    expires_at: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    used_at: timestamp({ withTimezone: true, mode: 'date' }),
    created_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('booking_tokens_purpose_check', sql`${t.purpose} in ('manage')`),
    index('booking_tokens_booking_id_idx').on(t.booking_id),
  ],
)

export const booking_notifications = pgTable(
  'booking_notifications',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    booking_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salon_id: bigint({ mode: 'number' })
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    version: integer().notNull().default(0),
    sent_at: timestamp({ withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
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
export type SalonLifecycle = typeof salon_lifecycle.$inferSelect
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
