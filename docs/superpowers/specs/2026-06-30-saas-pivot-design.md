# Diseño — Giro de Agendao a SaaS multi-tenant

> **Este documento es el nuevo punto de partida del producto.** Sustituye la tesis
> central de los roadmaps anteriores (`PLAN.md`, `PLAN_FINAL.md`,
> `PLAN_MIGRACION_VPS.md`, y partes de `MEMORY.md`): Agendao deja de ser "una
> instancia desplegada por cliente" y pasa a ser un **SaaS multi-tenant clásico**,
> estilo Booksy, con todas las peluquerías en una sola base de datos y un solo
> despliegue.
>
> Fecha: 2026-06-30. Estado: diseño aprobado en brainstorming, pendiente de spec
> detallado por sub-proyecto antes de implementar.

---

## 1. El giro

**Antes (modelo abandonado):** software vendido como pieza que se instala por
cliente. Pago único + onboarding facturado + hosting gestionado. Una peluquería =
una instancia = un droplet = una base SQLite = un recibo. La landing era la del
salón, para que el salón captara a *sus* clientes.

**Ahora (modelo nuevo):** SaaS multi-tenant. Una sola aplicación y una sola base
de datos sirven a todas las peluquerías. Cobro por suscripción recurrente. La
peluquería se da de alta sola, prueba gratis y paga su plan.

Lo que esto cambia, en una frase por eje:

- **Landing:** pasa a captar **peluquerías** (clientes de Agendao), no a captar
  clientes finales de cada peluquería.
- **Wizard:** el que se acaba de mergear pasa a ser el **onboarding** de cada
  peluquería recién registrada, no el "primer arranque de una instancia vacía".
- **Datos:** **una sola base de datos** con todas las peluquerías, ya no una por
  instancia.
- **Negocio:** suscripción recurrente con Stripe, en lugar de pago único +
  hosting.

---

## 2. Estado real heredado (qué ya sirve, qué hay que romper)

El código está **más cerca de un SaaS de lo que los documentos antiguos sugieren**.
La parte más cara y arriesgada — el modelo de datos y el aislamiento por tenant —
ya está hecha.

### Ya sirve tal cual

- **Modelo de datos ya multi-tenant.** Cada tabla relevante (`employees`,
  `services`, `clients`, `bookings`, `booking_items`, `salon_closures`,
  `salon_working_hours`, etc.) cuelga de `salon_id` con su índice. `salons.slug`
  es único global. No hay que rediseñar el esquema para soportar N salones.
- **Flujo de reserva pública ya por-salón y path-based:** `app/[salonSlug]/book/...`.
  Es exactamente el modelo Booksy (`dominio.com/tu-salon`).
- **Dashboard ya aislado por tenant:** `/admin/*` filtra por `session.user.salonId`,
  que viaja en el JWT (`token.salonId`) validado contra `auth_sessions`.
- **Auth ya soporta multi-cuenta:** login por email (único global), rol
  `admin`/`staff`, revocación instantánea borrando la fila de `auth_sessions`.

### Asume single-tenant — hay que romperlo

| Pieza | Hoy (single-tenant) | Debe pasar a |
|---|---|---|
| `isInstanceConfigured()` (`lib/setup/is-configured.ts`) | "¿existe **algún** salón? → configurada para siempre" (cachea `true` a nivel de módulo) | Gating **por-tenant**: cada salón se configura por separado; el alta es continua |
| Infra | 1 droplet + 1 SQLite + 1 Litestream por cliente | **1 despliegue compartido** + Postgres gestionado |
| Landing | La del salón (`/[slug]`) para sus clientes | **Nueva landing comercial de Agendao** en `/` para captar peluquerías |
| Registro | "Sin registro público; las cuentas las crea el admin" | **Signup público** que crea salón + admin + trial |
| Billing | No existe (era pago único + hosting) | **Suscripciones Stripe, planes, trial, gating por estado de pago** |
| Aislamiento | `salon_id` como conveniencia de UI | `salon_id` como **frontera de seguridad** entre clientes que pagan |

---

