'use client'

/**
 * Stock Manager Component
 *
 * Visualiza y gestiona el inventario por tienda.
 * Permite ajustar stock por producto con registro de movimiento.
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { useStore } from '@/contexts/store-context'
import { useRouter } from 'next/navigation'

interface StockItem {
  warehouse_id: string
  product_id: string
  quantity: number
  products?: {
    id: string
    name: string
    barcode: string
    min_stock: number
  }
}

interface StoreInfo {
  id: string
  name: string
  code: string
}

interface StockManagerProps {
  initialData: StockItem[]
  stores?: StoreInfo[]
}

const MOVEMENT_REASONS: Record<string, string[]> = {
  ENTRADA: ['Compra a proveedor', 'Devolución de cliente', 'Transferencia recibida', 'Corrección de inventario', 'Otro'],
  SALIDA: ['Ropa obsoleta', 'Producto dañado', 'Ropa sin rotación', 'Muestra/regalo', 'Pérdida', 'Transferencia enviada', 'Corrección de inventario', 'Otro'],
  AJUSTE: ['Conteo físico', 'Corrección de sistema', 'Otro'],
}

const TYPE_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada (+)',
  SALIDA: 'Salida (−)',
  AJUSTE: 'Ajuste (valor exacto)',
}

type StatusFilter = 'all' | 'low' | 'sin_stock'

export function StockManager({ initialData, stores = [] }: StockManagerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stock, setStock] = useState(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status')
    if (s === 'low') return 'low'
    if (s === 'sin_stock') return 'sin_stock'
    return 'all'
  })
  const { selectedStore, storeId } = useStore()

  // Sync filter when URL param changes
  useEffect(() => {
    const s = searchParams.get('status')
    if (s === 'low') setStatusFilter('low')
    else if (s === 'sin_stock') setStatusFilter('sin_stock')
    else setStatusFilter('all')
  }, [searchParams])

  // Adjust dialog state
  const [dialogItem, setDialogItem] = useState<StockItem | null>(null)
  const [adjType, setAdjType] = useState('SALIDA')
  const [adjQty, setAdjQty] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjLoading, setAdjLoading] = useState(false)
  const [adjError, setAdjError] = useState('')

  const openDialog = (item: StockItem) => {
    setDialogItem(item)
    setAdjType('SALIDA')
    setAdjQty('')
    setAdjReason('')
    setAdjNotes('')
    setAdjError('')
  }

  const closeDialog = () => setDialogItem(null)

  const handleAdjust = async () => {
    if (!dialogItem) return
    const qty = Number(adjQty)
    if (!adjQty || isNaN(qty) || qty < 0) {
      setAdjError('Ingresa una cantidad válida')
      return
    }
    if (!adjReason) {
      setAdjError('Selecciona un motivo')
      return
    }
    setAdjLoading(true)
    setAdjError('')
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: dialogItem.product_id,
          warehouse_id: dialogItem.warehouse_id,
          type: adjType,
          quantity: qty,
          reason: adjReason,
          notes: adjNotes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAdjError(data.error || 'Error al ajustar stock')
        return
      }
      // Update local state immediately
      setStock(prev => prev.map(item =>
        item.product_id === dialogItem.product_id && item.warehouse_id === dialogItem.warehouse_id
          ? { ...item, quantity: data.current }
          : item
      ))
      closeDialog()
      router.refresh()
    } catch {
      setAdjError('Error de conexión')
    } finally {
      setAdjLoading(false)
    }
  }

  // Helper: resolve a warehouse_id to a display name
  const getWarehouseName = (warehouseId: string): string => {
    const byId = stores.find(s => s.id === warehouseId)
    if (byId) return byId.name
    const byCode = stores.find(s => warehouseId.toUpperCase().includes(s.code))
    if (byCode) return byCode.name
    if (warehouseId.toUpperCase().includes('MUJERES')) return 'Tienda Mujeres'
    if (warehouseId.toUpperCase().includes('HOMBRES')) return 'Tienda Hombres'
    return warehouseId
  }

  const warehouseMatchesStore = (warehouseId: string): boolean => {
    if (selectedStore === 'ALL') return true
    if (storeId && warehouseId === storeId) return true
    return warehouseId.toUpperCase().includes(selectedStore)
  }

  // Stock status logic — defined first, used in filter + counts + render
  const getStockStatus = (qty: number, minStock: number) => {
    if (qty === 0) return 'sin_stock'
    if (minStock > 0 && qty <= minStock) return 'bajo'
    return 'normal'
  }

  const filteredStock = stock.filter((item) => {
    const matchesSearch =
      !search ||
      item.products?.name.toLowerCase().includes(search.toLowerCase()) ||
      item.products?.barcode?.includes(search) ||
      getWarehouseName(item.warehouse_id).toLowerCase().includes(search.toLowerCase())
    const status = getStockStatus(item.quantity, item.products?.min_stock || 0)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'low' && (status === 'bajo' || status === 'sin_stock')) ||
      (statusFilter === 'sin_stock' && status === 'sin_stock')
    return matchesSearch && warehouseMatchesStore(item.warehouse_id) && matchesStatus
  })

  // Counts for filter badges
  const counts = {
    all: stock.filter(i => warehouseMatchesStore(i.warehouse_id)).length,
    low: stock.filter(i => {
      const s = getStockStatus(i.quantity, i.products?.min_stock || 0)
      return warehouseMatchesStore(i.warehouse_id) && (s === 'bajo' || s === 'sin_stock')
    }).length,
    sin_stock: stock.filter(i => {
      const s = getStockStatus(i.quantity, i.products?.min_stock || 0)
      return warehouseMatchesStore(i.warehouse_id) && s === 'sin_stock'
    }).length,
  }

  const groupedByWarehouse = filteredStock.reduce((acc, item) => {
    if (!acc[item.warehouse_id]) acc[item.warehouse_id] = []
    acc[item.warehouse_id].push(item)
    return acc
  }, {} as Record<string, StockItem[]>)

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: 'all', label: 'Todos', count: counts.all },
          { key: 'low', label: 'Stock bajo', count: counts.low, color: 'amber' },
          { key: 'sin_stock', label: 'Sin stock', count: counts.sin_stock, color: 'red' },
        ] as const).map(({ key, label, count, color }) => {
          const active = statusFilter === key
          const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer'
          const styles =
            active && key === 'all'   ? 'bg-gray-900 text-white border-gray-900' :
            active && color === 'amber' ? 'bg-amber-500 text-white border-amber-500' :
            active && color === 'red'  ? 'bg-red-500 text-white border-red-500' :
            !active && color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
            !active && color === 'red'  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
            'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          return (
            <button key={key} onClick={() => setStatusFilter(key)} className={`${base} ${styles}`}>
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                active ? 'bg-white/30' : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por producto, código o tienda..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {Object.entries(groupedByWarehouse).length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No hay stock para la tienda seleccionada
        </Card>
      )}

      {Object.entries(groupedByWarehouse).map(([warehouse, items]) => (
        <Card key={warehouse} className="p-4">
          <h3 className="text-lg font-semibold mb-4">{getWarehouseName(warehouse)}</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mín</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ajustar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const minStock = item.products?.min_stock || 0
                  const status = getStockStatus(item.quantity, minStock)

                  return (
                    <TableRow key={`${item.warehouse_id}-${item.product_id}`}>
                      <TableCell className="font-mono text-sm">
                        {item.products?.barcode}
                      </TableCell>
                      <TableCell>{item.products?.name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-gray-500">
                        {minStock}
                      </TableCell>
                      <TableCell>
                        {status === 'sin_stock' && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Sin stock
                          </Badge>
                        )}
                        {status === 'bajo' && (
                          <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                            <AlertTriangle className="h-3 w-3" />
                            Bajo
                          </Badge>
                        )}
                        {status === 'normal' && (
                          <Badge variant="secondary">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDialog(item)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          Ajustar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}

      {filteredStock.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No se encontraron productos
        </Card>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={!!dialogItem} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
          </DialogHeader>

          {dialogItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                <p className="font-medium">{dialogItem.products?.name}</p>
                <p className="text-muted-foreground font-mono text-xs mt-0.5">{dialogItem.products?.barcode}</p>
                <p className="mt-1">Stock actual: <span className="font-semibold">{dialogItem.quantity}</span></p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de movimiento</Label>
                <Select value={adjType} onValueChange={(v) => { setAdjType(v); setAdjReason('') }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {adjType === 'AJUSTE' ? 'Nuevo stock total' : 'Cantidad'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder={adjType === 'AJUSTE' ? 'Ej: 10' : 'Ej: 3'}
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                />
                {adjType === 'SALIDA' && adjQty && Number(adjQty) > dialogItem.quantity && (
                  <p className="text-xs text-rose-600">Supera el stock disponible ({dialogItem.quantity})</p>
                )}
                {adjType === 'ENTRADA' && adjQty && (
                  <p className="text-xs text-muted-foreground">
                    Resultado: {dialogItem.quantity} + {adjQty} = {dialogItem.quantity + Number(adjQty)}
                  </p>
                )}
                {adjType === 'SALIDA' && adjQty && Number(adjQty) <= dialogItem.quantity && (
                  <p className="text-xs text-muted-foreground">
                    Resultado: {dialogItem.quantity} − {adjQty} = {dialogItem.quantity - Number(adjQty)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={adjReason} onValueChange={setAdjReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(MOVEMENT_REASONS[adjType] || []).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observaciones <span className="text-muted-foreground">(opcional)</span></Label>
                <Textarea
                  placeholder="Ej: ropa dañada por humedad, no apta para venta"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {adjError && (
                <p className="text-sm text-rose-600">{adjError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={adjLoading}>
              Cancelar
            </Button>
            <Button onClick={handleAdjust} disabled={adjLoading}>
              {adjLoading ? 'Guardando...' : 'Confirmar ajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
