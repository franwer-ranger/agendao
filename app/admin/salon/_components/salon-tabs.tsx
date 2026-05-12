'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  SalonClosure,
  SalonSettings,
  SalonWorkingDay,
} from '@/lib/salons/queries'

import { BookingsForm } from './bookings-form'
import { CancellationForm } from './cancellation-form'
import { HoursForm } from './hours-form'
import { IdentityForm } from './identity-form'
import { LegalForm } from './legal-form'

export function SalonTabs({
  settings,
  logoUrl,
  workingHours,
  closures,
}: {
  settings: SalonSettings
  logoUrl: string | null
  workingHours: SalonWorkingDay[]
  closures: SalonClosure[]
}) {
  return (
    <Tabs defaultValue="identity">
      <TabsList>
        <TabsTrigger value="identity">Identidad</TabsTrigger>
        <TabsTrigger value="hours">Horario</TabsTrigger>
        <TabsTrigger value="bookings">Reservas</TabsTrigger>
        <TabsTrigger value="cancellation">Cancelación</TabsTrigger>
        <TabsTrigger value="legal">Legal</TabsTrigger>
      </TabsList>

      <TabsContent value="identity">
        <IdentityForm
          defaults={{
            name: settings.name,
            address: settings.address ?? '',
            phone: settings.phone ?? '',
            contact_email: settings.contact_email ?? '',
          }}
          logoUrl={logoUrl}
        />
      </TabsContent>

      <TabsContent value="hours">
        <HoursForm workingHours={workingHours} closures={closures} />
      </TabsContent>

      <TabsContent value="bookings">
        <BookingsForm
          defaults={{
            slot_granularity_minutes: settings.slot_granularity_minutes,
            booking_min_hours_ahead: settings.booking_min_hours_ahead,
            booking_max_days_ahead: settings.booking_max_days_ahead,
          }}
        />
      </TabsContent>

      <TabsContent value="cancellation">
        <CancellationForm
          defaults={{
            cancellation_min_hours: settings.cancellation_min_hours,
            cancellation_policy_text: settings.cancellation_policy_text ?? '',
          }}
        />
      </TabsContent>

      <TabsContent value="legal">
        <LegalForm defaults={{ terms_text: settings.terms_text ?? '' }} />
      </TabsContent>
    </Tabs>
  )
}