## 3. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Base de datos | **Postgres compartido y gestionado** (Neon/Supabase Postgres), todos los tenants en una base, filtrado por `salon_id` |
| Datos heredados | **Pre-lanzamiento**: recreación limpia del esquema en Postgres, sin migración de datos ni ventana de corte |
| Billing | **Stripe self-serve mínimo**: Checkout + Portal + trial + gating por webhooks. Fuera de v1: dunning elaborado, proration fina, multi-moneda |
| Planes | **Un solo plan de pago + free trial.** Esquema preparado (columna de plan/`price_id`) para añadir tiers después sin rehacer |
| Aislamiento | **App guard + Postgres RLS** (defensa en profundidad: la BD rechaza queries de otro tenant aunque la app tenga un bug) |
| Impago | Trial expirado / suscripción cancelada **apaga el dashboard Y la página pública de reservas** (`/[slug]/book`). Es la palanca de cobro |
| Uploads | **Volumen local del VPS en v1**, migración a object storage (R2/S3) como fast-follow |
| Hosting | **App en VPS + Kamal** (un único despliegue) + **Postgres gestionado en Neon** como punto de partida. Cambiar de proveedor después es barato (`pg_dump`/restore + cambiar `DATABASE_URL`), así que no es una decisión irreversible. Litestream desaparece |

---

## 4. Descomposición en sub-proyectos

El giro es demasiado grande para un solo spec. Se descompone en sub-proyectos
independientes; cada uno tendrá su propio ciclo spec → plan → implementación.

- **A · Fundación multi-tenant** *(base, primero)* — migración a Postgres, gating
  por-tenant, aislamiento con guard + RLS.
- **B · Landing comercial + signup + re-cableado del wizard** *(v1)*.
- **C · Billing & suscripciones (Stripe)** *(v1)*.
- **D · Superadmin mínimo** *(v1, mínimo viable)*.
- **E · Conversión** *(fast-follow, NO v1)* — SMS/WhatsApp, depósitos online.

**Orden:** `A → (B ∥ C) → D`. A es la base; B y C se pueden paralelizar; D al final.

---

## 5. Diseño por sub-proyecto

### A · Fundación multi-tenant (base)

**A.1 — Migración SQLite → Postgres (recreación limpia).** Es el grueso del trabajo:

- `sqliteTable` → `pgTable`. Mapeos de tipos:
  - `integer({ mode: 'timestamp_ms' })` → `timestamptz`.
  - `citext` (`text collate nocase`) → extensión `citext` **o** `text` + índice
    único sobre `lower(email)`.
  - `CHECK ... glob '...'` (color hex, etc.) → `CHECK ... ~ '...'` (regex Postgres).
  - `unixepoch() * 1000` por defecto → `now()`.
  - `integer().primaryKey({ autoIncrement: true })` → `generated always as identity`.
  - `text({ mode: 'json' })` → `jsonb`.
- `better-sqlite3` (**síncrono**) → `pg` / `postgres.js` (**async**). **Todas** las
  llamadas `.get()/.run()/.all()` pasan a `await`. Afecta al motor de
  disponibilidad (`lib/availability`), bookings, setup y auth. Es donde está el
  volumen de cambios.
