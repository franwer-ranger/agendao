import type { SupabaseClient } from '@supabase/supabase-js'

export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'empleado'
  )
}

export async function resolveUniqueEmployeeSlug(
  supabase: SupabaseClient,
  salonId: number,
  desired: string,
  excludeId?: number,
): Promise<string> {
  const base = slugify(desired)
  let candidate = base
  let n = 1

  while (true) {
    let query = supabase
      .from('employees')
      .select('id', { head: true, count: 'exact' })
      .eq('salon_id', salonId)
      .eq('slug', candidate)

    if (excludeId !== undefined) {
      query = query.neq('id', excludeId)
    }

    const { count, error } = await query
    if (error) throw error
    if (!count) return candidate

    n += 1
    candidate = `${base}-${n}`
  }
}
