# Archivo histórico

Estos documentos describen el modelo **anterior** de Agendao: "una instancia
desplegada por cliente" sobre **SQLite**, con pago único + hosting gestionado.

Ese modelo quedó **superado** por el giro a SaaS multi-tenant sobre Postgres
(2026-06-30). La fuente de verdad del rumbo actual es
`docs/superpowers/specs/2026-06-30-saas-pivot-design.md`.

Se conservan solo por contexto histórico. **No los uses como referencia de la
arquitectura ni del producto actuales** — para eso:

- `GUIA_PRODUCTO.md` — features y roadmap actuales.
- `MEMORY.md` — decisiones core e invariantes.
- `README.md` — setup y operación.
- `Project_Map.md` — dónde vive cada cosa en el código.

Contenido archivado:

- `PLAN.md` — plan de producto pre-pivot.
- `PLAN_FINAL.md` — plan detallado pre-pivot.
- `PLAN_MIGRACION_VPS.md` — plan de migración a VPS con una instancia SQLite por
  cliente (obsoleto).
