# Plan de producto — App de reservas para peluquería

> Documento de guía viva para el desarrollo de la v1. No es una spec técnica; es un mapa de **qué construir y en qué orden**. Cada bloque será una iteración independiente.

---

## Decisiones de producto tomadas

Antes de empezar a construir, estos son los acuerdos base. Si cambian, hay que revisar el plan entero.

- **Locale y zona horaria fijos**: `es-ES`, `Europe/Madrid`. Sin i18n en v1.
- **Mono-salón en la UI, multi-salón en el modelo de datos**. Cada entidad relevante (empleado, servicio, reserva, cliente, horario) cuelga de un `salon_id`. La UI asume un único salón.
- **Confirmación automática de reservas** por defecto. El estado "pendiente" queda reservado para casos de excepción (a definir).
- **Sin pagos online ni depósitos** en v1. La política de no-show se gestiona manualmente.
- **Sin app nativa**. Web responsive, mobile-first en el dashboard.
- **Roles mínimos**: `admin` (dueño/recepción) y `staff` (empleado con acceso limitado a su agenda).

---

## Bloques del producto

Ordenados por prioridad de construcción. Cada bloque debería poder cerrarse antes de empezar el siguiente, aunque algunos pueden solaparse.

---

### Bloque 1 — Modelo de datos y entidades core

Antes de cualquier UI. Si el modelo está mal, todo lo demás se rompe.

- [ ] Definir entidad **Salón** (aunque haya solo uno, todo cuelga de aquí)
- [ ] Definir entidad **Empleado/Profesional**: nombre, foto, especialidades, color identificativo en calendario
- [ ] Definir entidad **Servicio**: nombre, descripción, duración, precio, activo/inactivo
- [ ] Definir relación **Servicio ↔ Empleado** (qué empleados pueden hacer qué servicios)
- [ ] Definir entidad **Cliente**: nombre, teléfono, email opcional, notas internas
- [ ] Definir entidad **Reserva**: cliente, empleado, servicio(s), fecha/hora inicio, duración, estado, notas
- [ ] Definir entidad **Horario** (semanal por empleado) y **Excepción** (festivo, vacaciones, día concreto)
- [ ] Definir entidad **Bloqueo / Descanso** (comida, formación, hueco no reservable)
- [ ] Definir reglas de **capacidad concurrente** por servicio (ej: máx 1 coloración simultánea)

---

### Bloque 2 — Dashboard interno: gestión base

Esto es lo que el dueño configura **una vez** al empezar. Sin esto no se puede reservar.

#### 2.1 Servicios

- [ ] Listar servicios
- [ ] Crear/editar/desactivar servicio (nombre, descripción, duración, precio)
- [ ] Asignar qué empleados pueden hacer cada servicio
- [ ] Definir capacidad máxima concurrente del servicio (ej: mechas → máx 1 a la vez en todo el salón)

#### 2.2 Empleados

- [ ] Listar empleados
- [ ] Crear/editar/desactivar empleado (nombre, foto, especialidades, color)
- [ ] Definir horario semanal de cada empleado (días laborables, hora inicio/fin)
- [ ] Definir descansos recurrentes (ej: comida 14:00–15:00 todos los días)
- [ ] Bloquear días concretos (vacaciones, festivos, ausencias)
- [ ] Marcar qué servicios puede realizar cada empleado

#### 2.3 Configuración del salón

- [ ] Datos básicos del salón (nombre, dirección, teléfono, logo)
- [ ] Horario general del salón (puede sobrescribir al de empleados si está cerrado)
- [ ] Política de cancelación configurable (ej: "hasta 12h antes")
- [ ] Texto legal/aviso que verá el cliente al reservar

---

### Bloque 3 — Reserva por parte del cliente (público)

El flujo principal del cliente final. Mobile-first obligatorio.

