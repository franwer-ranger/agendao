// Generador de `Project_Map.md`.
//
// Escanea el árbol del repo (rutas del App Router, módulos de `lib/`, tablas
// del schema, migraciones, scripts y docs) y produce un mapa navegable para
// que un agente de IA (o una persona nueva) se ubique rápido en el proyecto.
//
// Uso: `npm run map:generate`
//
// Diseño: lo *estructural* (qué rutas/ficheros/tablas existen) se lee en vivo
// del disco; las *descripciones de área* son curadas aquí abajo porque son
// conceptos arquitectónicos estables. Si añades un módulo nuevo a `lib/` o un
// área nueva en `app/`, añade su descripción en los mapas de abajo.

import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')

// ---------------------------------------------------------------------------
// Descripciones curadas (conceptos estables; edítalas al crear módulos/áreas).
// ---------------------------------------------------------------------------

const AREA_ORDER = [
  'landing',
  'booking',
  'admin',
  'setup',
  'auth',
  'api',
  'other',
] as const
type Area = (typeof AREA_ORDER)[number]

const AREA_META: Record<Area, { title: string; desc: string }> = {
  landing: {
    title: 'Landing / público',
    desc: 'Landing comercial de Agendao (captación de peluquerías).',
  },
  booking: {
    title: 'Reserva pública',
    desc: 'Flujo del cliente final por salón: servicio → empleado → fecha/hora → datos → confirmación.',
  },
  admin: {
    title: 'Panel de administración',
    desc: 'Dashboard del salón: hoy, calendario, empleados, servicios y ajustes. Aislado por tenant y rol.',
  },
  setup: {
    title: 'Onboarding (wizard)',
    desc: 'Alta y configuración inicial del salón (multi-paso, borrador en localStorage).',
  },
  auth: {
    title: 'Autenticación',
    desc: 'Login, recuperar y restablecer contraseña (Auth.js v5).',
  },
  api: {
    title: 'API / route handlers',
    desc: 'Endpoints: health, cron de recordatorios, callback de auth y servido de uploads.',
  },
  other: { title: 'Otros', desc: 'Rutas sin área asignada.' },
}

const LIB_META: Record<string, string> = {
  auth: 'Auth.js v5: config, acciones de login, sesiones en DB y reset de contraseña.',
  availability:
    'Motor de disponibilidad y creación de reservas. Núcleo crítico: combina horarios, ausencias, cierres y capacidad; resuelve concurrencia en una transacción.',
  bookings:
    'Consultas y acciones sobre reservas (hoy, calendario, cambios de estado, notas).',
  clients: 'Consultas de clientes del salón.',
  db: 'Conexión Postgres (pool `pg` + Drizzle), schema y guard de tenant (`withTenant` + GUC de RLS).',
  email:
    'Emails transaccionales (Resend + react-email): plantillas, triggers por evento y batch de recordatorios.',
  employees: 'CRUD de empleados, editor de horario semanal y slugs.',
  salons: 'Ajustes del salón, storage de logos y schemas de validación.',
  services: 'CRUD de servicios y slugs.',
  setup:
    'Wizard de onboarding: gating por-tenant (`onboarding_completed_at`) y provisión inicial.',
}

// Dependencias que resumen el stack (se leen del package.json en vivo).
const STACK_KEYS = [
  'next',
  'react',
  'drizzle-orm',
  'pg',
  'next-auth',
  'resend',
  'zod',
  'tailwind-merge',
  'shadcn',
]

// ---------------------------------------------------------------------------
// Utilidades de FS.
// ---------------------------------------------------------------------------

type Dirent = { name: string; isDir: boolean }