- **Concurrencia de reservas (punto crítico de regresión).** Hoy se apoya en que
  SQLite WAL serializa escrituras dentro de una transacción ("validar
  disponibilidad + insertar en la misma transacción"). En Postgres hay que
  rediseñarlo: transacción `SERIALIZABLE` **o** `SELECT … FOR UPDATE` sobre las
  filas del slot, con **retry** en fallo de serialización. Cubrir con tests
  dedicados (es el de mayor riesgo según la memoria heredada).
- **Connection pooling**: pool de `pg` / PgBouncer.

**A.2 — Matar el "first-boot", pasar a gating por-tenant.**

- `isInstanceConfigured()` (global, cachea `true` a nivel de módulo para siempre)
  → `isSalonOnboarded(salonId)`. Nuevo campo `salons.onboarding_completed_at`.
- Eliminar el cache de módulo de `lib/setup/is-configured.ts` (correcto en
  single-tenant, **incorrecto** en multi-tenant).
- El middleware deja de preguntar "¿existe algún salón?" y pregunta "¿el salón de
  este usuario terminó su onboarding?". Si no, lo manda al wizard.

**A.3 — Aislamiento como frontera de seguridad (guard + RLS).**

- **App guard:** helper central `withTenant(salonId)` / repos que exigen `salonId`
  obligatorio. Ninguna query del dashboard puede ejecutarse sin filtro de tenant.
  Auditar cada call-site que hoy asume "el único salón".
- **Postgres RLS:** políticas por tabla que filtran por `salon_id`. La conexión /
  transacción fija el tenant actual (p. ej. `SET LOCAL app.current_salon = …`), y
  la BD rechaza cualquier acceso a filas de otro `salon_id`. Segunda barrera: una
  fuga cross-tenant deja de ser posible por un olvido en el código.

**A.4 — Estados de ciclo de vida del tenant.** `salons.status` o derivado de la
suscripción: `trialing | active | past_due | canceled | suspended`. Se solapa con C.

### B · Landing comercial + signup + re-cableado del wizard

- **`/` = landing comercial de Agendao** (captar peluquerías): propuesta de valor,
  pricing, features, CTA "Prueba gratis". La **landing del salón** (`/[slug]`, la
  antigua Fase C de `PLAN_FINAL.md`) **baja a fast-follow**: lo crítico es
  `/[slug]/book`, que ya existe.
- **`/signup`:** email + password + nombre del salón + slug autopropuesto
  (validado único global; ya hay `UNIQUE` en `salons.slug`). Al enviar, en una
  transacción: crea `app_users` (admin) + `salons` mínimo (`trialing`) +
  suscripción trial. Login automático. Redirige al **wizard**.
- **Re-cableado del wizard mergeado:** pasa de "configurar instancia vacía" a
  "onboarding del salón recién registrado". El admin y el salón ya existen (los
  crea el signup), así que el wizard **pierde el paso de crear admin** y solo
  rellena servicios / empleados / horarios / relaciones, y al terminar marca
  `onboarding_completed_at`. Reaprovecha ~90% de lo existente.

### C · Billing & suscripciones (Stripe, self-serve mínimo)

- **Modelo:** tabla `subscriptions` (1 por salón): `salon_id`,
  `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`
  (`trialing|active|past_due|canceled`), `trial_ends_at`, `current_period_end`.
- **Flujo:** signup → trial → Stripe Checkout antes/al expirar el trial →
  **webhooks** (`checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`) actualizan
  `subscriptions.status` → **Portal de Stripe** para gestionar tarjeta / cancelar.
  Webhooks **idempotentes** (ya existe el patrón `idempotency_key` en el esquema).
- **Gating:**
  - `trialing` / `active` → acceso pleno.
  - `past_due` → banner de aviso + periodo de gracia.
  - trial expirado / `canceled` → **se apaga el dashboard Y la página pública de
    reservas** `/[slug]/book` (página "temporalmente no disponible"). El admin aún
    puede entrar a pagar, pero no operar.

### D · Superadmin mínimo (operar el negocio)

- `/superadmin` protegido fuerte (rol nuevo en el `CHECK` de `app_users.role`, o
  allowlist por email). Vista de salones: estado de suscripción, fecha de alta, nº
  de reservas. Acciones: suspender / reactivar, ver detalle.
- **Impersonar** (entrar como admin de un salón para soporte): deseable pero a
  **v1.1** por la auditoría que requiere.

### E · Conversión (fast-follow, NO v1)

- Recordatorios por **SMS / WhatsApp** (anti no-show; hoy solo email). Gran
  argumento de venta.
- **Depósitos online** en la reserva (Stripe), anti no-show con cobro.
- Ambos estaban en el parking lot de `PLAN.md`. Se mantienen ahí hasta justo
  después de lanzar.

---

## 6. Infra / ops

- **Hosting:** app en **VPS + Kamal** (un único despliegue, ya dominado) +
  **Postgres gestionado en Neon** como punto de partida — para no operar tú la BD,
  que ahora contiene a **todos** los clientes. Se descarta Supabase: su valor
  (auth/storage/realtime) ya lo cubre la app, y su pricing de compute escala peor.
  **La elección de proveedor no es irreversible:** con Drizzle + driver `pg` y un
  `DATABASE_URL`, migrar a otro Postgres gestionado (DO Managed PG, etc.) o
  autogestionarlo en el VPS más adelante es `pg_dump`/restore + cambiar la
  variable. Se empieza en Neon y se reevalúa con tracción.
- **Pooling:** Neon trae pooler (PgBouncer) integrado; usar su connection string
  *pooled* cubre buena parte de la necesidad de pooling de A.1.
- **Litestream desaparece** (era replicación de SQLite). El backup/PITR lo da el
  Postgres gestionado.
- **Uploads:** volumen local del VPS en v1; migrar a **object storage (R2/S3)**
  como fast-follow (desacopla del disco, permite redeploy y escala horizontal sin
  perder ficheros).
- **Cron de recordatorios** (`/api/cron/send-reminders`): ahora itera sobre
  **todos** los salones — verificar que la query no asume uno solo.
- **Sentry / UptimeRobot:** siguen válidos, más simples (un solo despliegue).

---

## 7. Alcance v1

- **IN:** A (Postgres + tenancy + gating + signup) · B (landing comercial + signup
  + wizard re-cableado) · C (Stripe self-serve mínimo) · D (superadmin mínimo).
- **OUT (fast-follow):** landing del salón `/[slug]` · SMS/WhatsApp · depósitos
  online · tiers de precio · dominios propios · impersonación · object storage (si
  se arranca con volumen local).

---

## 8. Orden de construcción

```
A  →  (B ∥ C)  →  D
```

- **A primero**: es la base. Sin Postgres + gating por-tenant + aislamiento, nada
  de lo demás es seguro ni correcto.
- **B y C en paralelo**: el alta (signup + wizard) y el cobro (Stripe) son
  independientes entre sí una vez existe A.
- **D al final**: mínimo viable para poder operar y dar soporte.

---

## 9. Riesgos

- **Concurrencia de reservas en Postgres**: el rediseño del lock (de WAL implícito
  a `SERIALIZABLE`/`FOR UPDATE` + retry) es el punto de mayor riesgo de regresión.
  Tests dedicados antes de dar A por cerrado.
- **Fuga cross-tenant**: mitigada con guard en app **y** RLS. Auditar que ningún
  call-site heredado consulta "el único salón" en vez de filtrar por `salonId`.
- **Webhooks de Stripe**: desincronización entre el estado en Stripe y
  `subscriptions.status` si un webhook se pierde. Idempotencia + reconciliación
  periódica.
- **Gating que apaga reservas públicas**: un salón despistado puede perder
  reservas reales al expirar el trial. Avisar con antelación por email antes del
  corte.
- **Migración masiva de call-sites síncronos → async**: superficie amplia; alto
  riesgo de bugs sutiles si se hace a medias. Conviene hacerla de una vez por
  módulo, no entremezclada.

---

## 10. Impacto en documentación y memorias existentes

- `PLAN_MIGRACION_VPS.md` → **obsoleto** (su tesis "una instancia por cliente"
  muere). Archivar, no borrar.
- `MEMORY.md`, `PLAN.md`, `PLAN_FINAL.md` → reescribir las secciones de **modelo de
  negocio, infra y onboarding** para reflejar el SaaS. Este documento es la fuente
  de verdad del nuevo rumbo.
- Memorias automáticas: la implicación "una BD por instancia" desaparece. La
  memoria de auth (`JWT con sid + auth_sessions`) sigue válida. La separación
  "SQL = validez dura / TS = composición" vuelve a ser literal con Postgres.

---

## Próximo paso

Brainstorm + spec detallado del **sub-proyecto A (Fundación multi-tenant)**, que es
lo primero a construir, seguido de su plan de implementación.
