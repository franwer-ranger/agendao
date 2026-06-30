import { DEFAULT_SERVICE_TEMPLATE } from '@/lib/setup/service-template'

export type ShiftDraft = {
  weekday: number
  starts_at: string
  ends_at: string
}

export type ServiceDraft = {
  name: string
  duration_minutes: number
  price_cents: number
}

export type EmployeeDraft = {
  display_name: string
  color_hex: string | null
  weeklySchedule: ShiftDraft[]
}

export type DayHoursDraft = {
  weekday: number
  closed: boolean
  opens_at: string
  closes_at: string
}

export type WizardDraft = {
  step: number
  admin: {
    email: string
    password: string
    passwordConfirm: string
    display_name: string
  }
  salon: {
    slug: string
    slugManuallyEdited: boolean
    identity: {
      name: string
      address: string
      phone: string
      contact_email: string
    }
    workingHours: { days: DayHoursDraft[] }
    cancellation: {
      cancellation_min_hours: number
      cancellation_policy_text: string
    }
    legal: { terms_text: string }
  }
  services: ServiceDraft[]
  employees: EmployeeDraft[]
  // matrix[serviceIdx][employeeIdx] — true = ese empleado puede hacer ese servicio.
  matrix: boolean[][]
}

export const TOTAL_STEPS = 7

export const STEP_TITLES = [
  'Bienvenida',
  'Tu cuenta',
  'Tu salón',
  'Servicios',
  'Empleados',
  'Quién hace qué',
  'Revisar y crear',
] as const

export const EMPLOYEE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
] as const

const DEFAULT_DAYS: DayHoursDraft[] = [
  { weekday: 1, closed: false, opens_at: '09:00', closes_at: '19:00' },
  { weekday: 2, closed: false, opens_at: '09:00', closes_at: '19:00' },
  { weekday: 3, closed: false, opens_at: '09:00', closes_at: '19:00' },
  { weekday: 4, closed: false, opens_at: '09:00', closes_at: '19:00' },
  { weekday: 5, closed: false, opens_at: '09:00', closes_at: '19:00' },
  { weekday: 6, closed: false, opens_at: '09:00', closes_at: '14:00' },
  { weekday: 7, closed: true, opens_at: '', closes_at: '' },
]

export function makeDefaultDraft(): WizardDraft {
  const services = DEFAULT_SERVICE_TEMPLATE.map((s) => ({ ...s }))
  return {
    step: 0,
    admin: { email: '', password: '', passwordConfirm: '', display_name: '' },
    salon: {
      slug: '',
      slugManuallyEdited: false,
      identity: { name: '', address: '', phone: '', contact_email: '' },
      workingHours: { days: DEFAULT_DAYS.map((d) => ({ ...d })) },
      cancellation: {
        cancellation_min_hours: 12,
        cancellation_policy_text: '',
      },
      legal: { terms_text: '' },
    },
    services,
    employees: [],
    matrix: services.map(() => []),
  }
}

// La contraseña no se persiste en localStorage (no queremos plaintext en disco).
export function sanitizeDraftForStorage(draft: WizardDraft): WizardDraft {
  return {
    ...draft,
    admin: { ...draft.admin, password: '', passwordConfirm: '' },
  }
}

// Ajusta la matrix al tamaño actual de servicios × empleados. Defaults a true
// para combinaciones nuevas (todos hacen todo); preserva los unticks del admin.
export function resizeMatrix(
  matrix: boolean[][],
  services: number,
  employees: number,
): boolean[][] {
  const out: boolean[][] = []
  for (let s = 0; s < services; s++) {
    const row: boolean[] = []
    for (let e = 0; e < employees; e++) {
      const existing = matrix[s]?.[e]
      row.push(existing === undefined ? true : existing)
    }
    out.push(row)
  }
  return out
}
