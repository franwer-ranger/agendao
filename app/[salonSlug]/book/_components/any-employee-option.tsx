import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AnyEmployeeOption({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Cualquier profesional disponible"
      className={cn(
        'block rounded-xl outline-none transition',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Card className="min-h-[88px] border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
        <CardContent className="flex items-start gap-4 px-4 py-4">
          <div
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground"
          >
            ★
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight">
              Cualquier profesional
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Elegimos el que tenga hueco antes. Suele dar más opciones de
              horario.
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
