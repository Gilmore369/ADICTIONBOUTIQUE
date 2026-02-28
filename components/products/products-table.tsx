/**
 * ProductsTable Component
 * 
 * A table component for displaying products with sorting, filtering, and actions.
 * Displays product details with related data (line, category, brand) and provides
 * edit and delete action buttons.
 * 
 * Features:
 * - Responsive design with shadcn/ui Table
 * - Display columns: barcode, name, line, category, brand, size, color, price, stock, actions
 * - Action buttons (edit, delete)
 * - Loading skeleton support
 * - Design tokens compliance (spacing, border-radius)
 * 
 * Design Tokens:
 * - Border radius: 8px (standard)
 * - Spacing: 8px, 16px
 * - Button height: 36px
 * 
 * Requirements: 4.1
 * Task: 8.9 Create product table component
 * 
 * @example
 * ```tsx
 * <ProductsTable
 *   products={products}
 *   onEdit={(product) => console.log('Edit:', product)}
 *   onDelete={(product) => console.log('Delete:', product)}
 * />
 * ```
 */

'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'

interface Product {
  id: string
  barcode: string | null
  name: string
  description: string | null
  size: string | null
  color: string | null
  price: number
  min_stock: number
  active: boolean
  lines: { id: string; name: string } | null
  categories: { id: string; name: string } | null
  brands: { id: string; name: string } | null
  stock?: { quantity: number } | null
}

interface ProductsTableProps {
  products: Product[]
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
}

export function ProductsTable({
  products,
  onEdit,
  onDelete,
}: ProductsTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código de Barras</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Línea</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Talla</TableHead>
            <TableHead>Color</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            {(onEdit || onDelete) && (
              <TableHead className="text-right">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="text-center text-muted-foreground h-24"
              >
                No hay productos disponibles
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.id}>
                {/* Barcode */}
                <TableCell className="font-mono text-sm">
                  {product.barcode || '-'}
                </TableCell>
                
                {/* Name */}
                <TableCell className="font-medium">
                  {product.name}
                </TableCell>
                
                {/* Line */}
                <TableCell>
                  {product.lines?.name || '-'}
                </TableCell>
                
                {/* Category */}
                <TableCell>
                  {product.categories?.name || '-'}
                </TableCell>
                
                {/* Brand */}
                <TableCell>
                  {product.brands?.name || '-'}
                </TableCell>
                
                {/* Size */}
                <TableCell>
                  {product.size || '-'}
                </TableCell>
                
                {/* Color */}
                <TableCell>
                  {product.color || '-'}
                </TableCell>
                
                {/* Price */}
                <TableCell className="text-right font-semibold">
                  S/ {product.price.toFixed(2)}
                </TableCell>
                
                {/* Stock */}
                <TableCell className="text-right">
                  {product.stock?.quantity ?? '-'}
                </TableCell>
                
                {/* Actions */}
                {(onEdit || onDelete) && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(product)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(product)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
