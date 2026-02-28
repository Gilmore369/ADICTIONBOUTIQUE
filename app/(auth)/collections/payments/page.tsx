/**
 * Payments Page — /collections/payments
 *
 * Renders the PaymentsPanel (form + live summary) and the payment history below.
 * The section header and tab nav are provided by collections/layout.tsx.
 */

import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { PaymentsPanel } from '@/components/collections/payments-panel'
import { PaymentHistory } from '@/components/collections/payment-history'
import { Skeleton } from '@/components/shared/loading-skeleton'

function PaymentHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  )
}

async function RecentPayments() {
  const supabase = await createServerClient()

  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id,
      client_id,
      amount,
      payment_date,
      user_id,
      receipt_url,
      notes,
      created_at,
      client:clients ( name ),
      user:users ( name )
    `)
    .order('payment_date', { ascending: false })
    .limit(20)

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm">
        Error al cargar el historial: {error.message}
      </div>
    )
  }

  const transformedPayments = (payments || []).map((p: any) => ({
    id: p.id,
    client_id: p.client_id,
    client_name: p.client?.name,
    amount: p.amount,
    payment_date: p.payment_date,
    user_id: p.user_id,
    user_name: p.user?.name,
    receipt_url: p.receipt_url,
    notes: p.notes,
    created_at: p.created_at,
  }))

  return <PaymentHistory payments={transformedPayments} />
}

export default function PaymentsPage() {
  return (
    <div className="space-y-8">
      {/* Form + Summary */}
      <PaymentsPanel />

      {/* Payment history */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Historial de Pagos</h2>
        <Suspense fallback={<PaymentHistorySkeleton />}>
          <RecentPayments />
        </Suspense>
      </section>
    </div>
  )
}
