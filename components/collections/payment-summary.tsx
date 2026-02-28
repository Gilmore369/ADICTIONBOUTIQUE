/**
 * PaymentSummary Component
 * 
 * Shows which installments will be paid with the current payment amount.
 * Displays installment details and updates in real-time as payment amount changes.
 * 
 * Features:
 * - List of installments to be paid
 * - Shows installment number, due date, amount, amount to apply
 * - Total payment and remaining amount display
 * - Real-time updates based on payment amount
 * - Uses oldest_due_first algorithm preview
 * 
 * Design Tokens:
 * - Spacing: 16px
 * - Border radius: 8px
 * - Card padding: 16px
 * 
 * Requirements: 7.1, 7.5
 * 
 * @example
 * ```tsx
 * <PaymentSummary
 *   clientId="uuid"
 *   paymentAmount={500}
 * />
 * ```
 */

'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'

interface Installment {
  id: string
  installment_number: number
  amount: number
  due_date: string
  paid_amount: number
  status: string
  amount_to_apply?: number
}

interface PaymentSummaryProps {
  clientId: string
  paymentAmount: number
}

export function PaymentSummary({ clientId, paymentAmount }: PaymentSummaryProps) {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(false)
  const [remainingAmount, setRemainingAmount] = useState(0)

  useEffect(() => {
    if (!clientId || paymentAmount <= 0) {
      setInstallments([])
      setRemainingAmount(0)
      return
    }

    fetchInstallmentsPreview()
  }, [clientId, paymentAmount])

  const fetchInstallmentsPreview = async () => {
    setLoading(true)
    try {
      // Fetch unpaid installments for the client
      const response = await fetch(
        `/api/collections/payment-preview?client_id=${clientId}&amount=${paymentAmount}`
      )
      const { data } = await response.json()

      if (data) {
        setInstallments(data.installments || [])
        setRemainingAmount(data.remaining_amount || 0)
      }
    } catch (error) {
      console.error('Error fetching payment preview:', error)
      setInstallments([])
      setRemainingAmount(0)
    } finally {
      setLoading(false)
    }
  }

  if (!clientId) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">
          Seleccione un cliente para ver el resumen del pago
        </p>
      </Card>
    )
  }

  if (paymentAmount <= 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">
          Ingrese un monto para ver cómo se aplicará el pago
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <h3 className="text-base font-semibold mb-3">Resumen del Pago</h3>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : installments.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay cuotas pendientes para este cliente
        </p>
      ) : (
        <>
          {/* Installments list */}
          <div className="space-y-2 mb-4">
            {installments.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Cuota #{inst.installment_number}
                    </span>
                    <span className="text-xs text-gray-500">
                      Vence: {formatSafeDate(inst.due_date, 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Monto: S/ {inst.amount.toFixed(2)} | Pagado: S/ {inst.paid_amount.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-green-600">
                    + S/ {(inst.amount_to_apply || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">a aplicar</div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary totals */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Monto del pago:</span>
              <span className="font-semibold">S/ {paymentAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cuotas afectadas:</span>
              <span className="font-semibold">{installments.length}</span>
            </div>
            {remainingAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Monto restante:</span>
                <span className="font-semibold text-orange-600">
                  S/ {remainingAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
