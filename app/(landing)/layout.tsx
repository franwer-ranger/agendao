import type { Metadata } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'
import './landing.css'

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Agendao — Reservas online para peluquerías y barberías',
  description:
    'Agendao es el sistema de reservas online para peluquerías y barberías. Página de reservas propia, agenda del día, recordatorios automáticos y menos clientes que no vienen. Prueba gratis 14 días.',
  openGraph: {
    title: 'Agendao — Reservas online para peluquerías y barberías',
    description:
      'Tu agenda se llena sola, aunque tengas las manos en una melena. Página de reservas propia, agenda del equipo y recordatorios automáticos. Prueba gratis 14 días.',
    type: 'website',
    locale: 'es_ES',
    siteName: 'Agendao',
  },
}

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className={`landing-root ${bricolageGrotesque.variable}`}>
      {children}
    </div>
  )
}
