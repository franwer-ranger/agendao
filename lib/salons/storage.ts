import { deleteImage, saveImage } from '@/lib/storage'

export async function uploadSalonLogo(
  salonId: number,
  file: File,
): Promise<string> {
  return saveImage(file, { kind: 'salon-logo', entityId: salonId })
}

export async function deleteSalonLogo(path: string): Promise<void> {
  return deleteImage(path)
}
