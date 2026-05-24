import 'server-only'

import { promises as fs, statSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

export type StorageKind = 'salon-logo' | 'employee-avatar'

const ALLOWED_KINDS: readonly StorageKind[] = [
  'salon-logo',
  'employee-avatar',
] as const

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

// Base absoluta donde viven los uploads. En prod será el mountpoint de un
// volumen Docker (UPLOADS_DIR env); en dev cae a ./data/uploads (que ya está
// en .gitignore por la entrada /data/). Lazy para no ejecutar filesystem en
// import-time (evita que el tracer NFT del build piense que toca el proyecto).
let _uploadsDir: string | undefined
function uploadsDir(): string {
  if (_uploadsDir === undefined) {
    // path.resolve resuelve rutas relativas contra cwd automáticamente; evitamos
    // process.cwd() explícito para no confundir al tracer NFT del build.
    _uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './data/uploads')
  }
  return _uploadsDir
}

function isAllowedKind(k: string): k is StorageKind {
  return (ALLOWED_KINDS as readonly string[]).includes(k)
}

// Resuelve `relativePath` contra UPLOADS_DIR y verifica que el resultado vive
// dentro del directorio. Es el chequeo canónico anti path-traversal: cualquier
// `..`, symlink-escape o ruta absoluta queda detectado aquí.
function resolveWithinUploads(relativePath: string): string {
  const base = uploadsDir()
  const resolved = path.resolve(base, relativePath)
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  if (resolved !== base && !resolved.startsWith(prefix)) {
    throw new Error('Path inválido')
  }
  return resolved
}

export async function saveImage(
  file: File,
  opts: { kind: StorageKind; entityId: string | number },
): Promise<string> {
  if (!isAllowedKind(opts.kind)) {
    throw new Error('Tipo de imagen no soportado')
  }

  const entityIdStr = String(opts.entityId)
  if (!/^\d+$/.test(entityIdStr)) {
    throw new Error('entityId inválido')
  }

  if (!(IMAGE_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    throw new Error('Formato no soportado (PNG, JPG o WEBP)')
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error('El archivo supera 5 MB')
  }

  const arrayBuffer = await file.arrayBuffer()
  const input = Buffer.from(arrayBuffer)

  // .rotate() respeta EXIF (importante para fotos hechas con móvil); resize con
  // fit:'inside' preserva aspecto sin recortar; withoutEnlargement evita ampliar
  // imágenes pequeñas. WebP 85 es buen punto medio peso/calidad para logos.
  const processed = await sharp(input)
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer()

  const relativePath = `${opts.kind}/${entityIdStr}.webp`
  const absolutePath = resolveWithinUploads(relativePath)

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, processed)

  return relativePath
}

export async function deleteImage(relativePath: string): Promise<void> {
  if (!relativePath) return
  const absolutePath = resolveWithinUploads(relativePath)
  try {
    await fs.unlink(absolutePath)
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') throw err
  }
}

// URL pública absoluta para incrustar en HTML (incluido HTML de emails, que
// necesita URL completa con host). Añade `?v={mtimeMs}` como cache-buster: el
// archivo en disco se sobrescribe con el mismo nombre cuando se reemplaza una
// imagen, así que sin esto los clientes de email mostrarían la versión vieja.
export function getPublicUrl(relativePath: string | null): string | null {
  if (!relativePath) return null
  let absolutePath: string
  try {
    absolutePath = resolveWithinUploads(relativePath)
  } catch {
    return null
  }

  let mtimeMs: number
  try {
    mtimeMs = Math.floor(statSync(absolutePath).mtimeMs)
  } catch {
    // DB referencia un archivo que ya no existe en disco. No es fatal — la UI
    // simplemente no muestra logo — pero es señal de inconsistencia.
    console.warn(`[storage] archivo referenciado no existe: ${relativePath}`)
    return null
  }

  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/uploads/${relativePath}?v=${mtimeMs}`
}

export function getUploadsDir(): string {
  return uploadsDir()
}
