# Project Map — Agendao

> **Archivo autogenerado.** No lo edites a mano: se regenera con `npm run map:generate`
> (script `scripts/generate-project-map.ts`). Es un mapa para que agentes de IA y
> personas nuevas se ubiquen rápido. Para el *qué/por qué* de producto, ver
> `GUIA_PRODUCTO.md`; para las decisiones core, `MEMORY.md` y el pivot en
> `docs/superpowers/specs/`.

_Generado: 2026-07-21 · commit `b34ead6` (2026-07-20) · 21 páginas, 5 handlers, 16 módulos lib, 19 tablas._

## Qué es

SaaS multi-tenant de reservas para peluquerías/salones (estilo Booksy). Enrutado por
salón vía path (`/[salonSlug]/book`). Locale `es-ES`, zona `Europe/Madrid`, sin i18n.

**Stack:** next 16.2.6 · react 19.2.4 · drizzle-orm ^0.45.2 · pg ^8.22.0 · next-auth ^5.0.0-beta.31 · resend ^6.12.3 · zod ^4.4.3 · tailwind-merge ^3.5.0 · shadcn ^4.7.0.

## Rutas (App Router)

### Landing / público

Landing comercial de Agendao (captación de peluquerías).

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/` | page | `app/(landing)/page.tsx` | layout |

### Reserva pública

Flujo del cliente final por salón: servicio → empleado → fecha/hora → datos → confirmación.

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/[salonSlug]/book` | page | `app/[salonSlug]/book/page.tsx` | layout, _actions (1), _components (9), _lib (2) |
| `/[salonSlug]/book/datetime` | page | `app/[salonSlug]/book/datetime/page.tsx` | — |
| `/[salonSlug]/book/details` | page | `app/[salonSlug]/book/details/page.tsx` | — |
| `/[salonSlug]/book/done/[publicId]` | page | `app/[salonSlug]/book/done/[publicId]/page.tsx` | — |
| `/[salonSlug]/book/employee` | page | `app/[salonSlug]/book/employee/page.tsx` | — |
| `/[salonSlug]/book/service` | page | `app/[salonSlug]/book/service/page.tsx` | — |

### Panel de administración

Dashboard del salón: hoy, calendario, empleados, servicios y ajustes. Aislado por tenant y rol.

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/admin/calendar` | page | `app/admin/calendar/page.tsx` | _actions (3), _components (9) |
| `/admin/employees` | page | `app/admin/employees/page.tsx` | _components (7) |
| `/admin/employees/[id]/edit` | page | `app/admin/employees/[id]/edit/page.tsx` | — |
| `/admin/employees/new` | page | `app/admin/employees/new/page.tsx` | — |
| `/admin/salon` | page | `app/admin/salon/page.tsx` | _components (7) |
| `/admin/services` | page | `app/admin/services/page.tsx` | _components (3) |
| `/admin/services/[id]/edit` | page | `app/admin/services/[id]/edit/page.tsx` | — |
| `/admin/services/new` | page | `app/admin/services/new/page.tsx` | — |
| `/admin/today` | page | `app/admin/today/page.tsx` | _components (5) |

### Onboarding (wizard)

Alta y configuración inicial del salón (multi-paso, borrador en localStorage).

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/setup` | page | `app/setup/page.tsx` | layout, _components (3), _lib (3), _steps (7) |

### Registro público

Alta self-serve del salón, creación del admin y arranque del trial.

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/signup` | page | `app/signup/page.tsx` | actions.ts, _components (1) |

### Autenticación

Login, recuperar y restablecer contraseña (Auth.js v5).

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/forgot-password` | page | `app/forgot-password/page.tsx` | actions.ts, _components (1) |
| `/login` | page | `app/login/page.tsx` | actions.ts, _components (1) |
| `/reset-password/[token]` | page | `app/reset-password/[token]/page.tsx` | actions.ts, _components (1) |

### API / route handlers

