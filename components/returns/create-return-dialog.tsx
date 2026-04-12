'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  X, Search, Loader2, CheckCircle, Package,
  ShoppingBag, Minus, Plus, AlertCircle, CreditCard, Banknote, Info,
} from 'lucide-react'
import { createReturnAction } from '@/actions/returns'
import { formatCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'

interface CreateReturnDialogProps {
  onClose: () => void
  onSuccess: (newReturn: any) => void
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface SaleItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: {
    id: string
    name: string
    barcode: string
    size: string | null
    color: string | null
    base_name: string | null
    base_code: string | null
  } | null
}

interface SaleLookup {
  id: string
  sale_number: string
  client_id: string | null
  client_name: string | null
  store_id: string
  total: number
  sale_type: 'CONTADO' | 'CREDITO'
  sale_items: SaleItem[]
}

interface SelectedItem {
  saleItemId: string
  productId: string
  returnQty: number
  maxQty: number
  unitPrice: number
  productName: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CreateReturnDialog({ onClose, onSuccess }: CreateReturnDialogProps) {
  const [loading, setLoading]     = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [foundSale, setFoundSale] = useState<SaleLookup | null>(null)
  const [lookupError, setLookupError] = useState('')

  const [saleNumber, setSaleNumber] = useState('')
  const [reasonType, setReasonType] = useState('DEFECTO_PRODUCTO')
  const [reason, setReason]         = useState('')
  const [notes, setNotes]           = useState('')

  const [selected, setSelected] = useState<Record<string, SelectedItem>>({})
  const [manualAmount, setManualAmount]       = useState('')
  const [useManualAmount, setUseManualAmount] = useState(false)

  // ── Look up sale ─────────────────────────────────────────────────────────────
  const handleLookupSale = async () => {
    if (!saleNumber.trim()) { setLookupError('Ingrese un número de venta'); return }
    setLookingUp(true)
    setFoundSale(null)
    setLookupError('')
    setSelected({})
    try {
      const res  = await fetch(`/api/sales/${encodeURIComponent(saleNumber.trim())}`)
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

  // ── Item selection helpers ────────────────────────────────────────────────────
  const toggleItem = (item: SaleItem) => {
    setSelected(prev => {
      if (prev[item.id]) {
        const next = { ...prev }
        delete next[item.id]
        return next
      }
      return {
        ...prev,
        [item.id]: {
          saleItemId:  item.id,
          productId:   item.product_id,
          returnQty:   item.quantity,
          maxQty:      item.quantity,
          unitPrice:   Number(item.unit_price),
          productName: item.products?.base_name || item.products?.name || 'Producto',
        },
      }
    })
  }

  const setQty = (saleItemId: string, qty: number) => {
    setSelected(prev => {
      if (!prev[saleItemId]) return prev
      const maxQty = prev[saleItemId].maxQty
      return { ...prev, [saleItemId]: { ...prev[saleItemId], returnQty: Math.max(1, Math.min(qty, maxQty)) } }
    })
  }

  const toggleAll = () => {
    if (!foundSale) return
    const allSelected = foundSale.sale_items.every(i => !!selected[i.id])
    if (allSelected) {
      setSelected({})
    } else {
      const next: Record<string, SelectedItem> = {}
      foundSale.sale_items.forEach(item => {
        next[item.id] = {
          saleItemId:  item.id,
          productId:   item.product_id,
          returnQty:   item.quantity,
          maxQty:      item.quantity,
          unitPrice:   Number(item.unit_price),
          productName: item.products?.base_name || item.products?.name || 'Producto',
        }
      })
      setSelected(next)
    }
  }

  // ── Derived totals ────────────────────────────────────────────────────────────
  const { returnAmount, effectiveReturnAmount, discountRatio, hasDiscount, selectedCount } = useMemo(() => {
    const items = Object.values(selected)
    const rawReturn = items.reduce((s, i) => s + i.unitPrice * i.returnQty, 0)
    const selectedCount = items.length

    const saleItemsTotal = foundSale?.sale_items?.reduce((s, i) => s + Number(i.subtotal), 0) ?? 0
    const saleTotal = Number(foundSale?.total ?? 0)
    const discountRatio = saleItemsTotal > 0 && saleTotal < saleItemsTotal - 0.01
      ? saleTotal / saleItemsTotal : 1
    const hasDiscount = discountRatio < 0.999
    const effectiveReturnAmount = rawReturn * discountRatio

    return { returnAmount: rawReturn, effectiveReturnAmount, discountRatio, hasDiscount, selectedCount }
  }, [selected, foundSale])

  const finalAmount = useManualAmount && manualAmount
    ? Number(manualAmount)
    : (hasDiscount ? effectiveReturnAmount : returnAmount)

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foundSale)     { toast.error('Primero busca y confirma el número de venta'); return }
    if (!reason.trim()) { toast.error('Ingresa la descripción del motivo'); return }
    if (selectedCount === 0) { toast.error('Selecciona al menos un producto a devolver'); return }

    setLoading(true)
    try {
      const returnedItems = Object.values(selected).map(i => ({
        sale_item_id: i.saleItemId,
        product_id:   i.productId,
        quantity:     i.returnQty,
        unit_price:   i.unitPrice,
        subtotal:     i.unitPrice * i.returnQty,
      }))

      const result = await createReturnAction({
        saleId:       foundSale.id,
        saleNumber:   foundSale.sale_number,
        clientId:     foundSale.client_id,
        clientName:   foundSale.client_name || 'Sin nombre',
        storeId:      foundSale.store_id,
        saleType:     foundSale.sale_type,
        reason,
        reasonType,
        totalAmount:  finalAmount,
        returnedItems,
        notes: notes || undefined,
      })

      if (result.success) {
        toast.success('Devolución registrada. Pendiente de aprobación.')
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

  const allSelected = foundSale
    ? foundSale.sale_items.length > 0 && foundSale.sale_items.every(i => !!selected[i.id])
    : false

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-100 rounded-lg">
              <Package className="h-4 w-4 text-rose-600" />
            </div>
            <h2 className="text-base font-semibold">Nueva Devolución</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

            {/* ── Paso 1: Buscar venta ────────────────────────────────── */}
            <div>
              <Label className="text-sm font-medium">Número de Venta *</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={saleNumber}
                  onChange={e => { setSaleNumber(e.target.value); setFoundSale(null); setLookupError(''); setSelected({}) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLookupSale() } }}
                  placeholder="Ej: V-0083"
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={handleLookupSale}
                  disabled={lookingUp || !saleNumber.trim()} className="shrink-0 gap-1.5">
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" /> Buscar</>}
                </Button>
              </div>

              {lookupError && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> {lookupError}
                </div>
              )}

              {/* Sale found summary */}
              {foundSale && (
                <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm space-y-2">
                  <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                    <CheckCircle className="h-4 w-4" />
                    Venta encontrada: {foundSale.sale_number}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {foundSale.client_name && (
                      <span className="text-emerald-700">👤 {foundSale.client_name}</span>
                    )}
                    <span className="text-emerald-700">💰 {formatCurrency(Number(foundSale.total))}</span>
                    <span className="text-emerald-700">🏪 {foundSale.store_id}</span>
                    {/* Sale type badge */}
                    {foundSale.sale_type === 'CREDITO' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold border border-violet-200">
                        <CreditCard className="h-3 w-3" /> Crédito
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 font-semibold border border-emerald-300">
                        <Banknote className="h-3 w-3" /> Contado
                      </span>
                    )}
                  </div>

                  {/* Contextual info banner per sale type */}
                  {foundSale.sale_type === 'CREDITO' ? (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-violet-50 border border-violet-200 text-xs text-violet-800">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        <strong>Venta a crédito:</strong> Al aprobar la devolución se cancelará el plan de cuotas
                        y se restaurará el límite de crédito del cliente.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        <strong>Venta al contado:</strong> Al aprobar la devolución se registrará un egreso en caja.
                        La caja debe estar abierta en <strong>{foundSale.store_id}</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Paso 2: Selección de productos ─────────────────────── */}
            {foundSale && foundSale.sale_items?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-gray-500" />
                    Productos del ticket
                    {selectedCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </Label>
                  <button type="button" onClick={toggleAll}
                    className="text-xs text-primary hover:underline font-medium">
                    {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                  </button>
                </div>

                <div className="border rounded-lg divide-y overflow-hidden">
                  {foundSale.sale_items.map(item => {
                    const sel     = selected[item.id]
                    const isChecked = !!sel
                    const product   = item.products
                    const name    = product?.base_name || product?.name || 'Producto'
                    const details = [product?.base_code, product?.size, product?.color].filter(Boolean).join(' · ')

                    return (
                      <div key={item.id}
                        className={['flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                          isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'].join(' ')}
                        onClick={() => toggleItem(item)}
                      >
                        <div className={['w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                          isChecked ? 'bg-primary border-primary' : 'border-gray-300'].join(' ')}>
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {details && <span className="mr-2">{details}</span>}
                            <span className="font-mono text-[10px]">{product?.barcode}</span>
                          </p>
                        </div>

                        <div className="text-xs text-gray-500 flex-shrink-0 text-right">
                          <div>{formatCurrency(Number(item.unit_price))} c/u</div>
                          <div>Stock: ×{item.quantity}</div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={() => setQty(item.id, sel.returnQty - 1)}
                              disabled={sel.returnQty <= 1}
                              className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{sel.returnQty}</span>
                            <button type="button" onClick={() => setQty(item.id, sel.returnQty + 1)}
                              disabled={sel.returnQty >= sel.maxQty}
                              className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        <div className="text-sm font-semibold text-gray-900 flex-shrink-0 w-20 text-right">
                          {isChecked ? formatCurrency(sel.unitPrice * sel.returnQty) : formatCurrency(Number(item.subtotal))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Return amount summary */}
                {selectedCount > 0 && (
                  <div className="mt-2 space-y-2">
                    {hasDiscount && (
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                        <span className="text-amber-700">
                          ⚠️ La venta tenía descuento ({Math.round((1 - discountRatio) * 100)}%).
                          Precio ticket: {formatCurrency(returnAmount)} → Monto efectivo: {formatCurrency(effectiveReturnAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                      <span className="text-sm font-medium text-rose-700">Monto a reembolsar ({selectedCount} prod.)</span>
                      <span className="text-base font-bold text-rose-700">{formatCurrency(finalAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={useManualAmount}
                          onChange={e => setUseManualAmount(e.target.checked)} className="h-3.5 w-3.5" />
                        Monto personalizado
                      </label>
                      {useManualAmount && (
                        <input type="number" step="0.01" min="0" placeholder="0.00"
                          value={manualAmount} onChange={e => setManualAmount(e.target.value)}
                          className="ml-2 w-28 px-2 py-1 border rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      )}
                    </div>
                  </div>
                )}

                {selectedCount === 0 && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Selecciona los productos que se están devolviendo
                  </p>
                )}
              </div>
            )}

            {/* ── Paso 3: Datos de la devolución ─────────────────────── */}
            {foundSale && (
              <>
                <div>
                  <Label className="text-sm font-medium">Motivo *</Label>
                  <select value={reasonType} onChange={e => setReasonType(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                    <option value="DEFECTO_PRODUCTO">Producto defectuoso</option>
                    <option value="TALLA_INCORRECTA">Talla incorrecta</option>
                    <option value="COLOR_DIFERENTE">Color diferente</option>
                    <option value="NO_SATISFECHO">No satisfecho</option>
                    <option value="CAMBIO_OPINION">Cambió de opinión</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Descripción del motivo *</Label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    rows={2} placeholder="Describe el motivo de la devolución..." required />
                </div>

                {/* Tipo siempre REEMBOLSO — informativo */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
                  <Banknote className="h-4 w-4 shrink-0" />
                  Tipo: Reembolso de dinero
                  <span className="text-xs font-normal text-emerald-600 ml-1">
                    — Si el cliente desea otra prenda puede realizar una nueva compra.
                  </span>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600">Notas adicionales (opcional)</Label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    rows={2} placeholder="Información adicional..." />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t bg-gray-50/50 flex-shrink-0">
            <div className="text-sm text-gray-500">
              {selectedCount > 0
                ? <span className="font-medium text-gray-700">Reembolso: {formatCurrency(finalAmount)}</span>
                : foundSale ? 'Selecciona los productos a devolver' : ''
              }
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !foundSale || selectedCount === 0}
                className="min-w-[140px] bg-rose-600 hover:bg-rose-700">
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</>
                  : `Registrar Devolución${selectedCount > 0 ? ` (${formatCurrency(finalAmount)})` : ''}`
                }
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
