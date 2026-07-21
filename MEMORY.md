# MEMORIA — Agendao

> Memoria viva del producto: solo lo **core** y las **decisiones/invariantes** que
> condicionan todo lo demás. No es un catálogo de features ni un roadmap (eso vive
> en `GUIA_PRODUCTO.md`), ni un mapa del código (`Project_Map.md`), ni el registro
> del rumbo (`docs/superpowers/specs/2026-06-30-saas-pivot-design.md`). Si una
> decisión se replantea, se **sobrescribe** la línea — no se acumulan versiones.

---

## Qué es Agendao

SaaS **multi-tenant** de reservas para peluquerías. **Una sola aplicación y una
sola base de datos Postgres** sirven a todas las peluquerías (estilo Booksy), cada
una en su path (`/[salon]/book`). No es una instancia por cliente.

El público final son los **clientes de la peluquería**, que reservan desde el
navegador sin cuenta. El usuario operativo es el **equipo del salón** (dueño/
recepción + empleados), que paga la suscripción.

---

## Modelo de negocio

**Suscripción recurrente** (SaaS). La peluquería se da de alta, prueba gratis y
paga su plan. El detalle (planes, trial, billing con Stripe) está en el roadmap —
ver `GUIA_PRODUCTO.md` y el pivot doc. Aún no construido.

---

## Stack

| Pieza               | Elección                                                       |
| ------------------- | -------------------------------------------------------------- |
| Frontend / Backend  | Next.js 16 + TypeScript (App Router)                           |
| ORM                 | Drizzle                                                        |
| Base de datos       | **Postgres** (`pg`), gestionado (Neon en prod), compartido     |
| Aislamiento         | `salon_id` + RLS por tenant (GUC `app.current_salon_id`)       |
| Auth                | Auth.js v5 Credentials, JWT con `sid` validado vs `auth_sessions`, argon2 |
| Email               | Resend + react-email                                           |
| Storage de imágenes | Volumen local del VPS (`data/uploads/`)                        |
| Hosting             | App en VPS + Kamal 2 (un único despliegue) · Postgres en Neon  |
| Proxy / HTTPS       | kamal-proxy (Let's Encrypt automático)                         |
| DNS                 | Cloudflare                                                     |

Lo que **deliberadamente no entra** en v1: multi-idioma, app nativa, CDN externo,
Redis, colas dedicadas, SMS, pagos/depósitos online.

---

## Decisiones de producto que condicionan todo

- **Locale fijo:** `es-ES`, zona `Europe/Madrid`. Sin i18n en v1.
- **`salon_id` en toda entidad relevante**, y es una **frontera de seguridad** entre
  clientes que pagan, no una conveniencia de UI.
- **Confirmación automática de reservas** por defecto. `pendiente` para excepciones.
- **Sin pagos online ni depósitos** en v1. El no-show se gestiona manualmente.
- **Roles:** `admin` (acceso total) y `staff` (su agenda y poco más).
- **Registro público (signup)**: `/signup` crea el salón, el admin y el trial de 14
  días en una transacción y arranca sesión; el wizard posterior aún debe
  re-cablearse para no volver a provisionar el tenant. El enlace mágico de cliente
  sigue sin construirse.

---

## Decisiones de arquitectura que condicionan todo

- **El cálculo de disponibilidad es la lógica más crítica** (`lib/availability`):
  combina horario semanal + descansos + ausencias + cierres + horario del salón +
  duración + capacidad concurrente + servicios permitidos del empleado. Alto riesgo
  de regresión ante cualquier cambio.
- **SQL = validez dura, TS = composición.** Postgres impone el no-solape
  (`EXCLUDE USING gist` por empleado), la capacidad y las reglas duras; TypeScript
  compone y pre-valida. La concurrencia de reservas (validar + insertar) ocurre en
  **una sola transacción**.
- **Todo acceso tenant-scoped pasa por `withTenant(salonId, fn)`**
  (`lib/db/tenant.ts`): abre transacción y fija el GUC `app.current_salon_id`. La
  **RLS es fail-closed** si el GUC no está fijado. `salonId` siempre se deriva de la
  sesión, nunca del cliente.
- **Gating de onboarding por-tenant** vía `salons.onboarding_completed_at`
  (`lib/setup/is-configured.ts`), no un flag global.
- **Ciclo de vida por-tenant** en `salon_lifecycle`, protegido por RLS fail-closed:
  billing (`trialing | active | past_due | canceled`) y suspensión operativa son
  dimensiones separadas; la suspensión prevalece en la lectura efectiva sin
  destruir el estado de billing. El trial inicial dura 14 días y su fecha puede
  extenderse en el futuro desde superadmin.
- **`data/uploads/` es el único estado en disco** (volumen del host). Los datos de
  negocio viven en Postgres gestionado.

---

## Estado y roadmap

En `GUIA_PRODUCTO.md` (features + roadmap) y `plans/README.md` (cola técnica). En una
línea: la fundación multi-tenant (Postgres + RLS + gating de onboarding) y el
contrato persistente de ciclo de vida están hechos; lo siguiente es signup
público, billing/gating de acceso (Stripe) y superadmin.

---

## Riesgos vivos

- **Disponibilidad/concurrencia:** alto riesgo de regresión. **QA manual** (decisión
  explícita: sin tests automatizados). Verificar a mano cualquier cambio del motor.
- **Fuga cross-tenant:** mitigada con guard de app **y** RLS. Auditar que ningún
  call-site consulte "el único salón" en vez de filtrar por `salonId`.
- **Onboarding/signup roto:** `/signup` ya existe, pero `/setup` todavía conserva
  la provisión histórica de salón/admin y no está cerrado explícitamente para
  usuarios no autenticados.
- **Deriva de documentación:** mantener README/MEMORY/GUIA/AGENTS coherentes con el
  código (ver la regla de documentación en `AGENTS.md`).

---

## Cómo usar este documento

- **Cualquier desarrollo empieza leyendo esto y `AGENTS.md`.** Si algo aquí está
  desactualizado, se corrige antes de continuar.
- **Solo lo core.** Features/roadmap → `GUIA_PRODUCTO.md`. Dónde vive el código →
  `Project_Map.md`. Rumbo → pivot doc.
- **Si una decisión clave cambia, se sobrescribe** la línea. No se acumulan versiones.
- **Cada fase de desarrollo termina revisando** si algo de esta memoria cambió y
  dejándola coherente.
