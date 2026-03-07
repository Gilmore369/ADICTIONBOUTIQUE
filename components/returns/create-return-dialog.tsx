'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'
import { createReturnAction } from '@/actions/returns'
import { toast } from 'sonner'

interface CreateReturnDialogProps {
  onClose: () => void
  onSuccess: (newReturn: any) => void
}

export function CreateReturnDialog({ onClose, onSuccess }: CreateReturnDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    saleNumber: '',
    reason: '',
    reasonType: 'DEFECTO_PRODUCTO',
    returnType: 'REEMBOLSO' as 'REEMBOLSO' | 'CAMBIO',
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // En producción, aquí buscarías la venta por número
      // Por ahora, simulamos los datos
      const result = await createReturnAction({
        saleId: 'temp-id',
        saleNumber: formData.saleNumber,
        clientId: null,
        clientName: 'Cliente Temporal',
        storeId: 'Tienda Mujeres',
        reason: formData.reason,
        reasonType: formData.reasonType,
        returnType: formData.returnType,
        totalAmount: 0,
        returnedItems: [],
        notes: formData.notes
      })

      if (result.success) {
        toast.success('Devolución creada exitosamente')
        onSuccess(result.data)
      } else {
        toast.error('Error al crear devolución')
      }
    } catch (error) {
      toast.error('Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Nueva Devolución</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label>Número de Venta</Label>
            <Input
              value={formData.saleNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, saleNumber: e.target.value }))}
              placeholder="V-0001"
              required
            />
          </div>

          <div>
            <Label>Motivo</Label>
            <select
              value={formData.reasonType}
              onChange={(e) => setFormData(prev => ({ ...prev, reasonType: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="DEFECTO_PRODUCTO">Producto defectuoso</option>
              <option value="TALLA_INCORRECTA">Talla incorrecta</option>
              <option value="COLOR_DIFERENTE">Color diferente</option>
              <option value="NO_SATISFECHO">No satisfecho</option>
              <option value="CAMBIO_OPINION">Cambió de opinión</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <Label>Descripción del motivo</Label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              required
            />
          </div>

          <div>
            <Label>Tipo de devolución</Label>
            <select
              value={formData.returnType}
              onChange={(e) => setFormData(prev => ({ ...prev, returnType: e.target.value as any }))}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="REEMBOLSO">Reembolso</option>
              <option value="CAMBIO">Cambio por otro producto</option>
            </select>
          </div>

          <div>
            <Label>Notas adicionales (opcional)</Label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Devolución'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
