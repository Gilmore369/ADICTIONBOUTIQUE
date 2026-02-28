'use client'

/**
 * Client Purchase History Component
 * 
 * Displays client's purchase history
 */

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatSafeDate } from '@/lib/utils/date'

interface Purchase {
  id: string
  sale_number: string
  sale_date: string
  total: number
  sale_type: string
  created_at: string
}

import { formatCurrency } from '@/lib/utils/currency'

interface ClientPurchaseHistoryProps {
  purchases: Purchase[]
}

export function ClientPurchaseHistory({ purchases }: ClientPurchaseHistoryProps) {
  if (purchases.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay compras registradas
      </Card>
    )
  }

  const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total de compras</p>
            <p className="text-2xl font-bold">{purchases.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monto total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalPurchases)}</p>
          </div>
        </div>
      </Card>

      {/* Purchase List */}
      <Card className="divide-y">
        {purchases.map((purchase) => (
          <div key={purchase.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{purchase.sale_number}</span>
                  <Badge variant={purchase.sale_type === 'CONTADO' ? 'default' : 'secondary'}>
                    {purchase.sale_type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatSafeDate(purchase.sale_date, 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(purchase.total)}</p>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
