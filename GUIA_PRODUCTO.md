# Guía de Producto — Agendao

> Documento vivo de producto. Responde a dos preguntas: **qué features existen
> hoy** (catálogo) y **qué queda por hacer** (roadmap). Es la referencia
> compartida para producto, marketing y ventas.
>
> - Para **ubicar el código** de cada feature → `Project_Map.md` (autogenerado).
> - Para las **decisiones core** que condicionan todo → `MEMORY.md`.
> - Para el **rumbo estratégico** (giro a SaaS) → `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`.
> - Para la **cola técnica priorizada** → `plans/README.md`.
>
> ⚠️ **Nota de coherencia:** `MEMORY.md` y `README.md` describen todavía el modelo
> antiguo (SQLite, "una instancia por cliente"). El producto **ya pivotó a un SaaS
> multi-tenant sobre Postgres**; la fuente de verdad del rumbo es el pivot doc.
> Realinear esos ficheros está en la cola (`plans/011`).

---

## Qué es Agendao

SaaS de reservas online para peluquerías y salones (estilo Booksy). Cada salón
tiene su página pública de reservas (`/[salon]/book`) y un panel de gestión. Una
sola aplicación y una sola base de datos sirven a todas las peluquerías (modelo
multi-tenant). Locale `es-ES`, zona `Europe/Madrid`, sin multi-idioma en v1.

**Dos audiencias:**

- **La peluquería** (cliente de pago de Agendao): dueño/recepción + empleados.
  Usan el panel para gestionar su agenda.
- **El cliente final** (cliente de la peluquería): reserva desde el navegador,
  sin cuenta ni contraseña.

---

## Catálogo de features (lo que hay hoy)

Estado: ✅ hecho · 🟡 parcial · ⛔ no construido.

### 1. Reserva pública del cliente final ✅

Flujo por pasos, mobile-first, sin registro: **elegir servicio → elegir empleado
(o "cualquiera") → elegir fecha/hora → dejar datos → confirmación**. Guarda el
progreso en el navegador y reintenta de forma segura si el hueco se acaba de
ocupar (idempotencia). Cada reserva genera un identificador público.

### 2. Motor de disponibilidad ✅ *(núcleo del producto)*

Calcula los huecos reservables combinando: horario semanal de cada empleado,
descansos recurrentes, ausencias (vacaciones/baja), cierres del salón, horario de
apertura del salón, duración del servicio, capacidad concurrente y qué servicios
hace cada empleado. Es la pieza más crítica: de su exactitud depende que no se
generen reservas imposibles ni se pierdan huecos válidos.

### 3. Anti-doble-reserva (concurrencia) ✅

Si dos clientes intentan el mismo hueco a la vez, solo uno lo consigue. La base de
datos garantiza el no-solape por empleado y la capacidad por servicio de forma
atómica. Invisible para el usuario, imprescindible para la confianza.

### 4. Panel de administración del salón ✅

- **Hoy:** vista operativa del día. Tarjetas de reserva, mover, notas internas.
- **Calendario:** vista día/semana con **arrastrar para mover** reservas, marcador
  de "ahora", alta manual de reservas y bloqueos de agenda.
- **Empleados:** alta/edición, activar/desactivar, editor de horario semanal
  (turnos, copiar un día a otros) y qué servicios realiza cada uno.
- **Servicios:** alta/edición de servicios (duración, precio, color, capacidad).
- **Ajustes del salón:** identidad (nombre, logo, contacto), horarios de apertura,
  política de reservas (antelación mínima/máxima), política de cancelación, textos
  legales y cierres puntuales.

Acceso por rol: **admin** (acceso total) y **staff** (su agenda y poco más).

### 5. Configuración inicial (wizard de onboarding) 🟡

Asistente multi-paso para dejar un salón operativo: salón → empleados → servicios →
relación servicio-empleado → horarios. Guarda borrador en el navegador. **Estado
parcial:** hoy asume "primer arranque" y aún crea el usuario admin dentro del
wizard; con el signup público habrá que re-cablearlo (el admin ya existirá). Además
la ruta está **abierta sin autenticación**, algo a cerrar con el signup.

### 6. Notificaciones por email ✅

Emails transaccionales automáticos (diseño con marca): **confirmación de reserva,
recordatorio 24h antes, cancelación, reprogramación** para el cliente; **aviso de
nueva reserva** para el salón; **reset de contraseña** para el equipo. Envío
idempotente (nunca se duplica el mismo aviso). Recordatorios disparados por cron.

### 7. Cuentas y acceso del equipo ✅

