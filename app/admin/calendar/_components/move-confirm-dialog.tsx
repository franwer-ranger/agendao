'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatSalonDate, formatSalonTime } from '@/lib/time'

export type MovePreview = {
  bookingId: number
  serviceName: string
  clientName: string
  hasEmail: boolean
  previousStartsAt: string
  newStartsAt: string
  newEmployeeName: string | null
  newEmployeeId?: number
}

// Dialog que aparece tras un drop válido. Tres opciones:
// - "Mover y notificar" → confirma + dispara email de reschedule.
// - "Mover sin avisar"  → confirma sin email.
// - "Cancelar"          → revierte el optimistic update.
export function MoveConfirmDialog({
  preview,
  onConfirm,
  onCancel,
  pending,
}: {
  preview: MovePreview | null
  onConfirm: (notify: boolean) => void
  onCancel: () => void
  pending: boolean
}) {
  const open = preview !== null
  const sameDay =
    preview &&
    formatSalonDate(preview.previousStartsAt) ===
      formatSalonDate(preview.newStartsAt)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !pending) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        {preview ? (
          <>
            <DialogHeader>
              <DialogTitle>Mover cita</DialogTitle>
              <DialogDescription>
                {preview.serviceName} · {preview.clientName}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 text-sm">
              <Row
                label="Antes"
                value={`${formatSalonDate(preview.previousStartsAt)} · ${formatSalonTime(preview.previousStartsAt)}`}
              />
              <Row
                label="Ahora"
                value={`${sameDay ? '' : formatSalonDate(preview.newStartsAt) + ' · '}${formatSalonTime(preview.newStartsAt)}`}
              />
              {preview.newEmployeeName ? (
                <Row label="Empleado" value={preview.newEmployeeName} />
              ) : null}
              {!preview.hasEmail ? (
                <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  El cliente no tiene email registrado; no se podrá enviar
                  aviso.
                </p>
              ) : null}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onConfirm(false)}
                >
                  Mover sin avisar
                </Button>
                <Button
                  size="sm"
                  disabled={pending || !preview.hasEmail}
                  onClick={() => onConfirm(true)}
                >
                  {pending ? 'Moviendo…' : 'Mover y notificar'}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  )
}
