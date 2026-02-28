/**
 * PaymentHistory Component
 * 
 * Table showing payment history with date, amount, client, user, and notes.
 * Sortable by date descending with pagination support.
 * 
 * Features:
 * - Table with payment details
 * - Sortable by date (descending by default)
 * - Pagination or infinite scroll
 * - Responsive design
 * 
 * Design Tokens:
 * - Border radius: 8px
 * - Spacing: 8px, 16px
 * - Button height: 36px
 * 
 * Requirements: 7.6
 * 
 * @example
 * ```tsx
 * <PaymentHistory
 *   payments={payments}
 *   onLoadMore={() => console.log('Load more')}
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
import { ExternalLink } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'

interface Payment {
  id: string
  client_id: string
  client_name?: string
  amount: number
  payment_date: string
  user_id: string
  user_name?: string
  receipt_url?: string | null
  notes?: string | null
  created_at: string
}

import { formatCurrency } from '@/lib/utils/currency'

interface PaymentHistoryProps {
  payments: Payment[]
  loading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

export function PaymentHistory({
  payments,
  loading = false,
  onLoadMore,
  hasMore = false
}: PaymentHistoryProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-center">Recibo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground h-24"
                >
                  {loading ? 'Cargando pagos...' : 'No hay pagos registrados'}
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  {/* Payment Date */}
                  <TableCell className="font-medium">
                    {formatSafeDate(payment.payment_date, 'dd MMM yyyy')}
                  </TableCell>

                  {/* Client Name */}
                  <TableCell>
                    {payment.client_name || payment.client_id}
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatCurrency(payment.amount)}
                  </TableCell>

                  {/* User */}
                  <TableCell className="text-sm text-gray-600">
                    {payment.user_name || payment.user_id.substring(0, 8)}
                  </TableCell>

                  {/* Notes */}
                  <TableCell className="max-w-[200px]">
                    {payment.notes ? (
                      <span className="text-sm text-gray-600 truncate block">
                        {payment.notes}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>

                  {/* Receipt URL */}
                  <TableCell className="text-center">
                    {payment.receipt_url ? (
                      <a
                        href={payment.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ver
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar más'}
          </Button>
        </div>
      )}
    </div>
  )
}