- [ ] Selección de servicio (con duración, precio e info visible)
- [ ] Selección de empleado: específico o "cualquiera disponible"
- [ ] Selección de fecha y hora con disponibilidad **real** (calculada según horarios, duración, capacidad concurrente, bloqueos)
- [ ] Formulario de datos: nombre, teléfono (obligatorio), email (opcional)
- [ ] Visualización clara de la **política de cancelación** antes de confirmar
- [ ] Aceptación de términos / aviso legal
- [ ] Confirmación visible en pantalla con resumen de la reserva
- [ ] Caso edge: si elige "cualquiera", el sistema asigna un empleado concreto al confirmar

---

### Bloque 4 — Notificaciones automáticas

Sin esto, el cliente llama por teléfono y todo el esfuerzo del bloque 3 se cae.

- [ ] Email de confirmación inmediata tras reservar (con resumen y enlace mágico)
- [ ] Email de recordatorio 24h antes de la cita
- [ ] Email de aviso al salón cuando entra una reserva nueva (opcional, configurable)
- [ ] Email de confirmación de cancelación
- [ ] Email de confirmación de reprogramación
- [ ] _(v1.1)_ Adjuntar archivo `.ics` para añadir al calendario

---

### Bloque 5 — Enlace mágico del cliente (cancelar / reprogramar)

Cada email de confirmación incluye un enlace único. Sin login, sin contraseñas.

- [ ] Generación de token único por reserva
- [ ] Página pública con detalle de la reserva accesible por el enlace
- [ ] Acción "Cancelar reserva" (sujeta a política de cancelación)
- [ ] Acción "Reprogramar" (reabre el flujo de selección de fecha/hora)
- [ ] Mensajes claros si la política impide cancelar/modificar (ej: "ya no es posible cancelar online, llámanos")
- [ ] Expiración del token tras la cita

---

### Bloque 6 — Dashboard interno: vista calendario

El "centro de control" para el equipo. Tiene que ser sólido en escritorio Y en móvil.

- [ ] Vista calendario diaria
- [ ] Vista calendario semanal
- [ ] Filtro por empleado / ver todos en columnas
- [ ] Color de eventos por empleado o por estado
- [ ] Click en una reserva → modal con todos los detalles
- [ ] Drag & drop para mover citas (con validación de disponibilidad)
- [ ] Crear reserva manual desde el calendario (cuando entra una llamada)
- [ ] Bloquear hueco rápido desde el calendario (sin tener que ir a configuración)

---

### Bloque 7 — Panel "Hoy" / recepción

Vista rápida y operativa del día. Optimizada para tablet/móvil del recepcionista.

- [ ] Lista cronológica de citas de hoy
- [ ] Indicador de "siguiente cliente"
- [ ] Indicador de retraso (si la cita anterior no se ha marcado completada y ya empezó la siguiente)
- [ ] Acción rápida: marcar como **completada**
- [ ] Acción rápida: marcar como **no-show**
- [ ] Acción rápida: marcar como **en curso** (opcional, ayuda a detectar retrasos)
- [ ] Acción rápida: llamar al cliente (link `tel:`)
- [ ] Acción rápida: añadir nota interna a la reserva
- [ ] Acción rápida: mover cita

---

### Bloque 8 — Estados de reserva

Transversal a varios bloques. Conviene definirlo claro pronto.

- [ ] `pendiente` — solo en casos de excepción
- [ ] `confirmada` — estado por defecto al crear
- [ ] `en_curso` — opcional pero útil para el panel hoy
- [ ] `completada` — el servicio se realizó
- [ ] `cancelada_cliente` — cancelada por el cliente vía enlace mágico
- [ ] `cancelada_salon` — cancelada desde el dashboard
- [ ] `no_show` — el cliente no se presentó
- [ ] Reglas de transición entre estados (qué se puede pasar a qué)
- [ ] Filtros por estado en listados

---

### Bloque 9 — Cliente y su historial

Simple. Sin gasto total ni facturación todavía.

