import Link from 'next/link'

import { getCurrentSalon } from '@/lib/salon'
import { listServices } from '@/lib/services/queries'
import { formatPriceEur } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleActiveButton } from './_components/toggle-active-button'

type SearchParams = { q?: string }

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q } = await searchParams
  const salon = await getCurrentSalon()
  const rows = await listServices({ salonId: salon.id, q })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de servicios del salón. Desactiva los que no se ofrezcan
            actualmente; las reservas existentes se mantienen.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/services/new">Nuevo servicio</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/admin/services">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre…"
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
        {q ? (
          <Button asChild variant="ghost">
            <Link href="/admin/services">Limpiar</Link>
          </Button>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Capacidad</TableHead>
              <TableHead className="text-right">Empleados</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  {q
                    ? 'Ningún servicio coincide con la búsqueda.'
                    : 'Aún no hay servicios.'}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((s) => (
              <TableRow key={s.id} className={s.is_active ? '' : 'opacity-60'}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.duration_minutes} min
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPriceEur(s.price_cents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.max_concurrent ?? '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.employee_count}
                </TableCell>
                <TableCell>
                  {s.is_active ? (
                    <Badge variant="secondary">Activo</Badge>
                  ) : (
                    <Badge variant="outline">Inactivo</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/services/${s.id}/edit`}>Editar</Link>
                    </Button>
                    <ToggleActiveButton
                      id={s.id}
                      name={s.name}
                      isActive={s.is_active}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