Endpoints: health, cron de recordatorios, callback de auth y servido de uploads.

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/api/auth/[...nextauth]` | handler | `app/api/auth/[...nextauth]/route.ts` | — |
| `/api/availability` | handler | `app/api/_dev/availability/route.ts` | — |
| `/api/cron/send-reminders` | handler | `app/api/cron/send-reminders/route.ts` | — |
| `/api/health` | handler | `app/api/health/route.ts` | — |

### Otros

Rutas sin área asignada.

| Ruta | Tipo | Archivo | Co-ubicado |
| --- | --- | --- | --- |
| `/uploads/[...path]` | handler | `app/uploads/[...path]/route.ts` | — |

## Lógica de negocio (`lib/`)

| Módulo | Descripción | Ficheros |
| --- | --- | --- |
| `lib/auth/` | Auth.js v5: config, acciones de login, sesiones en DB y reset de contraseña. | actions.ts, config.ts, index.ts, password-reset.ts, password.ts, sessions.ts, types.ts |
| `lib/availability/` | Motor de disponibilidad y creación de reservas. Núcleo crítico: combina horarios, ausencias, cierres y capacidad; resuelve concurrencia en una transacción. | booking.ts, engine.ts, errors.ts, group.ts, index.ts, intervals.ts, queries.ts, time.ts, types.ts |
| `lib/bookings/` | Consultas y acciones sobre reservas (hoy, calendario, cambios de estado, notas). | note-actions.ts, queries-calendar.ts, queries-today.ts, queries.ts, status-actions.ts, status.ts |
| `lib/clients/` | Consultas de clientes del salón. | queries.ts |
| `lib/db/` | Conexión Postgres (pool `pg` + Drizzle), schema y guard de tenant (`withTenant` + GUC de RLS). | index.ts, schema.ts, tenant.ts |
| `lib/email/` | Emails transaccionales (Resend + react-email): plantillas, triggers por evento y batch de recordatorios. | client.ts, format.ts, load-context.ts, notifications-log.ts, send-transactional.ts, send.ts, types.ts |
| `lib/employees/` | CRUD de empleados, editor de horario semanal y slugs. | actions.ts, queries.ts, schema.ts, slug.ts |
| `lib/format.ts` | Utilidad compartida. | — |
| `lib/salon.ts` | Utilidad compartida. | — |
| `lib/salons/` | Ajustes del salón, ciclo de vida y acceso tenant-safe, storage de logos y schemas de validación. | actions.ts, lifecycle.ts, queries.ts, schema.ts, slug.ts, storage.ts |
| `lib/services/` | CRUD de servicios y slugs. | actions.ts, queries.ts, schema.ts, slug.ts |
| `lib/setup/` | Wizard de onboarding: gating por-tenant (`onboarding_completed_at`) y provisión inicial. | actions.ts, is-configured.ts, perform-setup.ts, schema.ts, service-template.ts |
| `lib/signup/` | Registro público self-serve: validación, provisión del salón/admin y trial inicial. | provision.ts, schema.ts |
| `lib/storage.ts` | Utilidad compartida. | — |
| `lib/time.ts` | Utilidad compartida. | — |
| `lib/utils.ts` | Utilidad compartida. | — |

## Modelo de datos

Schema Drizzle en `lib/db/schema.ts`. Tablas:

`app_users` · `auth_password_reset_tokens` · `auth_sessions` · `booking_items` · `booking_notifications` · `booking_status_events` · `booking_tokens` · `bookings` · `clients` · `employee_recurring_breaks` · `employee_services` · `employee_time_off` · `employee_weekly_schedule` · `employees` · `salon_closures` · `salon_lifecycle` · `salon_working_hours` · `salons` · `services`

Migraciones en `drizzle/` (aplicar con `npm run db:migrate`): `0000_extensions.sql`, `0001_brainy_lionheart.sql`, `0002_hardening.sql`, `0003_rls.sql`, `0004_wakeful_spencer_smythe.sql`.

## Scripts

En `scripts/` (correr con `tsx` / vía npm):

- `scripts/create-admin.ts`
- `scripts/db-migrate.ts`
- `scripts/db-seed.ts`
- `scripts/generate-project-map.ts`
- `scripts/migrate-prod.mjs`

## Dónde seguir

- **Producto (features + roadmap):** `GUIA_PRODUCTO.md`
- **Decisiones core / memoria:** `MEMORY.md`
- **Rumbo actual (SaaS multi-tenant):** `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`
- **Planes de mejora priorizados:** `plans/README.md`
- **Reglas para agentes:** `AGENTS.md` (Next.js 16 con breaking changes)
