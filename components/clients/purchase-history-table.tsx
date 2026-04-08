'use client'

import { useState, useMemo } from 'react'
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
import { Button } from '@/components/ui/button'
import { ShoppingCart, ChevronDown, ChevronRight, Receipt } from 'lucide-react'
import { SaleReceipt } from '@/components/pos/sale-receipt'
import { PERU_TZ } from '@/lib/utils/timezone'

interface PurchaseHistoryTableProps {
  purchases: Purchase[]
  clientName?: string
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function PurchaseHistoryTable({ purchases, clientName }: PurchaseHistoryTableProps) {
  const [monthFilter, setMonthFilter] = useState<number | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [receiptPurchase, setReceiptPurchase] = useState<Purchase | null>(null)

  const filtered = useMemo(() => {
    if (monthFilter === null) return purchases
    return purchases.filter(p => new Date(p.date).getMonth() === monthFilter)
  }, [purchases, monthFilter])

  const activeMonths = useMemo(() => {
    const set = new Set<number>()
    purchases.forEach(p => set.add(new Date(p.date).getMonth()))
    return set
  }, [purchases])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const getSaleTypeBadge = (saleType: string) =>
    saleType === 'CREDITO'
      ? <Badge variant="secondary">Crédito</Badge>
      : <Badge variant="outline">Contado</Badge>

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':    return <Badge className="bg-green-600 text-white">Pagado</Badge>
      case 'PARTIAL': return <Badge variant="secondary">Parcial</Badge>
      case 'PENDING': return <Badge variant="outline">Pendiente</Badge>
      default:        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Historial de Compras
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {filtered.length} de {purchases.length}
            </span>
          </CardTitle>

          {purchases.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              <Button
                variant={monthFilter === null ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setMonthFilter(null)}
              >
                Todos
              </Button>
              {MONTHS.map((m, i) =>
                activeMonths.has(i) ? (
                  <Button
                    key={i}
                    variant={monthFilter === i ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setMonthFilter(monthFilter === i ? null : i)}
                  >
                    {m}
                  </Button>
                ) : null
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay compras registradas
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead>Venta</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((purchase) => {
                    const isExpanded = expandedRows.has(purchase.id)
                    const hasItems = (purchase.items?.length ?? 0) > 0

                    return (
                      <>
                        <TableRow key={purchase.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell onClick={() => hasItems && toggleRow(purchase.id)}>
                            {hasItems ? (
                              isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : null}
                          </TableCell>
                          <TableCell
                            className="font-medium"
                            onClick={() => hasItems && toggleRow(purchase.id)}
                          >
                            {purchase.saleNumber}
                          </TableCell>
                          <TableCell onClick={() => hasItems && toggleRow(purchase.id)}>
                            {new Date(purchase.date).toLocaleDateString('es-PE', { timeZone: PERU_TZ })}
                          </TableCell>
                          <TableCell onClick={() => hasItems && toggleRow(purchase.id)}>
                            {getSaleTypeBadge(purchase.saleType)}
                          </TableCell>
                          <TableCell
                            className="font-semibold"
                            onClick={() => hasItems && toggleRow(purchase.id)}
                          >
                            S/. {purchase.total.toFixed(2)}
                          </TableCell>
                          <TableCell onClick={() => hasItems && toggleRow(purchase.id)}>
                            {getPaymentStatusBadge(purchase.paymentStatus)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Ver ticket"
                              onClick={() => setReceiptPurchase(purchase)}
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {isExpanded && hasItems && (
                          <TableRow key={`${purchase.id}-items`} className="bg-muted/30">
                            <TableCell colSpan={7} className="py-2 pl-8">
                              <div className="text-xs space-y-1">
                                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 font-medium text-muted-foreground border-b pb-1 mb-1">
                                  <span>Producto</span>
                                  <span className="text-right">Cant.</span>
                                  <span className="text-right">P.Unit</span>
                                  <span className="text-right">Subtotal</span>
                                </div>
                                {purchase.items!.map(item => (
                                  <div
                                    key={item.id}
                                    className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4"
                                  >
                                    <span className="truncate max-w-[200px]">{item.product_name}</span>
                                    <span className="text-right">{item.quantity}</span>
                                    <span className="text-right">S/. {item.unit_price.toFixed(2)}</span>
                                    <span className="text-right font-medium">S/. {item.subtotal.toFixed(2)}</span>
                                  </div>
                                ))}
                                {(purchase.discount ?? 0) > 0 && (
                                  <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t pt-1 text-muted-foreground">
                                    <span>Descuento</span>
                                    <span className="text-right text-red-600">
                                      -S/. {(purchase.discount ?? 0).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {receiptPurchase && (
        <SaleReceipt
          saleNumber={receiptPurchase.saleNumber}
          date={receiptPurchase.date instanceof Date
            ? receiptPurchase.date.toISOString()
            : String(receiptPurchase.date)}
          items={(receiptPurchase.items ?? []).map(i => ({
            quantity: i.quantity,
            name: i.product_name,
            unit_price: i.unit_price,
            subtotal: i.subtotal,
          }))}
          subtotal={receiptPurchase.subtotal ?? receiptPurchase.total}
          discount={receiptPurchase.discount ?? 0}
          total={receiptPurchase.total}
          paymentType={receiptPurchase.saleType}
          clientName={clientName}
          onClose={() => setReceiptPurchase(null)}
        />
      )}
    </>
  )
}
