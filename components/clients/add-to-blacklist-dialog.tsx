'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addToBlacklistAction } from '@/actions/clients'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Client {
  id: string
  dni: string | null
  name: string
  phone: string | null
  credit_used: number
}

interface AddToBlacklistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableClients: Client[]
  onSuccess: (clientId: string, reason: string) => void
}

const BLACKLIST_REASONS = [
  { value: 'DEUDA_EXCESIVA', label: 'Deuda Excesiva' },
  { value: 'NO_PAGA', label: 'No Paga' },
  { value: 'DECISION_GERENCIA', label: 'Decisión de Gerencia' },
  { value: 'MAL_COMPORTAMIENTO', label: 'Mal Comportamiento' },
  { value: 'OTRO', label: 'Otro' }
]

export function AddToBlacklistDialog({ 
  open, 
  onOpenChange, 
  availableClients,
  onSuccess 
}: AddToBlacklistDialogProps) {
  const [selectedClientId, setSelectedClientId] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredClients = availableClients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.dni?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedClientId) {
      toast.error('Selecciona un cliente')
      return
    }

    if (!reason) {
      toast.error('Selecciona un motivo')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await addToBlacklistAction({
        clientId: selectedClientId,
        reason,
        notes: notes.trim() || null
      })

      if (result.success) {
        toast.success('Cliente agregado a lista negra')
        onSuccess(selectedClientId, reason)
        onOpenChange(false)
        // Reset form
        setSelectedClientId('')
        setReason('')
        setNotes('')
        setSearchTerm('')
      } else {
        toast.error(result.error || 'Error al agregar a lista negra')
      }
    } catch (error) {
      console.error('Error adding to blacklist:', error)
      toast.error('Error al agregar a lista negra')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Agregar Cliente a Lista Negra
          </DialogTitle>
          <DialogDescription>
            El cliente no podrá realizar compras a crédito hasta que sea desbloqueado
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client-search">Buscar Cliente</Label>
            <input
              id="client-search"
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Cliente *</Label>
            <select
              id="client"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            >
              <option value="">Seleccionar cliente...</option>
              {filteredClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.dni ? `- DNI: ${client.dni}` : ''} 
                  {client.credit_used > 0 ? ` - Deuda: S/ ${client.credit_used.toFixed(2)}` : ''}
                </option>
              ))}
            </select>
            {filteredClients.length === 0 && searchTerm && (
              <p className="text-xs text-gray-500">No se encontraron clientes</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo *</Label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            >
              <option value="">Seleccionar motivo...</option>
              {BLACKLIST_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales (Opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales sobre el bloqueo..."
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>Advertencia:</strong> El cliente no podrá realizar compras a crédito hasta que sea desbloqueado manualmente.
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
              variant="destructive"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Agregando...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Agregar a Lista Negra
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