- [ ] Listado/búsqueda de clientes
- [ ] Ficha de cliente: datos, notas internas, historial de reservas
- [ ] Filtro por estado en el historial (completadas, no-shows, etc.)
- [ ] Última visita y nº total de visitas
- [ ] Detección de cliente recurrente al reservar (matching por teléfono)

---

### Bloque 10 — Autenticación y roles

- [ ] Login para staff (email + contraseña)
- [ ] Rol `admin`: acceso total (configuración, todos los empleados, todos los datos)
- [ ] Rol `staff`: ve solo su agenda, marca completadas/no-show, añade notas
- [ ] Recuperación de contraseña

---

### Bloque 11 — Landing pública

El "escaparate" que atrae al cliente. Visualmente cuidada.

- [ ] Hero con propuesta clara y CTA a reservar
- [ ] Sección de servicios destacados (precios, duraciones)
- [ ] Sección de equipo (fotos, especialidades de cada profesional)
- [ ] Sección de ubicación (mapa, dirección, horarios)
- [ ] Galería de trabajos (opcional v1, recomendable)
- [ ] Footer con contacto, redes, política de privacidad
- [ ] CTA permanente a "Reservar cita"
- [ ] Animaciones cuidadas pero sin sacrificar performance ni accesibilidad

---

### Bloque 12 — Responsive y pulido final

No es un bloque al final cronológicamente: es una **regla constante**. Pero conviene un check específico antes de lanzar.

- [ ] Flujo de reserva del cliente: perfecto en móvil
- [ ] Dashboard calendario: usable en tablet (apaisado mínimo)
- [ ] Panel "hoy": usable en móvil (es el más usado en movilidad)
- [ ] Configuración: aceptable en móvil, no necesita ser óptima
- [ ] Test en navegadores: Chrome, Safari iOS, Safari macOS, Firefox
- [ ] Accesibilidad básica: contraste, labels, navegación por teclado en formularios

---

## Fuera de v1 (parking lot)

Para que no se cuele nada por la puerta de atrás. Cada uno aquí es una decisión consciente de "ahora no".

- Pagos / depósitos online (Stripe)
- Política de no-show con cobro automático
- Programa de fidelización / puntos
- Gasto total del cliente y reporting financiero
- Multi-sucursal en la UI
- Marketing automation (campañas, cumpleaños)
- Reseñas / valoraciones tras la cita
- Integración con Google Calendar / Apple Calendar (más allá del `.ics` adjunto)
- WhatsApp Business API
- App nativa
- Recordatorios por SMS (empezamos solo con email)
- Multi-idioma
- Panel de métricas / analytics interno
- Inventario de productos
- Venta de productos junto al servicio

---

## Orden de construcción recomendado

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
```

En la práctica:

- **Bloques 1 y 2** son fundacionales. Sin esto no hay app.
- **Bloques 3, 4, 5** completan el flujo del cliente externo.
- **Bloques 6, 7** son el día a día interno. Aquí es donde la app gana o pierde a las peluquerías.
- **Bloques 8, 9, 10** consolidan estado y permisos.
- **Bloque 11** se puede paralelizar con el 6 si hay capacidad, no depende del resto.
- **Bloque 12** es revisión final + cultura constante.

---

## Riesgos identificados

- **Cálculo de disponibilidad**: es la parte más compleja del sistema. Combina horario semanal + excepciones + duración del servicio + capacidad concurrente + servicios permitidos del empleado. Conviene prototiparlo pronto, idealmente al final del bloque 1, con tests.
- **Drag & drop en calendario móvil**: es un agujero negro de UX. Si se complica, aceptar fallback a "mover con botón" en móvil.
- **Reserva de "cualquier empleado"**: la asignación automática debe ser determinista y justa (¿el menos cargado? ¿el primero disponible?). Decidir el criterio antes de implementar el bloque 3.
- **Concurrencia en reservas**: dos clientes intentando reservar el mismo hueco a la vez. Necesario lock optimista o validación al confirmar.
