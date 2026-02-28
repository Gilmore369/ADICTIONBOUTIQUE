'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'

interface Movement {
  id: string
  product_id: string
  warehouse_id: string
  type: string
  quantity: number
  reason: string
  created_at: string
  products?: {
    name: string
    barcode: string
  }
}

interface MovementsTableProps {
  data: Movement[]
}

type SortField = 'fecha' | 'tipo' | 'producto' | 'tienda' | 'cantidad' | 'motivo'
type SortOrder = 'asc' | 'desc'

type StoreFilter = 'all' | 'Tienda Mujeres' | 'Tienda Hombres'

export function MovementsTable({ data }: MovementsTableProps) {
  const [sortField, setSortField] = useState<SortField>('fecha')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const filteredData = storeFilter === 'all'
    ? data
    : data.filter(m => m.warehouse_id.toLowerCase() === storeFilter.toLowerCase())

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'fecha':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      case 'tipo':
        aValue = a.type
        bValue = b.type
        break
      case 'producto':
        aValue = a.products?.name || ''
        bValue = b.products?.name || ''
        break
      case 'tienda':
        aValue = a.warehouse_id
        bValue = b.warehouse_id
        break
      case 'cantidad':
        aValue = Math.abs(a.quantity)
        bValue = Math.abs(b.quantity)
        break
      case 'motivo':
        aValue = a.reason || ''
        bValue = b.reason || ''
        break
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    )
  }

  if (data.length === 0) {
    return (
      <Card className="p-8 text-center text-gray-500">
        No hay movimientos registrados
      </Card>
    )
  }

  const storeOptions: { value: StoreFilter; label: string }[] = [
    { value: 'all',              label: 'Ambas tiendas' },
    { value: 'Tienda Mujeres',   label: 'Tienda Mujeres' },
    { value: 'Tienda Hombres',   label: 'Tienda Hombres' },
  ]

  return (
    <Card className="p-4">
      {/* Store filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500 font-medium">Tienda:</span>
        <div className="flex gap-1">
          {storeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStoreFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                storeFilter === opt.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {storeFilter !== 'all' && (
          <span className="text-xs text-gray-400 ml-1">
            {filteredData.length} movimiento{filteredData.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('fecha')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Fecha
                  <SortIcon field="fecha" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('tipo')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Tipo
                  <SortIcon field="tipo" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('producto')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Producto
                  <SortIcon field="producto" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('tienda')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Tienda
                  <SortIcon field="tienda" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('cantidad')}
                  className="gap-2 h-auto p-0 hover:bg-transparent ml-auto"
                >
                  Cantidad
                  <SortIcon field="cantidad" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('motivo')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Motivo
                  <SortIcon field="motivo" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  No hay movimientos para la tienda seleccionada
                </TableCell>
              </TableRow>
            )}
            {sortedData.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="text-sm">
                  {formatSafeDate(movement.created_at, 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  {movement.type === 'IN' || movement.type === 'ENTRADA' ? (
                    <Badge variant="default" className="gap-1">
                      <ArrowDown className="h-3 w-3" />
                      Entrada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <ArrowUp className="h-3 w-3" />
                      Salida
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{movement.products?.name}</div>
                    <div className="text-xs text-gray-500">{movement.products?.barcode}</div>
                  </div>
                </TableCell>
                <TableCell>{movement.warehouse_id}</TableCell>
                <TableCell className="text-right font-semibold">
                  {movement.type === 'IN' || movement.type === 'ENTRADA' ? '+' : ''}{Math.abs(movement.quantity)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {movement.reason || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
