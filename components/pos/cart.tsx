'use client'

import { Trash2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { CartItem } from '@/hooks/use-cart'
import { formatCurrency } from '@/lib/utils/currency'

/**
 * Cart Component
 * 
 * Design tokens used:
 * - Card padding: 16px
 * - Button height: 36px
 * - Spacing: 8px, 16px
 * - Border radius: 8px
 */

interface CartProps {
  items: CartItem[]
  subtotal: number
  discount: number
  total: number
  onUpdateQuantity: (product_id: string, quantity: number) => void
  onRemoveItem: (product_id: string) => void
  onUpdateDiscount: (discount: number) => void
}

export function Cart({
  items,
  subtotal,
  discount,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateDiscount
}: CartProps) {
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Carrito</h2>
      
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay productos en el carrito
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center gap-2 p-2 border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {item.product_name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(item.unit_price)}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                
                <span className="w-8 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="text-sm font-semibold w-20 text-right">
                {formatCurrency(item.subtotal)}
              </div>
              
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onRemoveItem(item.product_id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="discount" className="text-sm">
            Descuento:
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => onUpdateDiscount(Number(e.target.value))}
              className="w-24 h-9 text-right"
            />
            <span className="text-sm font-medium w-20 text-right">
              {formatCurrency(discount)}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between text-lg font-bold pt-2 border-t">
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </Card>
  )
}
