import { Check, Mail, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Mini-mockups CSS/HTML para las cards de la banda "Funciones". No son
 * capturas reales ni ilustraciones: aproximan la UI del producto con datos
 * de peluquería creíbles, y son donde viven los acentos --mint/--violet/--amber
 * (el resto de la página es negro/blanco/gris). Todos son `aria-hidden`:
 * decorativos, el título + frase de cada card ya dan el contenido accesible.
 */

const SERVICE_CHIPS = ['Corte y barba', 'Balayage', 'Mechas raíz']
const TIME_SLOTS = ['09:00', '10:30', '12:00', '17:30']

export function BookingMockup() {
  return (
    <div aria-hidden className="features-mock features-mock-pad flex flex-col gap-3">
      <p className="text-[11px] font-medium text-[var(--paper-text-secondary)]">
        Reservar en Luna Peluquería
      </p>

      <div className="flex flex-wrap gap-1.5">
        {SERVICE_CHIPS.map((service) => {
          const selected = service === 'Balayage'
          return (
            <span
              key={service}
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
              style={
                selected
                  ? {
                      borderColor: 'var(--mint)',
                      color: '#0b6b45',
                      background: 'rgba(62,207,142,0.12)',
                    }
                  : { borderColor: 'var(--line)', color: 'var(--paper-text-secondary)' }
              }
            >
              {service}
            </span>
          )
        })}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {TIME_SLOTS.map((time) => {
          const selected = time === '10:30'
          return (
            <span
              key={time}
              className="rounded-lg py-1.5 text-center text-[11px] font-medium"
              style={
                selected
                  ? { background: 'var(--mint)', color: '#06301f' }
                  : { background: 'var(--mist)', color: 'var(--paper-text-secondary)' }
              }
            >
              {time}
            </span>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-full bg-[var(--ink)] px-3 py-2 text-white">
        <span className="text-[11px] font-medium">Marta · Balayage · 10:30</span>
        <Check className="h-3.5 w-3.5" style={{ color: 'var(--mint)' }} />
      </div>
    </div>
  )
}

export function ReminderMockup() {
  return (
    <div aria-hidden className="features-mock features-mock-pad flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'rgba(62,207,142,0.14)' }}
        >
          <Mail className="h-3.5 w-3.5" style={{ color: 'var(--mint)' }} />
        </span>
        <span className="text-[11px] font-medium text-[var(--paper-text-secondary)]">
          Recordatorio · hoy 18:04
        </span>
      </div>

      <p className="text-sm font-medium">Mañana a las 10:30</p>
      <p className="text-[12px] text-[var(--paper-text-secondary)]">
        Balayage con Marta — Luna Peluquería
      </p>

      <div className="flex items-center gap-2 pt-1">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ background: 'rgba(62,207,142,0.14)', color: '#0b6b45' }}
        >
          <Check className="h-3 w-3" /> Confirmada
        </span>
        <span className="text-[11px] text-[var(--paper-text-secondary)] underline decoration-dotted">
          Cancelar
        </span>
      </div>
    </div>
  )
}

const SITE_SERVICES = [
  { name: 'Corte y peinado', price: '18 €' },
  { name: 'Balayage', price: '65 €' },
  { name: 'Mechas raíz', price: '55 €' },
]

export function SiteMockup() {
  return (
    <div aria-hidden className="features-mock overflow-hidden">
      <div
        className="flex items-center gap-1.5 border-b px-3 py-2"
        style={{ borderColor: 'var(--line)' }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--line)' }} />
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--line)' }} />
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--line)' }} />
        <span
          className="ml-2 flex-1 truncate rounded-full px-2.5 py-1 text-[11px]"
          style={{ background: 'var(--mist)', color: 'var(--paper-text-secondary)' }}
        >
          agendao.com/luna-peluqueria
        </span>
      </div>

      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Luna Peluquería</p>
          <span className="flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--amber)' }}>
            <Star className="h-3 w-3 fill-current" /> 4.9
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {SITE_SERVICES.map((service) => (
            <div key={service.name} className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--paper-text-secondary)]">{service.name}</span>
              <span className="font-medium">{service.price}</span>
            </div>
          ))}
        </div>

        <span
          className="mt-1 inline-flex w-fit items-center rounded-full px-3 py-1.5 text-[11px] font-medium text-white"
          style={{ background: 'var(--violet)' }}
        >
          Reservar
        </span>
      </div>
    </div>
  )
}

const TEAM = [
  { initials: 'MG', name: 'Marta González', role: 'Color · L–V 9:00–17:00', color: 'var(--mint)' },
  { initials: 'JR', name: 'Javier Ruiz', role: 'Barbería · L–S 10:00–20:00', color: 'var(--violet)' },
  { initials: 'AS', name: 'Ana Soto', role: 'Manicura · M–S 9:00–14:00', color: 'var(--amber)' },
]

export function TeamMockup() {
  return (
    <div aria-hidden className="features-mock features-mock-pad flex flex-col gap-3">
      {TEAM.map((member) => (
        <div key={member.initials} className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ background: member.color }}
          >
            {member.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium">{member.name}</p>
            <p className="truncate text-[11px] text-[var(--paper-text-secondary)]">{member.role}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const DAY_APPOINTMENTS = [
  { time: '09:00', name: 'Ana Soto', service: 'Manicura', color: 'var(--amber)' },
  { time: '10:30', name: 'Marta G.', service: 'Balayage', color: 'var(--mint)' },
  { time: '12:00', name: 'Javier R.', service: 'Arreglo de barba', color: 'var(--violet)' },
  { time: '16:00', name: 'Marta G.', service: 'Corte y peinado', color: 'var(--mint)' },
]

export function DayMockup() {
  return (
    <div aria-hidden className="features-mock features-mock-pad flex h-full flex-col">
      <p className="mb-2 text-[11px] font-medium text-[var(--paper-text-secondary)]">
        Hoy · martes 14
      </p>

      <div className="flex flex-1 flex-col">
        {DAY_APPOINTMENTS.map((appt, index) => {
          const isLast = index === DAY_APPOINTMENTS.length - 1
          return (
            <div key={appt.time + appt.name} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: appt.color }}
                />
                {!isLast && <span className="w-px flex-1" style={{ background: 'var(--line)' }} />}
              </div>
              <div className={cn('pb-4', isLast && 'pb-0')}>
                <p className="text-[11px] font-medium text-[var(--paper-text-secondary)]">
                  {appt.time}
                </p>
                <p className="text-[12px]">
                  <span className="font-medium">{appt.name}</span>
                  <span className="text-[var(--paper-text-secondary)]"> · {appt.service}</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
