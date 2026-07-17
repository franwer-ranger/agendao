# PLAN FINAL — Lo que queda de Agendao

> Cierre del proyecto. Cuatro fases en orden, cada una con prompt para Claude Code.
>
> Antes de cada fase: leer `MEMORIA.md`. Después de cada fase: revisar si algo cambia en `MEMORIA.md` y actualizarlo si toca.

---

## Estado del que partimos

- Bloques 1-9 del plan de producto: completos.
- M1-M8 de la migración: completos. Auth (Bloque 10) también.
- En producción: dominio, HTTPS, emails, SQLite + Drizzle + Auth.js v5.

Falta:

1. **Fase A — Backups con Litestream + monitorización** (era M9 del plan de migración).
2. **Fase B — Wizard de configuración inicial** (nueva, decidida ahora).
3. **Fase C — Landing pública** (era Bloque 11).
4. **Fase D — Pulido final** (era Bloque 12).

---

## Orden recomendado

```
A → B → C → D
```

- **A primero** porque sin backups no es producción. Y porque cuando entre el primer cliente real, ya tiene que estar.
- **B segundo** porque es lo que desbloquea poder vender. Sin wizard, cada nueva instancia requiere intervención manual en la base de datos.
- **C y D** son cierre. C se puede paralelizar con B si hay capacidad.

---

## Fase A — Backups (Litestream) + monitorización

**Objetivo**: backup continuo del SQLite a un bucket externo, restauración probada al menos una vez, uptime monitorizado y errores capturados. Cuando esto cierre, la app está en "estado producción real".

### Pasos

- Cuenta en Backblaze B2 o Cloudflare R2. Bucket creado. Credenciales.
- Litestream como accessory de Kamal (o instalado en el VPS) replicando `data/prod.db`.
- Verificación: `kamal accessory logs litestream` muestra replicación activa con snapshots.
- **Restauración manual en máquina aparte**: descargar Litestream local, hacer `litestream restore`, verificar el `.db` resultante con un `SELECT` real.
- UptimeRobot: monitor HTTP del dominio cada 5 minutos, alerta por email.
- Sentry: SDK en cliente y servidor, DSN como variable de entorno, error de prueba capturado.
- Runbook escrito en el README: cómo restaurar, cómo consultar UptimeRobot, cómo entrar a Sentry, qué hacer si Litestream deja de replicar.

### Puntos críticos

- **Un backup que no se ha probado restaurando no es un backup.** No se declara la fase completa hasta haber ejecutado el restore al menos una vez.
- **WAL y backups:** `prod.db-wal` y `prod.db-shm` son parte de la base. Litestream lo maneja correctamente; un `cp` ingenuo del `.db` sin Litestream **no** es backup válido.
- **Sentry en cliente Y servidor:** si solo configuras uno, te pierdes la mitad de los errores reales.

### Prompt para Claude Code

