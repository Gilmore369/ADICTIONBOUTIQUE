/**
 * Installments Table Component
 * 
 * Displays installments in table format ordered by due_date ascending.
 * Shows installment number, amount, due date, paid amount, and status.
 * 
 * Design tokens:
 * - Spacing: 16px padding
 * - Border radius: 8px
 * - Typography: 14-16px body
 * 
 * Requirements: 6.6 - Display installments ordered by due_date ascending
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InstallmentStatusBadge } from './installment-status-badge'
import { formatSafeDate, getSafeTimestamp } from '@/lib/utils/date'

type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'

interface Installment {
  id: string
  installment_number: number
  amount: number
  due_date: string
  paid_amount: number
  status: InstallmentStatus
}

import { formatCurrency } from '@/lib/utils/currency'

interface InstallmentsTableProps {
  installments: Installment[]
}

export function InstallmentsTable({ installments }: InstallmentsTableProps) {
  // Sort by due_date ascending (requirement 6.6)
  const sortedInstallments = [...installments].sort((a, b) => 
    getSafeTimestamp(a.due_date) - getSafeTimestamp(b.due_date)
  )

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuota</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Fecha Vencimiento</TableHead>
            <TableHead>Monto Pagado</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedInstallments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                No hay cuotas disponibles
              </TableCell>
            </TableRow>
          ) : (
            sortedInstallments.map((installment) => {
              const balance = installment.amount - installment.paid_amount
              
              return (
                <TableRow key={installment.id}>
                  <TableCell className="font-medium">
                    Cuota {installment.installment_number}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(installment.amount)}
                  </TableCell>
                  <TableCell>
                    {formatSafeDate(installment.due_date, 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(installment.paid_amount)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(balance)}
                  </TableCell>
                  <TableCell>
                    <InstallmentStatusBadge status={installment.status} />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
