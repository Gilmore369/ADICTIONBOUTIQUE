'use client'

/**
 * Stock Manager Component
 * 
 * Visualiza y gestiona el inventario por tienda
 * 
 * Design Tokens:
 * - Card padding: 16px
 * - Border radius: 8px
 * - Spacing: 16px, 24px
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Search, AlertTriangle } from 'lucide-react'

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

interface StockManagerProps {
  initialData: StockItem[]
}

export function StockManager({ initialData }: StockManagerProps) {
  const [stock] = useState(initialData)
  const [search, setSearch] = useState('')

  const filteredStock = stock.filter((item) =>
    item.products?.name.toLowerCase().includes(search.toLowerCase()) ||
    item.products?.barcode.includes(search) ||
    item.warehouse_id.toLowerCase().includes(search.toLowerCase())
  )

  const groupedByWarehouse = filteredStock.reduce((acc, item) => {
    if (!acc[item.warehouse_id]) {
      acc[item.warehouse_id] = []
    }
    acc[item.warehouse_id].push(item)
    return acc
  }, {} as Record<string, StockItem[]>)

  return (
    <div className="space-y-6">
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

      {/* Stock by Warehouse */}
      {Object.entries(groupedByWarehouse).map(([warehouse, items]) => (
        <Card key={warehouse} className="p-4">
          <h3 className="text-lg font-semibold mb-4">{warehouse}</h3>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mín</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isLow = item.quantity <= (item.products?.min_stock || 0)
                  
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
                        {item.products?.min_stock || 0}
                      </TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Bajo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Normal</Badge>
                        )}
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
    </div>
  )
}
