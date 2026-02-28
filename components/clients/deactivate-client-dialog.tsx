'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import { deactivateClientAction } from '@/actions/clients'

interface DeactivateClientDialogProps {
  clientId: string
  clientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DeactivationReason = 'FALLECIDO' | 'MUDADO' | 'DESAPARECIDO' | 'OTRO'

export function DeactivateClientDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: DeactivateClientDialogProps) {
  const [reason, setReason] = useState<DeactivationReason | ''>('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Error', 'Debe seleccionar un motivo de baja')
      return
    }

    // Show confirmation
    const confirmed = confirm(
      `¿Está seguro de dar de baja al cliente "${clientName}"?\n\nEsta acción marcará al cliente como inactivo pero preservará todo su historial.`
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await deactivateClientAction({
        clientId,
        reason,
        notes: notes || null
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Error al dar de baja al cliente')
      }
      
      toast.success(
        'Cliente dado de baja',
        `El cliente "${clientName}" ha sido dado de baja correctamente.`
      )
      
      // Reset form
      setReason('')
      setNotes('')
      onOpenChange(false)
      
      // Refresh the page
      router.refresh()
    } catch (error) {
      console.error('Error deactivating client:', error)
      toast.error(
        'Error',
        error instanceof Error ? error.message : 'No se pudo dar de baja al cliente'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setReason('')
    setNotes('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dar de Baja Cliente</DialogTitle>
          <DialogDescription>
            Marcar al cliente "{clientName}" como inactivo. El historial se preservará.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Select */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo de Baja <span className="text-red-500">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as DeactivationReason)}
            >
              <SelectTrigger id="reason">
                <SelectValue placeholder="Seleccione un motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FALLECIDO">Fallecido</SelectItem>
                <SelectItem value="MUDADO">Mudado</SelectItem>
                <SelectItem value="DESAPARECIDO">Desaparecido</SelectItem>
                <SelectItem value="OTRO">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes Textarea */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Información adicional sobre la baja..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Warning Message */}
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800">
              <strong>Importante:</strong> El cliente no podrá realizar nuevas compras,
              pero todo su historial de compras, créditos y pagos se preservará.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason}
          >
            {isSubmitting ? 'Procesando...' : 'Dar de Baja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
