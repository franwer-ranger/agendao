import Link from 'next/link'
import { cn } from '@/lib/utils'

type PillButtonVariant = 'white' | 'dark' | 'ghost-dark' | 'ghost-light'
type PillButtonSize = 'md' | 'lg'

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--mint)]'

const sizeClasses: Record<PillButtonSize, string> = {
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base md:text-lg px-7 py-3.5',
}

// white: CTA primario sobre banda oscura (el píxel más brillante de la página).
// dark: CTA primario invertido sobre banda blanca.
// ghost-dark / ghost-light: secundarios de bajo énfasis para cada banda.
const variantClasses: Record<PillButtonVariant, string> = {
  white: 'bg-white text-[var(--ink)] hover:bg-white/90',
  dark: 'bg-[var(--ink)] text-white hover:bg-[var(--ink)]/85',
  'ghost-dark':
    'bg-transparent text-white/90 border border-[color:var(--line)] hover:text-white hover:bg-white/10',
  'ghost-light':
    'bg-transparent text-[var(--ink)] border border-[color:var(--line)] hover:bg-black/[0.04]',
}

type PillButtonBaseProps = {
  variant?: PillButtonVariant
  size?: PillButtonSize
  className?: string
  children: React.ReactNode
}

type PillButtonAsLink = PillButtonBaseProps & {
  href: string
  target?: string
  rel?: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}

type PillButtonAsButton = PillButtonBaseProps & {
  href?: undefined
  type?: 'button' | 'submit' | 'reset'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  'aria-label'?: string
}

export type PillButtonProps = PillButtonAsLink | PillButtonAsButton

export function PillButton(props: PillButtonProps) {
  const { variant = 'dark', size = 'md', className, children } = props
  const classes = cn(baseClasses, sizeClasses[size], variantClasses[variant], className)

  if (typeof props.href === 'string') {
    const { href, target, rel, onClick } = props
    return (
      <Link href={href} target={target} rel={rel} onClick={onClick} className={classes}>
        {children}
      </Link>
    )
  }

  const { type = 'button', onClick, disabled, 'aria-label': ariaLabel } = props
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={classes}
    >
      {children}
    </button>
  )
}
