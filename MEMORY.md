# MEMORIA — Agendao

> Memoria viva del producto. Solo lo **core** y las **decisiones clave** que condicionan todo lo demás. Si algo no encaja aquí, va al PLAN. Si una decisión se replantea, se actualiza este documento — no se acumulan versiones.

---

## Qué es Agendao

App de reservas para peluquerías. Cada cliente (cada peluquería) tiene **su propia instancia desplegada**, con su dominio o subdominio, sus datos y su marca. No es un SaaS multi-tenant clásico: es una pieza de software que se instala por cliente.

El público final son los **clientes de la peluquería**, que reservan desde el navegador. El usuario operativo es el **equipo del salón** (dueño/recepción + empleados).

---

## Modelo de negocio

**Híbrido licencia + hosting gestionado.** El dueño de Agendao mantiene la cuenta de hosting (DigitalOcean) y opera N droplets, uno por cliente. Le factura al cliente "hosting + licencia" como un único cobro periódico (mensual o anual), con un margen pequeño que cubre la gestión.

- **Una instancia = un cliente.** Sin multi-tenant en la UI.
- **El cliente no toca infraestructura.** No ve la terminal, ni el panel de hosting, ni una variable de entorno.
- **Portabilidad como promesa:** los datos del cliente son suyos. SQLite + uploads se exportan en segundos. Si quiere irse, se va con su `.db` y sus ficheros.

Lo que **se renunció** al elegir este modelo (vs "tu cuenta, tu tarjeta"): la pureza ideológica de que el cliente sea dueño de su infraestructura desde el día uno. Lo que se gana: onboarding de 15 minutos en lugar de 1-3 horas, sin videollamada.

---

## Stack definitivo

