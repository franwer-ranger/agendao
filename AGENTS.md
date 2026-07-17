<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Qué es esto

SaaS **multi-tenant** de reservas para peluquerías: una sola app y una sola base
Postgres para todas. `salon_id` es una **frontera de seguridad**, no una comodidad
de UI. Rumbo estratégico: `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`.
Orientación rápida: `MEMORY.md` (invariantes), `GUIA_PRODUCTO.md` (features +
roadmap), `Project_Map.md` (dónde vive el código).

## Comandos

`npm run dev` · `npm run lint` · `npm run build` (es el type gate) ·
`npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` ·
`npm run map:generate` (regenera `Project_Map.md`) ·
`tsx scripts/create-admin.ts <email> <pass> [slug]` (bootstrap de admin).

## Reglas duras

- **Sin tests automatizados. Política deliberada — no los añadas jamás** (ni
  ficheros de test, ni frameworks, ni pasos de CI). QA es manual.
- **Todo acceso a datos tenant-scoped pasa por `withTenant(salonId, fn)`**
  (`lib/db/tenant.ts`): fija el GUC `app.current_salon_id`. La **RLS es fail-closed**
  si el GUC no está puesto.
- **`salonId` siempre se deriva de la sesión**, nunca de input del cliente.
- **SQL = validez dura, TS = composición.** El no-solape/capacidad/RLS los impone
  Postgres; no dupliques esa validez como única barrera en TS.
- **Conversiones fecha+hora local → UTC solo con `madridLocalDateTimeToUtc`**
  (`lib/availability/time.ts`).

## Convenciones

- Español en comentarios y UI. `es-ES` / `Europe/Madrid` fijos.
- Las server actions devuelven `{ ok, message?, fieldErrors? }`.
- Commits: conventional commits en español.

## Documentación — mantenla viva

Un cambio no está terminado si deja un doc mintiendo. En el mismo cambio:

- **Estructura de código** (rutas, módulos, tablas): `npm run map:generate`.
  `Project_Map.md` es **autogenerado — no lo edites a mano**.
- **Features o roadmap**: actualiza `GUIA_PRODUCTO.md` (mueve el estado ✅/🟡/⛔).
- **Decisiones core / invariantes**: sobrescribe en `MEMORY.md` (no acumules versiones).
- **Setup u operación**: `README.md`.

No toques `docs/superpowers/**` (fuente de verdad del rumbo) ni `docs/archive/**`
(histórico).

## Deploy

Kamal construye desde un **clon de git**: los cambios sin commitear no se
despliegan. Commitea antes de `kamal deploy`.