```text
Contexto: lee primero MEMORIA.md en la raíz del repo. Resume las tres decisiones que
más condicionan esta fase y para que confirme antes de empezar.

Estado: app en producción con Drizzle + SQLite + Resend + Auth.js v5. Bloques 1-10
del producto y M1-M8 de la migración completados. Toca cerrar M9: backups +
monitorización.

Objetivo: dejar montados Litestream para backups continuos de SQLite, UptimeRobot
para uptime, y Sentry para errores. Sin esto, no es producción.

Tareas:
1. Litestream:
   - Pregúntame entre Backblaze B2 y Cloudflare R2. Si no tengo preferencia,
     recomienda según la operativa más simple.
   - Crear litestream.yml de configuración: replicar /app/data/prod.db a un bucket
     S3-compatible.
   - Añadir Litestream como accessory en config/deploy.yml de Kamal, ejecutándose
     en paralelo a la app, con acceso al mismo volumen data/ en modo lectura.
   - Variables de entorno necesarias en .kamal/secrets:
     LITESTREAM_ACCESS_KEY_ID, LITESTREAM_SECRET_ACCESS_KEY, LITESTREAM_BUCKET.
   - Verificación: tras el deploy, kamal accessory logs litestream debe mostrar
     líneas de "wrote snapshot" o equivalentes.

2. Procedimiento de restauración:
   - Documentar en el README, sección "Operations", los pasos exactos para
     restaurar en una máquina local: descargar Litestream, ejecutar litestream
     restore con la config apuntando al bucket, verificar el .db resultante con
     un SELECT contra Drizzle.
   - Yo ejecutaré el restore real una vez. Tú prepara solo el procedimiento.

3. UptimeRobot:
   - Documenta los pasos manuales que tengo que dar yo (crear cuenta, añadir
     monitor HTTP cada 5 min al dominio, configurar alerta por email).

4. Sentry:
   - Instalar @sentry/nextjs.
   - Configurar manualmente o vía wizard: sentry.client.config.ts,
     sentry.server.config.ts, instrumentation.ts.
   - DSN como variable de entorno SENTRY_DSN, añadirlo a .kamal/secrets.
   - Crear una ruta /api/debug/sentry-test (protegida por un header secreto o
     solo en modo dev) que lance un error capturable, para verificar.

5. Runbook en el README, sección "Operations":
   - Cómo restaurar SQLite desde Litestream, paso a paso.
   - Cómo consultar UptimeRobot y qué significan las alertas.
   - Cómo entrar a Sentry y filtrar por release.
   - Qué hacer si Litestream deja de replicar (síntomas, dónde mirar los logs).

Restricciones:
- No declares la fase completa hasta verificar que Litestream replica de verdad
  (snapshot visible en los logs del accessory).
- La restauración la pruebo yo en mi máquina; tú no la ejecutes.
- No introduzcas dependencias nuevas más allá de @sentry/nextjs y la config de
  Litestream.

Al terminar:
- Resume qué archivos tocaste y qué pasos manuales me quedan.
- Revisa MEMORIA.md. Si algo del stack o de los riesgos vivos ha cambiado tras
  esta fase, propónme la edición concreta antes de aplicarla. La sección "Estado
  actual" debe quedar actualizada (M9 ✅).
```

---

## Fase B — Wizard de configuración inicial

**Objetivo**: cuando se despliega una instancia para un cliente nuevo, la BD está vacía. La app no debe estallar. El primer visitante (el admin) atraviesa un wizard que crea su usuario, su salón y la configuración básica. Al terminar, queda con sesión iniciada y la URL pública para compartir con sus clientes.

### Pasos

- Detección de "instancia sin configurar": no hay ningún salón en la BD.
- Cualquier ruta de la app (excepto `/setup` y assets) redirige a `/setup` mientras la instancia no esté configurada.
- Wizard multi-paso, persistencia en `localStorage` o cookies entre pasos (por si el admin recarga):
  1. **Bienvenida** y explicación de qué va a hacer.
  2. **Cuenta admin**: email, contraseña, nombre. Crea el primer `users` con `role='admin'`.
  3. **Salón**: nombre, dirección, teléfono, logo, slug (validado), horario general, política de cancelación, texto legal.
  4. **Servicios**: plantilla pre-rellenada (corte caballero, corte señora, tinte, mechas, etc.) editable. Cada uno con duración y precio.
  5. **Empleados**: nombre, foto, color, horario semanal, descansos.
  6. **Relación servicio ↔ empleado**: qué hace cada quién (matriz de checkboxes).
  7. **Resumen y confirmación**: vista previa de todo, botón "Crear mi salón".
- Al confirmar: una transacción crea todo en orden (admin, salón, servicios, empleados, relaciones, horarios). Si algo falla, rollback completo.
- Tras éxito: sesión del admin iniciada, redirect a `/dashboard` con un **banner de bienvenida** que muestra la URL pública `https://[dominio]/[slug]/book` y un botón "Copiar enlace".
- A partir de ese momento, `/setup` redirige a `/dashboard` (o `/login` si no autenticado).

### Puntos críticos

- **Reutilizar componentes de formulario del dashboard** (Bloque 2): los formularios de servicios, empleados y horarios ya existen. El wizard los compone en pasos.
- **El dashboard edita entidades que ya existen; el wizard construye desde cero y en orden.** Las dependencias importan: no puedes asignar servicios a un empleado si no existen ambos. El wizard impone ese orden, el dashboard no.
- **Plantilla pre-rellenada de servicios**: ahorra trabajo y, sobre todo, quita el "miedo a la página en blanco". Es la decisión de mayor retorno por menor esfuerzo del wizard.
- **Transacción atómica al confirmar**: si falla a mitad de creación, no puede quedar una instancia "medio configurada". Rollback completo.
- **Test e2e obligatorio**: simular el flujo wizard completo sobre una BD vacía. Es el "smoke test" que se ejecuta antes de cada release nueva, porque si el wizard falla, cada nuevo cliente tiene una instancia inutilizable.
- **Persistencia entre pasos**: el admin puede recargar el navegador o irse a por café. El wizard debe recuperar el estado donde lo dejó (sin haber escrito en BD todavía).
- **Slug del salón**: validar formato (solo lowercase, números, guiones), validar unicidad dentro de la instancia (aunque sea una sola, mantener la columna). Será parte de la URL pública.

