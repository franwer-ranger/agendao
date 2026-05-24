import { promises as fs } from 'node:fs'
import path from 'node:path'

import { getUploadsDir } from '@/lib/storage'

const ALLOWED_KINDS = new Set(['salon-logo', 'employee-avatar'])
const FILENAME_RE = /^\d+\.webp$/

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params

  if (
    !Array.isArray(segments) ||
    segments.length !== 2 ||
    !ALLOWED_KINDS.has(segments[0]) ||
    !FILENAME_RE.test(segments[1])
  ) {
    return new Response('Bad Request', { status: 400 })
  }

  // Defensa final: aunque la regex ya bloquea '..' en el filename y el kind
  // está en allowlist, validamos containment del path resuelto. Cinturón +
  // tirantes — barato y elimina cualquier escape sutil (symlinks, etc).
  const uploadsDir = getUploadsDir()
  const prefix = uploadsDir.endsWith(path.sep)
    ? uploadsDir
    : uploadsDir + path.sep
  const resolved = path.resolve(uploadsDir, segments[0], segments[1])
  if (!resolved.startsWith(prefix)) {
    return new Response('Bad Request', { status: 400 })
  }

  let buffer: Buffer
  try {
    buffer = await fs.readFile(resolved)
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      return new Response('Not Found', { status: 404 })
    }
    throw err
  }

  // La URL siempre incluye `?v={mtimeMs}` (ver lib/storage.ts → getPublicUrl),
  // así que cada versión es una URL distinta y podemos marcarla como immutable.
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
