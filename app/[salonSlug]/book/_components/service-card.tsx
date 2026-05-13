import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDuration, formatPriceEUR } from '../_lib/format'
import type { PublicServiceRow } from '@/lib/services/queries'

export function ServiceCard({
  service,
  salonSlug,
}: {
  service: PublicServiceRow
  salonSlug: string
}) {
  const href = `/${salonSlug}/book/employee?serviceId=${service.id}`

  return (
    <Link
      href={href}
      aria-label={`Elegir ${service.name}`}
      className={cn(
        'block rounded-xl outline-none transition',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Card className="min-h-[88px] transition-colors hover:bg-accent/50">
        <CardContent className="flex items-start justify-between gap-4 px-4 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight">
              {service.name}
            </h3>
            {service.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {service.description}
              </p>
            ) : null}
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {formatDuration(service.duration_minutes)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-semibold tabular-nums">
              {formatPriceEUR(service.price_cents)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