### Prompt para Claude Code

```text
Contexto: lee primero MEMORIA.md en la raíz del repo. Confirma que entiendes:
- Una instancia = un cliente. Mono-salón en UI, multi-salón en datos.
- Sin registro público. Solo /login y /forgot-password.
- El wizard vive DENTRO de la app del cliente, no es una herramienta interna
  separada.

Estado: M9 (backups + monitorización) cerrado. App en producción con instancia
configurada. Falta soporte para "primera ejecución sobre BD vacía": cuando se
despliegue una instancia nueva para un cliente real, la BD estará vacía y la app
debe arrancar un wizard de configuración inicial en lugar de estallar.

Objetivo: implementar el wizard de configuración inicial que crea, en orden:
usuario admin → salón → servicios → empleados → relaciones servicio↔empleado →
horarios. Al terminar, el admin queda con sesión iniciada y aterriza en el
dashboard con la URL pública del salón destacada.

Tareas:

1. Detección de "instancia sin configurar":
   - Helper isInstanceConfigured(): true si existe al menos un salon en la BD.
   - Middleware: si no está configurada y la ruta no es /setup ni assets ni
     /api/health, redirige a /setup.
   - Si está configurada y se entra a /setup, redirige a /login o /dashboard.

2. Estructura del wizard en /setup:
   - Layout propio con stepper visual (paso N de 7).
   - Persistencia del estado parcial en localStorage (clave 'setup-wizard-draft')
     hasta el paso final. No se escribe en BD hasta el "Crear mi salón".
   - Botones "Anterior" y "Siguiente" en cada paso. "Siguiente" valida el paso
     antes de avanzar.

3. Pasos:
   a) Bienvenida: explicación breve, botón "Empezar".
   b) Cuenta admin: email, password (con validación de fortaleza), nombre.
   c) Salón: nombre, slug autopropuesto desde el nombre (editable), dirección,
      teléfono, logo (upload, reutiliza M3), horario general semanal, política
      de cancelación (textarea), texto legal (textarea).
   d) Servicios: plantilla pre-rellenada con 6-8 servicios típicos de peluquería
      (corte caballero, corte señora, lavado y peinado, tinte completo, mechas,
      mascarilla, barba, niños). Cada uno con duración, precio. El admin puede
      editar, borrar, añadir.
   e) Empleados: lista vacía con botón "Añadir empleado". Por cada uno: nombre,
      foto opcional, color, horario semanal, descansos recurrentes.
   f) Relación servicio ↔ empleado: matriz de checkboxes. Filas servicios,
      columnas empleados. Por defecto todos marcados.
   g) Resumen: vista previa de todo. Botón "Crear mi salón".

4. Confirmación final:
   - Server action setupInstance(data) que envuelve TODO en una transacción
     Drizzle:
       1. INSERT user (role='admin', salon_id se rellena en el paso 2 con el id
          recién creado).
       2. INSERT salon.
       3. UPDATE user.salon_id.
       4. INSERT services.
       5. INSERT employees + horarios + descansos.
       6. INSERT service_employee relaciones.
   - Si algo falla, ROLLBACK completo.
   - Tras éxito: iniciar sesión del admin con Auth.js (signIn programático),
     limpiar localStorage del draft, redirigir a /dashboard?welcome=true.

5. Banner de bienvenida en /dashboard:
   - Si la query string trae welcome=true, mostrar banner destacado:
     "Tu salón está listo. Comparte este enlace con tus clientes:
     https://[dominio]/[slug]/book"
   - Botón "Copiar enlace".
   - Cerrable, no vuelve a aparecer si se cierra (flag en localStorage o en
     user.first_login_completed).

6. Test e2e:
   - Crear test e2e (Playwright si ya está, o el framework que use el proyecto)
     que arranque una BD vacía, recorra el wizard completo, llegue al dashboard
     con sesión iniciada, y verifique que la URL pública responde con la página
     de reservas.
   - Este test debe ejecutarse en CI antes de cada deploy.

Restricciones:
- Reutiliza los componentes de formulario existentes del dashboard (servicios,
  empleados, horarios). NO dupliques formularios. Si hay que extraer subcomponentes
  para que sirvan a los dos casos, hazlo.
- La transacción del paso 4 es atómica. Si una INSERT falla, la BD queda como
  estaba.
- El slug del salón se valida en el cliente (formato) y en el servidor (unicidad)
  antes de confirmar.
- El password del admin se hashea con argon2, igual que en el Bloque 10.
- NO permitas acceder a /setup una vez que ya hay un salón en la BD. Cierra la
  puerta detrás de ti.
- El wizard NO debe enviar emails (no es una invitación, es el propio admin
  registrándose).

Al terminar:
- Resume qué archivos creaste/tocaste.
- Confirma que el test e2e pasa.
- Revisa MEMORIA.md: marca el wizard como completado en "Estado actual". Si
  durante la implementación descubriste algo que merezca subir a memoria
  (decisión arquitectónica, riesgo nuevo), propónmelo antes de editarla.
```

