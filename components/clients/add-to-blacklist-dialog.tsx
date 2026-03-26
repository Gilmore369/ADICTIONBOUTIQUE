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
          {/* Client Selection — combobox con lista filtrada visible */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            {/* Si ya hay uno seleccionado, mostrarlo con opción de cambiar */}
            {selectedClientId ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border border-primary rounded-lg bg-primary/5">
                <span className="text-sm font-medium text-gray-800">
                  ✓ {availableClients.find(c => c.id === selectedClientId)?.name || ''}
                  {(() => {
                    const c = availableClients.find(cl => cl.id === selectedClientId)
                    return c?.dni ? ` — DNI: ${c.dni}` : ''
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedClientId(''); setSearchTerm('') }}
                  className="text-xs text-red-500 hover:text-red-700 underline flex-shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Buscar por nombre o DNI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {/* Lista de resultados visible */}
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-gray-500 text-center">
                      {searchTerm ? 'No se encontraron clientes' : 'Escribe para buscar...'}
                    </p>
                  ) : (
                    filteredClients.slice(0, 30).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => { setSelectedClientId(client.id); setSearchTerm('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between gap-2"
                      >
                        <span className="font-medium">{client.name}</span>
                        <span className="text-gray-400 text-xs flex-shrink-0">
                          {client.dni ? `DNI: ${client.dni}` : ''}
                          {client.credit_used > 0 ? ` · S/ ${client.credit_used.toFixed(0)}` : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
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
