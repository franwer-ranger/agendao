'use client'

import { useEffect } from 'react'

// Limpia la copia local de los datos del form de booking cuando el usuario
// llega a la pantalla de confirmación. Evita prefill con datos de la reserva
// anterior si otra persona usa el mismo navegador.
export function ClearBookingFormStorage({ salonSlug }: { salonSlug: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(`agendao:booking-details:${salonSlug}`)
    } catch {
      // sessionStorage puede no estar disponible (modo privado, cuota). No pasa nada.
    }
  }, [salonSlug])
  return null
}
