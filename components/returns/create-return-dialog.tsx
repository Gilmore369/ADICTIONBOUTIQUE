'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Search, Loader2, CheckCircle } from 'lucide-react'
import { createReturnAction } from '@/actions/returns'
import { toast } from 'sonner'

interface CreateReturnDialogProps {
  onClose: () => void
  onSuccess: (newReturn: any) => void
}

interface SaleLookup {
  id: string
  sale_number: string
  client_id: string | null
  client_name: string | null
  store_id: string
  total: number
}

export function CreateReturnDialog({ onClose, onSuccess }: CreateReturnDialogProps) {
  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [foundSale, setFoundSale] = useState<SaleLookup | null>(null)
  const [lookupError, setLookupError] = useState('')

  const [formData, setFormData] = useState({
    saleNumber: '',
    reason: '',
    reasonType: 'DEFECTO_PRODUCTO',
    returnType: 'REEMBOLSO' as 'REEMBOLSO' | 'CAMBIO',
    notes: ''
  })

  // ── Look up sale by number ─────────────────────────────────────────────
  const handleLookupSale = async () => {
    if (!formData.saleNumber.trim()) {
      setLookupError('Ingrese un número de venta')
      return
    }
    setLookingUp(true)
    setFoundSale(null)
    setLookupError('')
    try {
      const res = await fetch(`/api/sales/${encodeURIComponent(formData.saleNumber.trim())}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setLookupError(json.error || 'Venta no encontrada')
        return
      }
      setFoundSale(json.data)
    } catch {
      setLookupError('Error al buscar la venta')
    } finally {
      setLookingUp(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!foundSale) {
      toast.error('Primero busca y confirma el número de venta')
      return
    }

    if (!formData.reason.trim()) {
      toast.error('Ingresa la descripción del motivo')
      return
    }

    setLoading(true)
    try {
      const result = await createReturnAction({
        saleId:        foundSale.id,
        saleNumber:    foundSale.sale_number,
        clientId:      foundSale.client_id,
        clientName:    foundSale.client_name || 'Sin nombre',
        storeId:       foundSale.store_id,
        reason:        formData.reason,
        reasonType:    formData.reasonType,
        returnType:    formData.returnType,
        totalAmount:   Number(foundSale.total),
        returnedItems: [],
        notes:         formData.notes || undefined
      })

      if (result.success) {
        toast.success('Devolución creada exitosamente')
        onSuccess(result.data)
      } else {
        toast.error(result.error || 'Error al crear devolución')
      }
    } catch {
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

          {/* ── Sale number lookup ─────────────────────────────────────── */}
          <div>
            <Label>Número de Venta *</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={formData.saleNumber}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, saleNumber: e.target.value }))
                  setFoundSale(null)
                  setLookupError('')
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookupSale() } }}
                placeholder="Ej: V-0001"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLookupSale}
                disabled={lookingUp || !formData.saleNumber.trim()}
                className="shrink-0"
              >
                {lookingUp
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />
                }
              </Button>
            </div>

            {lookupError && (
              <p className="text-xs text-destructive mt-1">{lookupError}</p>
            )}

            {foundSale && (
              <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                  <CheckCircle className="h-4 w-4" />
                  Venta encontrada: {foundSale.sale_number}
                </div>
                {foundSale.client_name && (
                  <div className="text-emerald-700">Cliente: {foundSale.client_name}</div>
                )}
                <div className="text-emerald-700">
                  Total: S/ {Number(foundSale.total).toFixed(2)} · Tienda: {foundSale.store_id}
                </div>
              </div>
            )}
          </div>

          {/* ── Reason type ────────────────────────────────────────────── */}
          <div>
            <Label>Motivo *</Label>
            <select
              value={formData.reasonType}
              onChange={(e) => setFormData(prev => ({ ...prev, reasonType: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
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

          {/* ── Reason description ─────────────────────────────────────── */}
          <div>
            <Label>Descripción del motivo *</Label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              rows={3}
              required
            />
          </div>

          {/* ── Return type ────────────────────────────────────────────── */}
          <div>
            <Label>Tipo de devolución *</Label>
            <select
              value={formData.returnType}
              onChange={(e) => setFormData(prev => ({ ...prev, returnType: e.target.value as any }))}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
            >
              <option value="REEMBOLSO">Reembolso de dinero</option>
              <option value="CAMBIO">Cambio por otro producto</option>
            </select>
          </div>

          {/* ── Notes ──────────────────────────────────────────────────── */}
          <div>
            <Label>Notas adicionales (opcional)</Label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !foundSale}>
              {loading ? 'Creando...' : 'Crear Devolución'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
