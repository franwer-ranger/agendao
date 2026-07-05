import { CalendarDays, Clock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

// Contenido de cada uno de los 3 paneles del mockup del panel de Agendao.
// El índice coincide con el de los highlights en showcase-scroller.tsx.
const SIDEBAR_ICONS = [CalendarDays, Users, Clock]

function AgendaPanel() {
  const employees = [
    {
      name: 'Ana',
      slots: [
        { time: '9:30', label: 'María · Corte', accent: 'mint' },
        null,
        { time: '11:30', label: 'Sofía · Color', accent: 'violet' },
      ],
    },
    {
      name: 'Marc',
      slots: [
        null,
        { time: '10:15', label: 'Iker · Barba', accent: 'amber' },
        { time: '11:30', label: 'Lucía · Corte', accent: 'mint' },
      ],
    },
    {
      name: 'Sole',
      slots: [
        { time: '9:30', label: 'Nuria · Peinado', accent: 'violet' },
        null,
        null,
      ],
    },
  ]

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs font-medium text-white/40">Hoy · jueves</p>
      <div className="grid flex-1 grid-cols-3 gap-2">
        {employees.map((employee) => (
          <div key={employee.name} className="flex flex-col gap-2">
            <p className="text-[11px] font-medium text-white/70">{employee.name}</p>
            {employee.slots.map((slot, index) =>
              slot ? (
                <div
                  key={index}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] leading-tight',
                    slot.accent === 'mint' &&
                      'border-[color:rgba(62,207,142,0.35)] bg-[rgba(62,207,142,0.14)] text-[#8fe8bd]',
                    slot.accent === 'violet' &&
                      'border-[color:rgba(108,92,231,0.35)] bg-[rgba(108,92,231,0.16)] text-[#c3b9fc]',
                    slot.accent === 'amber' &&
                      'border-[color:rgba(255,182,72,0.35)] bg-[rgba(255,182,72,0.14)] text-[#ffd18f]',
                  )}
                >
                  <span className="block font-medium">{slot.time}</span>
                  <span className="block text-white/70">{slot.label}</span>
                </div>
              ) : (
                <div
                  key={index}
                  className="rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-[11px] text-white/25"
                >
                  Hueco libre
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ClientPanel() {
  const visits = [
    { date: '12 jun', label: 'Corte + barba', stylist: 'con Marc' },
    { date: '3 may', label: 'Corte', stylist: 'con Marc' },
    { date: '20 mar', label: 'Color', stylist: 'con Ana' },
  ]

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(108,92,231,0.18)] text-sm font-semibold text-[#c3b9fc]">
          IM
        </div>
        <div>
          <p className="text-sm font-medium text-white">Iker Mendia</p>
          <p className="text-[11px] text-white/45">Cliente habitual · 6 visitas</p>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-[11px] font-medium text-white/40">Historial</p>
        {visits.map((visit) => (
          <div
            key={visit.date}
            className="flex items-center justify-between rounded-lg border border-[color:var(--line)] px-2.5 py-1.5 text-[11px]"
          >
            <span className="text-white/70">{visit.label}</span>
            <span className="text-white/40">
              {visit.date} · {visit.stylist}
            </span>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-[11px] text-white/50">
        Nota: prefiere hora a primera hora de la mañana.
      </div>
    </div>
  )
}

function SchedulePanel() {
  const days = ['L', 'M', 'X', 'J', 'V', 'S']

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs font-medium text-white/40">Horario de Marc</p>
      <div className="grid flex-1 grid-cols-6 gap-1.5">
        {days.map((day, index) => (
          <div
            key={day}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-3 text-[11px]',
              index === 3
                ? 'border-[color:rgba(255,182,72,0.4)] bg-[rgba(255,182,72,0.12)] text-[#ffd18f]'
                : 'border-[color:var(--line)] text-white/60',
            )}
          >
            <span className="font-medium">{day}</span>
            <span className="text-[10px] text-white/40">
              {index === 3 ? 'Ausente' : '9–19h'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[color:rgba(62,207,142,0.3)] bg-[rgba(62,207,142,0.1)] px-2.5 py-2 text-[11px] text-[#8fe8bd]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3ecf8e]" />
        Agenda del jueves reorganizada. Nadie tuvo que llamar.
      </div>
    </div>
  )
}

const PANELS = [AgendaPanel, ClientPanel, SchedulePanel]

export function ShowcaseMockup({
  active,
  variant = 'sticky',
  className,
}: {
  active: number
  variant?: 'sticky' | 'static'
  className?: string
}) {
  return (
    <div className={cn('showcase-window', className)}>
      <div className="showcase-window-bar">
        <span className="showcase-window-dot" />
        <span className="showcase-window-dot" />
        <span className="showcase-window-dot" />
        <span className="ml-2 text-[11px] text-white/30">panel.agendao.com</span>
      </div>
      <div
        className={cn(
          'showcase-window-body',
          variant === 'static' && 'showcase-window-body--static',
        )}
      >
        <div className="showcase-sidebar">
          {SIDEBAR_ICONS.map((Icon, index) => (
            <span
              key={index}
              className="showcase-sidebar-icon"
              data-active={index === active ? 'true' : undefined}
            >
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
            </span>
          ))}
        </div>
        <div className="showcase-panels">
          {variant === 'static' ? (
            <div className="showcase-panel showcase-panel--static">
              {(() => {
                const Panel = PANELS[active]
                return <Panel />
              })()}
            </div>
          ) : (
            PANELS.map((Panel, index) => (
              <div
                key={index}
                className="showcase-panel"
                data-active={index === active ? 'true' : undefined}
                aria-hidden={index === active ? undefined : true}
              >
                <Panel />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