---

## Fase C — Landing pública

**Objetivo**: la página de aterrizaje del salón. El "escaparate" donde los clientes finales descubren el negocio y reservan. Visualmente cuidada, mobile-first, performante.

Nota importante: aquí "landing pública" se refiere a **la landing del salón cliente**, no a una landing comercial de Agendao. Vive en la propia instancia, bajo el slug del salón.

### Pasos

- Hero con propuesta clara y CTA a reservar.
- Sección de servicios destacados (precios, duraciones, foto opcional).
- Sección de equipo (fotos, especialidades de cada profesional).
- Sección de ubicación (mapa, dirección, horarios).
- Galería de trabajos (opcional, recomendable).
- Footer con contacto, redes, política de privacidad.
- CTA permanente a "Reservar cita".
- Animaciones cuidadas pero sin sacrificar performance ni accesibilidad.

### Puntos críticos

- **No depende del stack ni de auth.** Es HTML/CSS/imágenes servidas por Next.js. Es la fase más independiente.
- **Performance y accesibilidad** son requisito, no extra: Lighthouse > 90 en mobile, contraste WCAG AA, navegación por teclado.
- **Datos vienen del wizard:** todo lo que muestra la landing (servicios, equipo, ubicación) lo configuró el admin en la Fase B. Si hay un dato vacío, la landing oculta esa sección elegantemente.

### Prompt para Claude Code

