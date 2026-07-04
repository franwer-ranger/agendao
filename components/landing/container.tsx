import { cn } from '@/lib/utils'

export function Container({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('max-w-6xl mx-auto px-4 sm:px-6', className)}>
      {children}
    </div>
  )
}
