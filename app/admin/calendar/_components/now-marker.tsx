'use client'

// Línea horizontal con pill de hora, estilo Apple Calendar. Se renderiza
// como hijo absoluto del contenedor que actúe como referencia: en day-view,
// cruza todo el grid; en week-view, solo la columna del día actual.
//
// El consumidor decide el `top` absoluto y si el pill aparece (en day-view
// va a la izquierda sobre el rail; en week-view se oculta porque ya hay
// rail global con su propia marca).
export function NowMarker({
  top,
  label,
  showLabel = true,
}: {
  top: number
  label: string
  showLabel?: boolean
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top, transform: 'translateY(-50%)' }}
    >
      {showLabel ? (
        <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm tabular-nums">
          {label}
        </span>
      ) : (
        <span className="size-3 shrink-0 rounded-full bg-red-500" />
      )}
      <div className="h-0.5 flex-1 bg-red-500/90" />
    </div>
  )
}