```text
Contexto: lee primero MEMORIA.md. Confirma que entiendes que la landing pública
es la del SALÓN del cliente (no una landing comercial de Agendao), y que vive en
la propia instancia bajo el slug del salón.

Estado: wizard de configuración inicial completado (Fase B). Cualquier instancia
nueva tiene ya datos del salón. Toca construir la landing pública que muestra
ese salón al mundo.

Objetivo: landing pública del salón en /[slug] (mismo prefijo que /[slug]/book).
Visualmente cuidada, mobile-first, sin sacrificar performance ni accesibilidad.

Tareas:

1. Estructura de página /app/[slug]/page.tsx:
   - Server component que carga datos del salón por slug.
   - Si el slug no existe, 404.
   - Render de las secciones que tengan datos; oculta las que no.

2. Secciones (todas componentes separados, reutilizables):
   - Hero: nombre del salón, frase corta (campo nuevo en salons.tagline,
     opcional), CTA grande "Reservar cita" → /[slug]/book.
   - Servicios destacados: grid con cada servicio activo (nombre, duración,
     precio, descripción).
   - Equipo: grid de empleados activos con foto, nombre, especialidades.
   - Ubicación: dirección + mapa embebido (OpenStreetMap o similar — no Google
     Maps para evitar dependencia y tracking).
   - Galería: opcional. Si hay imágenes en una nueva tabla salon_gallery, las
     muestra. Si no, oculta la sección.
   - Footer: teléfono, email del salón, horario, enlace a política de privacidad
     (página estática /[slug]/legal).
   - CTA flotante o sticky a "Reservar cita" en mobile.

3. Diseño:
   - Mobile-first. Probar en viewport 380px.
   - Tipografía y paleta sobrias por defecto. Usa el color/logo del salón cuando
     esté.
   - Animaciones discretas (fade-in en scroll, hover suaves). NADA de carruseles
     pesados, parallax agresivo, ni vídeos auto-play.
   - Imágenes optimizadas con next/image. Lazy loading por defecto.

4. SEO básico:
   - <title> y <meta description> con datos del salón.
   - Open Graph tags para que comparta bien en WhatsApp y redes.
   - sitemap.xml dinámico que incluya /[slug] y /[slug]/book.

5. Performance:
   - Lighthouse > 90 en mobile (performance, accessibility, best practices, SEO).
   - Comprueba que no hay layout shift (CLS < 0.1).
   - No JavaScript innecesario: la mayoría es server component.

6. Accesibilidad:
   - Contraste WCAG AA en todos los textos.
   - Navegación por teclado funcional.
   - alt en todas las imágenes.
   - aria-labels en botones icónicos.

Restricciones:
- No introduzcas Google Maps ni ningún servicio que requiera API key con coste.
  Usa OpenStreetMap o un componente estático.
- No metas un CMS ni un editor visual. El admin edita los datos desde el
  dashboard normal; la landing los lee.
- No bloquees el deploy si Lighthouse baja 1-2 puntos, pero el objetivo es > 90.

Al terminar:
- Pasa Lighthouse en mobile y reporta los scores.
- Resume qué archivos creaste.
- Revisa MEMORIA.md: marca Fase C en "Estado actual". Si tomaste alguna decisión
  arquitectónica que merezca estar ahí (ej: añadiste una tabla nueva, decidiste
  cómo se gestionan las imágenes de la galería), propónmelo antes de editarla.
```

---

## Fase D — Pulido final

**Objetivo**: la app pulida, probada en todos los flujos críticos, lista para entregar al primer cliente real. Esta fase no añade features; cierra cabos.

### Pasos

- Smoke test e2e end-to-end **sobre la instancia de producción real** (no solo en local):
  - Flujo de reserva del cliente: completo en mobile.
  - Dashboard calendario: usable en tablet (apaisado mínimo).
  - Panel "hoy": usable en móvil.
  - Configuración: aceptable en móvil, no necesita ser óptima.
  - Wizard de configuración inicial: ejecutado sobre una instancia limpia.
- Test cross-browser: Chrome, Safari iOS, Safari macOS, Firefox.
- Accesibilidad básica: contraste, labels, navegación por teclado en formularios.
- Revisión de copy: textos en `es-ES` consistentes, sin "Lorem ipsum" residual.
- Revisión de emails: las cuatro plantillas (confirmación, recordatorio, cancelación, reprogramación) renderizan bien en Gmail, Outlook, Apple Mail.
- Revisión del runbook: cualquiera (incluido tu yo del futuro) puede seguir los pasos sin contexto adicional.
- Checklist de "qué hay que hacer para crear una nueva instancia para un cliente nuevo": pasos exactos desde "compra la licencia" hasta "le mando la URL". Esto es el embrión de la futura automatización del onboarding.

### Puntos críticos

- **Probar en producción real, no en local.** Local engaña: los timings, los emails, los certificados, el dominio… solo se prueban de verdad en el VPS.
- **Esta fase es la que separa "funciona en mi máquina" de "se lo puedo dar a alguien".** No saltarse el smoke test.

### Prompt para Claude Code