function listDir(abs: string): Dirent[] {
  try {
    return readdirSync(abs, { withFileTypes: true })
      .map((d) => ({ name: d.name, isDir: d.isDirectory() }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

function rel(abs: string): string {
  return relative(repoRoot, abs).split('\\').join('/')
}

function exists(abs: string): boolean {
  try {
    statSync(abs)
    return true
  } catch {
    return false
  }
}

function countCodeFiles(abs: string): number {
  let n = 0
  for (const e of listDir(abs)) {
    if (e.isDir) n += countCodeFiles(join(abs, e.name))
    else if (/\.(ts|tsx)$/.test(e.name)) n += 1
  }
  return n
}

// ---------------------------------------------------------------------------
// Rutas del App Router.
// ---------------------------------------------------------------------------

type Route = {
  url: string
  kind: 'page' | 'handler'
  file: string
  area: Area
  notes: string[]
}

const PAGE_FILES = ['page.tsx', 'page.ts']
const HANDLER_FILES = ['route.ts', 'route.tsx']

function urlFromSegments(segments: string[]): string {
  const parts = segments.filter(
    (s) => !/^\(.+\)$/.test(s) && !s.startsWith('_'),
  )
  return '/' + parts.join('/')
}

function classifyArea(segments: string[]): Area {
  if (segments.some((s) => s === 'admin')) return 'admin'
  if (segments.some((s) => s === '[salonSlug]')) return 'booking'
  if (segments.some((s) => s === 'setup')) return 'setup'
  if (segments.some((s) => s === 'api')) return 'api'
  if (
    segments.some((s) =>
      ['login', 'forgot-password', 'reset-password'].includes(s),
    )
  )
    return 'auth'
  if (segments.length === 0 || segments.some((s) => /^\(.+\)$/.test(s)))
    return 'landing'
  return 'other'
}

function collectRoutes(appDir: string): Route[] {
  const routes: Route[] = []

  function walk(abs: string, segments: string[]) {
    const entries = listDir(abs)
    const names = new Set(entries.filter((e) => !e.isDir).map((e) => e.name))

    const pageFile = PAGE_FILES.find((f) => names.has(f))
    const handlerFile = HANDLER_FILES.find((f) => names.has(f))

    if (pageFile || handlerFile) {
      const notes: string[] = []
      if (names.has('layout.tsx')) notes.push('layout')
      if (names.has('actions.ts')) notes.push('actions.ts')
      for (const sub of entries.filter((e) => e.isDir && e.name.startsWith('_'))) {
        const n = countCodeFiles(join(abs, sub.name))
        notes.push(`${sub.name} (${n})`)
      }
      const chosen = pageFile ?? handlerFile!
      routes.push({
        url: urlFromSegments(segments),
        kind: pageFile ? 'page' : 'handler',
        file: rel(join(abs, chosen)),
        area: classifyArea(segments),
        notes,
      })
    }

    for (const dir of entries.filter((e) => e.isDir)) {
      walk(join(abs, dir.name), [...segments, dir.name])
    }
  }

  walk(appDir, [])
  return routes.sort((a, b) => a.url.localeCompare(b.url))
}

// ---------------------------------------------------------------------------
// Módulos de `lib/`.
// ---------------------------------------------------------------------------

type LibModule = { name: string; isDir: boolean; files: string[]; desc: string }

function collectLibModules(libDir: string): LibModule[] {
  const out: LibModule[] = []
  for (const e of listDir(libDir)) {
    if (e.isDir) {
      const files = listDir(join(libDir, e.name))
        .filter((f) => !f.isDir && /\.(ts|tsx)$/.test(f.name))
        .map((f) => f.name)
      out.push({
        name: e.name,
        isDir: true,
        files,
        desc: LIB_META[e.name] ?? 'Módulo sin descripción curada.',
      })
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push({
        name: e.name,
        isDir: false,
        files: [],
        desc: 'Utilidad compartida.',
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Tablas del schema Drizzle.
// ---------------------------------------------------------------------------

function collectTables(schemaFile: string): string[] {
  if (!exists(schemaFile)) return []
  const src = readFileSync(schemaFile, 'utf8')
  const re = /export const \w+ = pgTable\(\s*['"]([^'"]+)['"]/g
  const tables: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) tables.push(m[1]!)
  return tables.sort()
}

// ---------------------------------------------------------------------------
// Snapshot de git y stack.
// ---------------------------------------------------------------------------

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'desconocido'
  }
}

function readStack(): string[] {
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return STACK_KEYS.filter((k) => deps[k]).map((k) => `${k} ${deps[k]}`)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Render del Markdown.
// ---------------------------------------------------------------------------

function main() {
  const routes = collectRoutes(join(repoRoot, 'app'))
  const libModules = collectLibModules(join(repoRoot, 'lib'))
  const tables = collectTables(join(repoRoot, 'lib/db/schema.ts'))
  const migrations = listDir(join(repoRoot, 'drizzle'))
    .filter((e) => !e.isDir && e.name.endsWith('.sql'))
    .map((e) => e.name)
  const scripts = listDir(join(repoRoot, 'scripts'))
    .filter((e) => !e.isDir)
    .map((e) => e.name)
  const stack = readStack()

  const commit = git('rev-parse --short HEAD')
  const commitDate = git('log -1 --format=%cs')
  const today = new Date().toISOString().slice(0, 10)

  const pages = routes.filter((r) => r.kind === 'page').length
  const handlers = routes.filter((r) => r.kind === 'handler').length

  const L: string[] = []
  L.push('# Project Map — Agendao')
  L.push('')
  L.push(
    '> **Archivo autogenerado.** No lo edites a mano: se regenera con `npm run map:generate`',
  )
  L.push(
    '> (script `scripts/generate-project-map.ts`). Es un mapa para que agentes de IA y',
  )
  L.push(
    '> personas nuevas se ubiquen rápido. Para el *qué/por qué* de producto, ver',
  )
  L.push('> `GUIA_PRODUCTO.md`; para las decisiones core, `MEMORY.md` y el pivot en')
  L.push('> `docs/superpowers/specs/`.')
  L.push('')
  L.push(
    `_Generado: ${today} · commit \`${commit}\` (${commitDate}) · ${pages} páginas, ${handlers} handlers, ${libModules.length} módulos lib, ${tables.length} tablas._`,
  )
  L.push('')

  L.push('## Qué es')
  L.push('')
  L.push(
    'SaaS multi-tenant de reservas para peluquerías/salones (estilo Booksy). Enrutado por',
  )
  L.push(
    'salón vía path (`/[salonSlug]/book`). Locale `es-ES`, zona `Europe/Madrid`, sin i18n.',
  )
  L.push('')
  if (stack.length) {
    L.push('**Stack:** ' + stack.join(' · ') + '.')
    L.push('')
  }

  // Rutas por área.
  L.push('## Rutas (App Router)')
  L.push('')
  for (const area of AREA_ORDER) {
    const inArea = routes.filter((r) => r.area === area)
    if (inArea.length === 0) continue
    L.push(`### ${AREA_META[area].title}`)
    L.push('')
    L.push(`${AREA_META[area].desc}`)
    L.push('')
    L.push('| Ruta | Tipo | Archivo | Co-ubicado |')
    L.push('| --- | --- | --- | --- |')
    for (const r of inArea) {
      const notes = r.notes.length ? r.notes.join(', ') : '—'
      L.push(`| \`${r.url}\` | ${r.kind} | \`${r.file}\` | ${notes} |`)
    }
    L.push('')
  }

  // Módulos lib.
  L.push('## Lógica de negocio (`lib/`)')
  L.push('')
  L.push('| Módulo | Descripción | Ficheros |')
  L.push('| --- | --- | --- |')
  for (const m of libModules) {
    const path = m.isDir ? `lib/${m.name}/` : `lib/${m.name}`
    const files = m.isDir
      ? m.files.length
        ? m.files.join(', ')
        : '—'
      : '—'
    L.push(`| \`${path}\` | ${m.desc} | ${files} |`)
  }
  L.push('')

  // Datos.
  L.push('## Modelo de datos')
  L.push('')
  L.push('Schema Drizzle en `lib/db/schema.ts`. Tablas:')
  L.push('')
  L.push(tables.map((t) => `\`${t}\``).join(' · '))
  L.push('')
  L.push(
    'Migraciones en `drizzle/` (aplicar con `npm run db:migrate`): ' +
      (migrations.length ? migrations.map((m) => `\`${m}\``).join(', ') : '—') +
      '.',
  )
  L.push('')

  // Scripts.
  L.push('## Scripts')
  L.push('')
  L.push('En `scripts/` (correr con `tsx` / vía npm):')
  L.push('')
  for (const s of scripts) L.push(`- \`scripts/${s}\``)
  L.push('')

  // Punteros de documentación.
  L.push('## Dónde seguir')
  L.push('')
  L.push('- **Producto (features + roadmap):** `GUIA_PRODUCTO.md`')
  L.push('- **Decisiones core / memoria:** `MEMORY.md`')
  L.push(
    '- **Rumbo actual (SaaS multi-tenant):** `docs/superpowers/specs/2026-06-30-saas-pivot-design.md`',
  )
  L.push('- **Planes de mejora priorizados:** `plans/README.md`')
  L.push('- **Reglas para agentes:** `AGENTS.md` (Next.js 16 con breaking changes)')
  L.push('')

  const outPath = join(repoRoot, 'Project_Map.md')
  writeFileSync(outPath, L.join('\n'))
  process.stdout.write(
    `Project_Map.md generado: ${pages} páginas, ${handlers} handlers, ${libModules.length} módulos lib, ${tables.length} tablas.\n`,
  )
}

main()
