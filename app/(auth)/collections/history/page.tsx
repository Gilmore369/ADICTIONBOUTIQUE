/**
 * Payment History Page — shell only.
 * Data fetched client-side via /api/payments/paginated (50 por página),
 * para no precargar miles de pagos cuando el usuario solo quiere ver los recientes.
 */

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PaymentHistoryView } from '@/components/collections/payment-history-view'

export const metadata = {
  title: 'Historial de Cobros | Adiction Boutique',
}

export default async function PaymentHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('roles, stores')
    .eq('id', user.id)
    .single()

  const userStores: string[] = (profile as any)?.stores || []

  const params = await (searchParams ?? Promise.resolve({}))
  const periodParam = (params.period || '1M').toUpperCase()
  const validPeriods = ['1D', '1W', 'MONTH', '1M', '3M', '6M', '1Y', 'YEAR', 'LASTYEAR', 'ALL']
  const normalized = periodParam === 'MONTH' ? '1M' : periodParam
  const initialPeriod = validPeriods.includes(normalized) ? normalized : '1M'

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Historial de Cobros</h1>
        <p className="text-sm text-muted-foreground">Pagos registrados por período</p>
      </div>
      <PaymentHistoryView
        initialPayments={[]}
        initialPeriod={initialPeriod as any}
        userStores={userStores}
      />
    </div>
  )
}
