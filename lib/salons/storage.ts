import { createAdminClient } from '@/lib/supabase/admin'
import { validateLogoFile } from '@/lib/salons/schema'

const BUCKET = 'salon-assets'

export async function uploadSalonLogo(
  salonId: number,
  file: File,
): Promise<string> {
  const err = validateLogoFile(file)
  if (err) throw new Error(err)

  const supabase = createAdminClient()
  const ext = inferExtension(file)
  const path = `salons/${salonId}/logo-${Date.now()}${ext}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '3600',
    })

  if (error) throw new Error(error.message)
  return data.path
}

export async function deleteSalonLogo(path: string): Promise<void> {
  if (!path) return
  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  // El delete idempotente: si el archivo no existe, no es un error real.
  if (error && !/not.*found/i.test(error.message)) {
    throw new Error(error.message)
  }
}

function inferExtension(file: File): string {
  if (file.type === 'image/png') return '.png'
  if (file.type === 'image/jpeg') return '.jpg'
  if (file.type === 'image/webp') return '.webp'
  if (file.type === 'image/svg+xml') return '.svg'
  const dot = file.name.lastIndexOf('.')
  return dot >= 0 ? file.name.slice(dot) : ''
}
