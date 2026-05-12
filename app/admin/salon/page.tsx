import { notFound } from 'next/navigation'

import { getCurrentSalon } from '@/lib/salon'
import {
  getLogoPublicUrl,
  getSalonClosures,
  getSalonSettings,
  getSalonWorkingHours,
} from '@/lib/salons/queries'
import { SalonTabs } from './_components/salon-tabs'

export default async function SalonConfigPage() {
  const current = await getCurrentSalon()
  const [settings, hours, closures] = await Promise.all([
    getSalonSettings(current.id),
    getSalonWorkingHours(current.id),
    getSalonClosures(current.id, { includePast: false }),
  ])

  if (!settings) {
    notFound()
  }

  const logoUrl = getLogoPublicUrl(settings.logo_path)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Salón</h1>
        <p className="text-sm text-muted-foreground">
          Configura los datos públicos del salón, el horario, las reglas de
          reserva y los textos que ve el cliente.
        </p>
      </div>

      <SalonTabs
        settings={settings}
        logoUrl={logoUrl}
        workingHours={hours}
        closures={closures}
      />
    </div>
  )
}
