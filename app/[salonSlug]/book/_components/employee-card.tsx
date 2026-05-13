import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { PublicEmployeeRow } from '@/lib/employees/queries'

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '·'
}

export function EmployeeCard({
  employee,
  href,
}: {
  employee: PublicEmployeeRow
  href: string
}) {
  return (
    <Link
      href={href}
      aria-label={`Elegir a ${employee.display_name}`}
      className={cn(
        'block rounded-xl outline-none transition',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Card className="min-h-[88px] transition-colors hover:bg-accent/50">
        <CardContent className="flex items-start gap-4 px-4 py-4">
          <div
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {initialsFromName(employee.display_name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight">
              {employee.display_name}
            </h3>
            {employee.bio ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {employee.bio}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
