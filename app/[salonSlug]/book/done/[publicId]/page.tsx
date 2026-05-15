import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPublicBookingByPublicId } from '@/lib/bookings/queries'
import { getSalonBySlug } from '@/lib/salons/queries'
import { BookingSummary } from '../../_components/summary'
import { ClearBookingFormStorage } from '../../_components/clear-booking-form-storage'

// El publicId es un UUID v4. Cualquier cosa que no encaje devuelve 404 sin
// llegar a tocar la BD.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function DoneStepPage({
  params,
}: {
  params: Promise<{ salonSlug: string; publicId: string }>
}) {
  const { salonSlug, publicId } = await params
  if (!UUID_REGEX.test(publicId)) notFound()

  const salon = await getSalonBySlug(salonSlug)
  if (!salon) notFound()

  const booking = await getPublicBookingByPublicId({
    salonId: salon.id,
    publicId,
  })
  if (!booking) notFound()

  const cancelled = booking.status.startsWith('cancelled')

  return (
    <section
      aria-labelledby="done-step-heading"
      className="space-y-5 text-center"
    >
      <ClearBookingFormStorage salonSlug={salonSlug} />
      <div className="flex flex-col items-center gap-3">
        <CheckCircle2
          aria-hidden
          className="size-12 text-primary"
          strokeWidth={1.5}
        />
        <h2 id="done-step-heading" className="text-2xl font-semibold">
          {cancelled ? 'Reserva cancelada' : '¡Reserva confirmada!'}
        </h2>
        {!cancelled ? (
          <p className="max-w-sm text-sm text-muted-foreground">
            {booking.clientHasEmail
              ? 'Te hemos enviado un correo con la confirmación y un enlace para gestionar tu reserva.'
              : 'Guarda esta página: aquí están los datos de tu reserva. Te avisaremos por teléfono si surge cualquier cambio.'}
          </p>
        ) : null}
      </div>

      <div className="text-left">
        <BookingSummary
          serviceName={booking.serviceName}
          durationMinutes={booking.durationMinutes}
          priceCents={booking.priceCents}
          employeeName={booking.employeeName}
          startsAt={booking.startsAt}
          timezone={salon.timezone}
        />
      </div>

      {!cancelled && salon.cancellation_policy_text ? (
        <details className="rounded-lg border bg-muted/40 px-3 py-2 text-left text-sm">
          <summary className="cursor-pointer select-none font-medium">
            Política de cancelación
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {salon.cancellation_policy_text}
          </p>
        </details>
      ) : null}

      <div className="flex flex-col items-center gap-2 pt-2">
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href={`/${salonSlug}/book/service`}>Reservar otra cita</Link>
        </Button>
      </div>
    </section>
  )
}
