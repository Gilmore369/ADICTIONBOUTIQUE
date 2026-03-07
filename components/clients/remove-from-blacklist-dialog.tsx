'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { removeFromBlacklistAction } from '@/actions/clients'
import { toast } from 'sonner'
import { UserCheck, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'

interface BlacklistedClient {
  id: string
  name: string
  dni: string | null
  phone: string | null
  credit_used: number
  blacklisted_reason: string | null
}

interface RemoveFromBlacklistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: BlacklistedClient
  onSuccess: (clientId: string) => void
}

export function RemoveFromBlacklistDialog({ 
  open, 
  onOpenChange, 
  client,
  onSuccess 
}: RemoveFromBlacklistDialogProps) {
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSubmitting(true)

    try {
      const result = await removeFromBlacklistAction({
        clientId: client.id,
        notes: notes.trim() || null
      })

      if (result.success) {
        toast.success('Cliente desbloqueado', 'Ahora puede realizar compras a crédito')
        onSuccess(client.id)
        onOpenChange(false)
        setNotes('')
      } else {
        toast.error(result.error || 'Error al desbloquear cliente')
      }
    } catch (error) {
      console.error('Error removing from blacklist:', error)
      toast.error('Error al desbloquear cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getReasonLabel = (reason: string | null) => {
    const reasonMap: Record<string, string> = {
      'DEUDA_EXCESIVA': 'Deuda Excesiva',
      'NO_PAGA': 'No Paga',
      'DECISION_GERENCIA': 'Decisión de Gerencia',
      'MAL_COMPORTAMIENTO': 'Mal Comportamiento',
      'OTRO': 'Otro'
    }
    return reason ? reasonMap[reason] || reason : 'No especificado'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-600" />
            Desbloquear Cliente
          </DialogTitle>
          <DialogDescription>
            El cliente podrá volver a realizar compras a crédito
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{client.name}</p>
              {client.dni && (
                <p className="text-xs text-gray-600">DNI: {client.dni}</p>
              )}
              {client.phone && (
                <p className="text-xs text-gray-600">Tel: {client.phone}</p>
              )}
            </div>
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                Motivo de bloqueo: <span className="font-medium">{getReasonLabel(client.blacklisted_reason)}</span>
              </p>
              {client.credit_used > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  Deuda actual: <span className="font-medium text-red-600">{formatCurrency(client.credit_used)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Motivo del Desbloqueo (Opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Deuda saldada, autorización gerencial, etc..."
              rows={3}
            />
          </div>

          {/* Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              Al desbloquear, el cliente podrá realizar compras a crédito nuevamente.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-2 bg-green-600 hover:bg-green-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Desbloqueando...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Desbloquear Cliente
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
