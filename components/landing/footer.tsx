import Link from 'next/link'
import { Container } from '@/components/landing/container'
import { LOGIN_HREF, SIGNUP_HREF } from '@/components/landing/landing-data'

const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--mint)] rounded-sm'
const FOOTER_LINK = `text-sm text-white/70 transition-colors hover:text-white ${FOCUS_RING}`

export function LandingFooter() {
  return (
    <footer className="band-dark border-t border-[color:var(--line)]">
      <Container className="py-16 md:py-20">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <span className="font-[family-name:var(--font-display)] text-2xl font-semibold lowercase tracking-tight text-white">
              agendao
            </span>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-20">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-white/40">
                Producto
              </h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href="#funciones" className={FOOTER_LINK}>
                    Funciones
                  </a>
                </li>
                <li>
                  <a href="#precio" className={FOOTER_LINK}>
                    Precio
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-white/40">
                Cuenta
              </h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href={LOGIN_HREF} className={FOOTER_LINK}>
                    Iniciar sesión
                  </Link>
                </li>
                <li>
                  <Link href={SIGNUP_HREF} className={FOOTER_LINK}>
                    Empieza gratis
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-[color:var(--line)] pt-6 text-xs text-white/40">
          © 2026 Agendao — Hecho para peluquerías y barberías.
        </div>
      </Container>
    </footer>
  )
}
