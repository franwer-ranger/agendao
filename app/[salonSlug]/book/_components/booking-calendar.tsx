'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { es } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import {
  formatLocalDateLong,
  formatLocalTime,
  isoDateInTimezone,
} from '../_lib/format'

type Slot = {
  startsAt: string
  endsAt: string
  employeeId: number
}

type Props = {
  salonSlug: string
  serviceId: number
  originalEmployeeChoice: string // 'any' | número como string
  timezone: string
  slotsByDate: Record<string, Slot[]>
  /** 'YYYY-MM-DD' (TZ del salón) que debe quedar seleccionado al cargar. */
  initialDateKey?: string
  /** 'YYYY-MM-DD' (TZ del salón) primer día permitido (hoy). */
  minDateKey: string
  /** 'YYYY-MM-DD' (TZ del salón) último día permitido. */
  maxDateKey: string
}

// Convierte 'YYYY-MM-DD' en un Date al mediodía UTC del mismo día calendar.
// Mediodía evita cualquier salto de DST al renderizar en la TZ del salón.
function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`)
}

export function BookingCalendar({
  salonSlug,
  serviceId,
  originalEmployeeChoice,
  timezone,
  slotsByDate,
  initialDateKey,
  minDateKey,
  maxDateKey,
}: Props) {
  const router = useRouter()

  const availableKeys = React.useMemo(
    () => new Set(Object.keys(slotsByDate)),
    [slotsByDate],
  )

  const fallbackKey = React.useMemo(() => {
    if (initialDateKey && availableKeys.has(initialDateKey))
      return initialDateKey
    const sorted = [...availableKeys].sort()
    return sorted[0]
  }, [initialDateKey, availableKeys])

  const [selectedKey, setSelectedKey] = React.useState<string | undefined>(
    fallbackKey,
  )

  const selectedDate = selectedKey ? dateFromKey(selectedKey) : undefined
  const slots = selectedKey ? (slotsByDate[selectedKey] ?? []) : []

  const minDate = dateFromKey(minDateKey)
  const maxDate = dateFromKey(maxDateKey)

  const isDisabled = React.useCallback(
    (date: Date): boolean => {
      const key = isoDateInTimezone(date, timezone)
      if (key < minDateKey) return true
      if (key > maxDateKey) return true
      return !availableKeys.has(key)
    },
    [availableKeys, maxDateKey, minDateKey, timezone],
  )

  function handleSelect(date: Date | undefined) {
    if (!date) return setSelectedKey(undefined)
    setSelectedKey(isoDateInTimezone(date, timezone))
  }

  function handleSlotClick(slot: Slot) {
    const params = new URLSearchParams({
      serviceId: String(serviceId),
      employeeId: String(slot.employeeId),
      originalEmployeeChoice,
      startsAt: slot.startsAt,
    })
    router.push(`/${salonSlug}/book/details?${params.toString()}`)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-2 md:p-4">
        <Calendar
          mode="single"
          locale={es}
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={isDisabled}
          startMonth={minDate}
          endMonth={maxDate}
          defaultMonth={selectedDate ?? minDate}
          weekStartsOn={1}
          showOutsideDays={false}
          className="mx-auto"
        />
      </div>

      <div aria-live="polite">
        {selectedKey ? (
          <>
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              {capitalize(
                formatLocalDateLong(dateFromKey(selectedKey), timezone),
              )}
            </p>
            {slots.length === 0 ? (
              <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                Sin horarios disponibles para este día.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <li key={`${slot.startsAt}-${slot.employeeId}`}>
                    <button
                      type="button"
                      onClick={() => handleSlotClick(slot)}
                      className={cn(
                        'flex h-12 w-full items-center justify-center rounded-lg border bg-card text-sm font-semibold tabular-nums',
                        'transition-colors hover:bg-primary hover:text-primary-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        'active:translate-y-px',
                      )}
                    >
                      {formatLocalTime(slot.startsAt, timezone)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : availableKeys.size === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            No hay disponibilidad en los próximos días. Vuelve más tarde.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Selecciona un día para ver los horarios disponibles.
          </p>
        )}
      </div>
    </div>
  )
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}