```text
Contexto: lee primero MEMORIA.md. Confirma el estado actual: Fases A, B, C
completadas. La app está en producción con backups, wizard inicial y landing
pública.

Objetivo: cerrar Agendao para entrega al primer cliente real. No añades features.
Cierras cabos sueltos.

Tareas:

1. Checklist de smoke test sobre la instancia de producción real:
   Crea docs/smoke-test.md con una checklist concreta y ejecutable. Yo la voy a
   recorrer manualmente en el dominio de producción. Cada ítem debe tener:
   - Acción a realizar (paso a paso).
   - Resultado esperado.
   - Cómo verificar.
   La checklist cubre:
   - Wizard de configuración inicial sobre instancia limpia (yo provisiono una
     instancia de prueba aparte).
   - Login y logout.
   - Recuperación de contraseña (incluye recibir email real).
   - Creación de reserva desde landing pública.
   - Recepción del email de confirmación.
   - Cancelación vía enlace mágico.
   - Reprogramación vía enlace mágico.
   - Email de recordatorio (verificar que el cron se dispara — yo puedo forzarlo
     manualmente con un curl al endpoint).
   - Dashboard: vista calendario diaria y semanal.
   - Dashboard: crear reserva manual.
   - Dashboard: drag & drop de reservas.
   - Panel hoy en móvil real (no devtools).
   - Marcar reserva como completada y como no-show.
   - Bloquear hueco rápido.
   - Ficha de cliente con historial.
   - Acceso del rol staff: ve solo su agenda, no la configuración.

2. Test cross-browser:
   Documenta en docs/browser-test.md cómo probar el flujo de reserva pública en:
   - Chrome (desktop y mobile).
   - Safari iOS (real, no simulador).
   - Safari macOS.
   - Firefox.
   Si encuentras issues conocidos en alguno, anótalos.

3. Revisión de accesibilidad:
   - Pasa axe DevTools o equivalente sobre las páginas críticas: landing,
     flujo de reserva, login, dashboard.
   - Reporta los issues encontrados, separados por severidad.
   - Arregla los críticos (contraste, labels ausentes, foco no visible). Los
     menores los reportas pero no los arreglas sin consultarme.

4. Revisión de copy:
   - Audita todos los textos visibles de la app. Lista (en docs/copy-audit.md)
     cualquier "Lorem ipsum", placeholder olvidado, texto en otro idioma, o
     incoherencia de tono.
   - Arregla lo evidente; consulta lo dudoso.

5. Revisión de plantillas de email:
   - Renderiza las cuatro plantillas (confirmación, recordatorio, cancelación,
     reprogramación) con datos de prueba.
   - Envíalas a una cuenta de Gmail real (RESEND_FROM debe estar verificado).
     Yo te paso la dirección.
   - Reporta cualquier issue visual (botones, imágenes, links).

6. Documentación de "alta de nueva instancia":
   - Crea docs/new-instance.md con los pasos exactos para crear una nueva
     instancia para un cliente nuevo:
     1. Provisionar droplet en DigitalOcean (tamaño, región).
     2. Configurar DNS en Cloudflare (registro A apuntando al droplet).
     3. Clonar deploy.yml, ajustar dominio y nombre de servicio.
     4. Crear bucket Litestream propio para este cliente (o reutilizar con prefix
        — recomienda lo más simple).
     5. kamal setup + kamal deploy.
     6. Verificar healthcheck.
     7. Enviar al cliente la URL de su instancia, donde arrancará el wizard.
   - Esto NO es automatización todavía; es el procedimiento manual escrito.
     Cuando hayan pasado 2-3 clientes, se decide qué automatizar.

7. Revisión final del README:
   - Sección "Operations" debe ser autosuficiente: cualquiera puede consultarla y
     resolver una incidencia común sin más contexto.
   - Eliminar referencias obsoletas (Supabase, Vercel, cualquier vestigio).

Restricciones:
- No introduzcas features nuevas. Si encuentras algo que falta, anótalo como
  pendiente futuro pero no lo añadas.
- Cualquier cambio de UX/copy más allá de fixes evidentes, consúltame.

Al terminar:
- Lista los documentos nuevos que has creado.
- Reporta los issues que encontraste y no arreglaste (con motivo).
- Revisa MEMORIA.md una última vez. Marca el proyecto como "v1 lista para
  entrega" en "Estado actual". Si hay algo que el yo del futuro deba saber para
  el primer cliente real (un gotcha, un detalle de operación), propónmelo para
  añadir a memoria.
```

---

## Después de la Fase D

La v1 está cerrada. Lo siguiente es **operación real**:

- Conseguir el primer cliente real.
- Recorrer el procedimiento `new-instance.md` y anotar cada fricción.
- Iterar el procedimiento hasta que sea suave.
- A partir del segundo o tercer cliente, evaluar qué automatizar (provisión del droplet, DNS, deploy).
- Mantener `MEMORIA.md` viva: cualquier decisión nueva (sobre soporte, sobre precio, sobre features) entra ahí si es core.

El parking lot del PLAN.md original (pagos, fidelización, multi-idioma, etc.) sigue válido. Cada cosa que entre en él debe ser una decisión consciente de "ahora no".
