import Link from 'next/link'

import { getCurrentSalon } from '@/lib/salon'
import { listEmployees } from '@/lib/employees/queries'
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

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q } = await searchParams
  const salon = await getCurrentSalon()
  const rows = await listEmployees({ salonId: salon.id, q })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Empleados</h1>
          <p className="text-sm text-muted-foreground">
            Equipo del salón. Desactiva los que no estén disponibles; las
            reservas existentes se mantienen.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/employees/new">Nuevo empleado</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/admin/employees">
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
            <Link href="/admin/employees">Limpiar</Link>
          </Button>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Orden</TableHead>
              <TableHead className="text-right">Servicios</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  {q
                    ? 'Ningún empleado coincide con la búsqueda.'
                    : 'Aún no hay empleados.'}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((e) => (
              <TableRow key={e.id} className={e.is_active ? '' : 'opacity-60'}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full border"
                      style={{
                        backgroundColor: e.color_hex ?? 'transparent',
                      }}
                    />
                    {e.display_name}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.display_order}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.service_count}
                </TableCell>
                <TableCell>
                  {e.is_active ? (
                    <Badge variant="secondary">Activo</Badge>
                  ) : (
                    <Badge variant="outline">Inactivo</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/employees/${e.id}/edit`}>Editar</Link>
                    </Button>
                    <ToggleActiveButton
                      id={e.id}
                      name={e.display_name}
                      isActive={e.is_active}
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
