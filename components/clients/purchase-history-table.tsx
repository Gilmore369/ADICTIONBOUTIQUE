/**
 * Purchase History Table Component
 * 
 * Displays purchase history sorted by date (most recent first).
 * 
 * Requirements: 1.4
 */

'use client'

import { Purchase } from '@/lib/types/crm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart } from 'lucide-react'

interface PurchaseHistoryTableProps {
  purchases: Purchase[]
}

export function PurchaseHistoryTable({ purchases }: PurchaseHistoryTableProps) {
  const getSaleTypeBadge = (saleType: string) => {
    return saleType === 'CREDITO' ? (
      <Badge variant="secondary">Crédito</Badge>
    ) : (
      <Badge variant="outline">Contado</Badge>
    )
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="default" className="bg-green-600">Pagado</Badge>
      case 'PARTIAL':
        return <Badge variant="secondary">Parcial</Badge>
      case 'PENDING':
        return <Badge variant="outline">Pendiente</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Historial de Compras
        </CardTitle>
      </CardHeader>
      <CardContent>
        {purchases.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay compras registradas
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número de Venta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado de Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">
                      {purchase.saleNumber}
                    </TableCell>
                    <TableCell>
                      {purchase.date.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {getSaleTypeBadge(purchase.saleType)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${purchase.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {getPaymentStatusBadge(purchase.paymentStatus)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