Login por email + contraseña (hash seguro), sesiones revocables al instante,
recuperación de contraseña con enlace de un solo uso (caduca en 1h). Sin registro
público todavía: las cuentas las crea el admin o un script.

### 8. Aislamiento entre salones (multi-tenant) ✅

Cada salón solo ve y toca sus propios datos, con **doble barrera**: control en la
aplicación y en la base de datos (RLS). Una fuga de datos entre clientes no es
posible por un simple olvido de código. Es la frontera de seguridad que hace viable
cobrar a varios salones sobre una misma base.

### 9. Landing comercial ✅

Página pública de Agendao para captar peluquerías: propuesta de valor, cómo
funciona, features, pricing, FAQ y llamada a la acción a "prueba gratis". Los CTAs
ya apuntan a `/signup` (ruta aún por construir).

### 10. Enlaces de gestión para el cliente final ⛔

Poder cancelar/reprogramar desde un **enlace mágico** en el email, sin cuenta. La
base de datos ya lo contempla (`booking_tokens`) pero **no hay ruta ni pantalla**.
Diseñado en `plans/013`.

---

## Roadmap

El rumbo sigue el orden del pivot doc: **A → (B ∥ C) → D**, más una cola de fast-
follow y de calidad técnica.

### ✅ Hecho (base actual)

- Sub-proyecto **A — Fundación multi-tenant:** migración a Postgres, gating de
  onboarding por-tenant y aislamiento (guard de app + RLS).
- Motor de disponibilidad, reserva pública y anti-doble-reserva.
- Panel admin completo (hoy, calendario, empleados, servicios, ajustes).
- Auth (login, recuperación, sesiones revocables).
- Emails transaccionales + recordatorios.
- Wizard de onboarding (UI) y landing comercial.

### 🟡 Siguiente (v1 — lo que falta para lanzar y cobrar)

- **B — Signup público self-serve** (`/signup`): alta de peluquería (email +
  contraseña + nombre/slug del salón) en una transacción, login automático y
  redirección al wizard. Incluye **re-cablear el wizard** (quitarle el paso de
  crear admin) y **cerrar el `/setup` abierto**. Diseño previo en `plans/012`.
- **Ciclo de vida del tenant** (`salons.status`: `trialing / active / past_due /
  canceled / suspended`): columna que el signup escribe, el billing actualiza y el
  gating lee. Aún no existe. Diseño en `plans/012`.
- **C — Billing con Stripe (self-serve mínimo):** Checkout + Portal + trial +
  webhooks que actualizan el estado de suscripción. **Gating:** trial expirado o
  suscripción cancelada apaga el panel **y** la página pública de reservas (palanca
  de cobro). Precio provisional 24,90 €/mes, trial 14 días (`landing-data.ts`,
  pendiente de decisión de negocio). No construido.
- **D — Superadmin mínimo:** vista de salones (estado de suscripción, alta, nº de
  reservas) con acciones de suspender/reactivar. No construido.
- **Enlaces mágicos de cliente** (cancelar/reprogramar): cerrar el hueco de la
  feature 10. Diseño en `plans/013`.

### 🔭 Fast-follow (post-lanzamiento, NO v1)

- **Landing propia del salón** (`/[salon]`) además de la página de reservas.
- **Recordatorios por SMS / WhatsApp** (gran argumento anti no-show; hoy solo email).
- **Depósitos online** en la reserva (anti no-show con cobro).
- **Tiers de precio** (el esquema queda preparado para más de un plan).
- **Dominios propios** por salón · **impersonación** para soporte · **object
  storage** (R2/S3) para uploads en vez de disco local.

### 🧹 Cola técnica (calidad, en `plans/`)

Fixes P1 (rol admin server-side, idempotencia de emails, aritmética DST, consumo
atómico de tokens…), endurecimiento HTTP, higiene de toolchain y **realineación de
la documentación** (`README`/`MEMORY`/`AGENTS`) con el SaaS Postgres (`plans/011`).

### ⛔ Fuera de alcance (decisión deliberada)

Multi-idioma / i18n · app nativa · CDN externo, Redis o colas dedicadas. QA es
**manual**: no hay tests automáticos por política del maintainer.

---

## Cómo mantener este documento

- **Al cerrar una feature del roadmap**, muévela de 🟡/⛔ a ✅ y actualiza el estado
  del catálogo.
- **Producto altitude:** este doc habla de *qué hace* cada feature para el usuario.
  El *dónde vive* en el código va en `Project_Map.md` (regenéralo con
  `npm run map:generate`). Las *decisiones core* van en `MEMORY.md`.
- **Una sola verdad por tema:** si el rumbo cambia, se actualiza aquí y en el pivot
  doc; no se acumulan versiones.
