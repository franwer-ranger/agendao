import { notFound } from 'next/navigation'
import { getSalonBySlug } from '@/lib/salons/queries'
import { listPublicServices } from '@/lib/services/queries'
import { ServiceCard } from '../_components/service-card'

export default async function ServiceStepPage({
  params,
}: {
  params: Promise<{ salonSlug: string }>
}) {
  const { salonSlug } = await params
  const salon = await getSalonBySlug(salonSlug)
  if (!salon) notFound()

  const services = await listPublicServices(salon.id)

  return (
    <section aria-labelledby="service-step-heading" className="space-y-4">
      <header className="space-y-1">
        <h2 id="service-step-heading" className="text-xl font-semibold">
          ¿Qué servicio quieres reservar?
        </h2>
        <p className="text-sm text-muted-foreground">
          Elige uno para continuar.
        </p>
      </header>

      {services.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Este salón aún no tiene servicios disponibles. Vuelve más tarde.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {services.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} salonSlug={salonSlug} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
