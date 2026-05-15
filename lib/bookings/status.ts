// Estados de reserva (bloque 8 del PLAN.md). El check constraint en
// `bookings.status` valida exactamente esta unión — mantenerlos sincronizados.
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled_client'
  | 'cancelled_salon'
  | 'no_show'

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled_client: 'Cancelada (cliente)',
  cancelled_salon: 'Cancelada (salón)',
  no_show: 'No-show',
}

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive'

export const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
  pending: 'outline',
  confirmed: 'secondary',
  in_progress: 'default',
  completed: 'secondary',
  cancelled_client: 'destructive',
  cancelled_salon: 'destructive',
  no_show: 'destructive',
}

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'in_progress',
]

export function isActiveStatus(status: BookingStatus): boolean {
  return ACTIVE_BOOKING_STATUSES.includes(status)
}
