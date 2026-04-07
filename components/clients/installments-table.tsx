/**
 * Installments Table Component
 * 
 * Displays installments with due dates, amounts, status, and days overdue.
 * Highlights overdue installments in red. Sorted by due date (earliest first).
 * Includes payment button for each installment.
 * 
 * Requirements: 1.3, 11.1
 */

'use client'

import { useState } from 'react'
import { InstallmentWithPlan } from '@/lib/types/crm'
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
import { Calendar, AlertTriangle, DollarSign } from 'lucide-react'
import { RegisterPaymentDialog } from './register-payment-dialog'

interface InstallmentsTableProps {
  installments: InstallmentWithPlan[]
}

export function InstallmentsTable({ installments }: InstallmentsTableProps) {
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean
    installmentId: string
    installmentNumber: number
    saleNumber: string
    pendingAmount: number
  } | null>(null)

  const getStatusBadge = (status: string, daysOverdue: number) => {
    if (daysOverdue > 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Vencida
        </Badge>
      )
    }

    switch (status) {
      case 'PAID':
        return <Badge variant="default" className="bg-green-600">Pagada</Badge>
      case 'PARTIAL':
        return <Badge variant="secondary">Parcial</Badge>
      case 'PENDING':
        return <Badge variant="outline">Pendiente</Badge>
      case 'OVERDUE':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Vencida
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cuotas Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {installments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay cuotas pendientes
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venta</TableHead>
                    <TableHead>Cuota</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Pagado</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Días Mora</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((installment) => {
                    const pending = installment.amount - installment.paidAmount
                    const isOverdue = installment.daysOverdue > 0

                    return (
                      <TableRow
                        key={installment.id}
                        className={isOverdue ? 'bg-red-50' : ''}
                      >
                        <TableCell className="font-medium">
                          {installment.saleNumber}
                        </TableCell>
                        <TableCell>{installment.installmentNumber}</TableCell>
                        <TableCell>
                          {installment.dueDate.toLocaleDateString()}
                        </TableCell>
                        <TableCell>S/. {installment.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          S/. {installment.paidAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className={isOverdue ? 'font-bold text-red-600' : ''}>
                          S/. {pending.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(installment.status, installment.daysOverdue)}
                        </TableCell>
                        <TableCell>
                          {isOverdue ? (
                            <span className="font-bold text-red-600">
                              {installment.daysOverdue} días
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {installment.status !== 'PAID' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPaymentDialog({
                                  open: true,
                                  installmentId: installment.id,
                                  installmentNumber: installment.installmentNumber,
                                  saleNumber: installment.saleNumber,
                                  pendingAmount: pending,
                                })
                              }
                              className="gap-1"
                            >
                              <DollarSign className="h-3 w-3" />
                              Pagar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      {paymentDialog && (
        <RegisterPaymentDialog
          open={paymentDialog.open}
          onOpenChange={(open) => !open && setPaymentDialog(null)}
          installmentId={paymentDialog.installmentId}
          installmentNumber={paymentDialog.installmentNumber}
          saleNumber={paymentDialog.saleNumber}
          pendingAmount={paymentDialog.pendingAmount}
        />
      )}
    </>
  )
}