| Pieza               | Elección                                                      |
| ------------------- | ------------------------------------------------------------- |
| Frontend / Backend  | Next.js 15 + TypeScript (App Router)                          |
| ORM                 | Drizzle                                                       |
| Base de datos       | SQLite (better-sqlite3, WAL mode)                             |
| Auth                | Auth.js v5 con adaptador Drizzle, sesiones en DB, argon2      |
| Email               | Resend + react-email                                          |
| Storage de imágenes | Sistema de ficheros del VPS, volumen Docker (`data/uploads/`) |
| Hosting             | DigitalOcean droplets (uno por cliente)                       |
| Despliegue          | Kamal 2                                                       |
| Proxy / HTTPS       | kamal-proxy (Let's Encrypt automático)                        |
| DNS                 | Cloudflare                                                    |
| Backups             | Litestream → Backblaze B2 o Cloudflare R2                     |
| Uptime              | UptimeRobot                                                   |
| Errores             | Sentry                                                        |

Lo que **deliberadamente no entra**: CDN externo, Redis, colas dedicadas, multi-idioma, app nativa, pagos online, SMS.

---

## Decisiones de producto que condicionan todo

- **Locale fijo:** `es-ES`, zona horaria `Europe/Madrid`. Sin i18n en v1.
- **Mono-salón en la UI, multi-salón en el modelo de datos.** Cada entidad relevante (empleado, servicio, reserva, cliente, horario) cuelga de un `salon_id`. La UI asume un único salón, pero la columna está ahí desde el día uno.
- **Confirmación automática de reservas** por defecto. `pendiente` queda reservado para excepciones.
- **Sin pagos online ni depósitos.** La política de no-show se gestiona manualmente.
- **Web responsive, mobile-first** en el flujo de reserva pública y en el panel "hoy". Tablet mínimo para el calendario.
- **Roles:** `admin` (dueño/recepción, acceso total) y `staff` (empleado, ve su agenda y poco más).
- **Sin registro público.** Las cuentas las crea el admin desde el dashboard. La app solo tiene `/login` y `/forgot-password`.
- **Enlace mágico para el cliente final** (cancelar/reprogramar): sin contraseñas, token único por reserva.

---

## Decisiones de arquitectura que condicionan todo

- **Cálculo de disponibilidad** es la lógica más crítica del sistema. Combina horario semanal + excepciones + duración del servicio + capacidad concurrente + servicios permitidos del empleado. Cualquier cambio aquí toca tests.
- **Concurrencia en reservas:** la validación de disponibilidad y la inserción ocurren en la **misma transacción** de SQLite (WAL serializa escrituras). Esto resuelve el "dos clientes intentando reservar el mismo hueco".
- **`data/` es el único directorio persistente.** Volumen Docker mapeado a `/var/lib/agendao/data` en el host. Contiene `prod.db`, `prod.db-wal`, `prod.db-shm` y `uploads/`.
- **Litestream no es opcional.** SQLite sin replicación continua es un fichero en un VPS, y eso no es producción. Es la pieza que convierte el stack en algo confiable.
- **Auth.js: sesiones en DB, no JWT.** Para poder revocar al instante si hace falta.
- **`session.user.salonId` filtra todas las queries del dashboard.** Es la frontera entre instancias y el "mono-salón en UI" desde la perspectiva del backend.

---

## Estado actual (mayo 2026)

- Bloques 1-9 del plan de producto: ✅ completos
- M1-M8 de la migración: ✅ completos
- Bloque 10 (auth): ✅ completo, sobre Auth.js v5 + Drizzle
- En prod: dominio activo, HTTPS, emails funcionando, SQLite + Drizzle

**Lo que queda:**

1. M9 — Backups con Litestream + monitorización (UptimeRobot + Sentry)
2. Wizard de configuración inicial dentro de la propia app (primer arranque de una instancia)
3. Bloque 11 — Landing pública
4. Bloque 12 — Pulido final

---

## El wizard de configuración inicial (decisión nueva)

Cuando se despliega una instancia para un cliente nuevo, la BD está **vacía**: ni salón, ni empleados, ni servicios, ni usuarios. La app **no estalla** en ese estado: detecta que es un primer arranque y arranca el **wizard de configuración inicial** dentro de la propia app.

- El primer visitante de una instancia vacía es **el admin**, no un cliente final.
- El wizard crea, en orden: usuario admin → salón → empleados → servicios → relaciones servicio↔empleado → horarios → política de cancelación.
- Al terminar, el admin queda con sesión iniciada y aterriza en el dashboard. La pantalla por defecto le muestra la **URL pública de reservas** (`https://[dominio]/[slug-del-salon]/book`) para que la comparta con sus clientes.
- **Importante:** este wizard **no es una herramienta interna separada** (como se planteó en una versión anterior del onboarding). Vive **dentro de la app del cliente**. El admin lo recorre desde su navegador, sin intervención técnica.
- El wizard solo es accesible mientras la instancia esté "sin configurar". Una vez completado, esa ruta se cierra (redirige a `/login` o `/dashboard`).

---

## Riesgos vivos

- **Cálculo de disponibilidad:** alto riesgo de regresión ante cualquier cambio. Cubrir con tests.
- **Litestream replicando pero no probado:** backup falsamente sano. La restauración real al menos una vez es obligatoria.
- **Deriva de versiones entre instancias:** con N droplets corriendo, hay que mantener disciplina de versionado. Mismo esquema y misma versión en todas, o las migraciones rompen.
- **Wizard inicial roto en producción:** si el wizard falla, el cliente recién creado no puede usar su instancia. Cubrir con un test e2e que simule el flujo completo sobre una BD vacía antes de cada release.
- **Soporte sin acotar:** el modelo de "pago periódico + hosting" no debe degenerar en "mantenimiento gratis ilimitado". Términos del contrato/pre-venta acotan esto.

---

## Cómo usar este documento

- **Cualquier desarrollo futuro empieza por leer este archivo.** Si algo aquí está desactualizado, se actualiza antes de continuar.
- **Solo lo core.** Si entra en duda si una cosa va aquí o en el PLAN, va en el PLAN.
- **Si una decisión clave cambia**, se sobrescribe la línea correspondiente. No se acumulan "v1, v2, v3" — la memoria refleja el estado actual.
- **Cada fase de desarrollo nueva debe terminar revisando si algo de esta memoria ha cambiado** y, si es así, dejarlo coherente.
