/**
 * Payment History Page
 * /collections/history
 *
 * Shows all payments received, filterable by period and store.
 * Linked from Dashboard "Cobros del Mes" card.
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

  // Resolve store filter: only restrict if user has exactly 1 store
  // Payments → credit_plans → clients (no direct store link)
  // We filter by recording user's store membership
  let clientIds: string[] | null = null
  if (userStores.length === 1) {
    // Get clients that have credit plans where the plan was created within this store's sales
    // Simpler: show all payments — payments are global for collection purposes
    // but filter by the user_ids who belong to this store
    const { data: storeUsers } = await supabase
      .from('users')
      .select('id')
      .contains('stores', userStores)
    // We'll filter payments where user_id IN store users
    // This is passed to the client component
  }

  // Resolve period param — new values: 3M, 6M, 1Y
  const params = await (searchParams ?? Promise.resolve({}))
  const periodParam = (params.period || '3M').toUpperCase()
  const validPeriods = ['3M', '6M', '1Y']
  const initialPeriod = validPeriods.includes(periodParam) ? periodParam : '3M'

  // Always load 1 full year from DB; client-side filtering handles narrower periods
  const now = new Date()
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const fromDate = oneYearAgo.toISOString().split('T')[0]

  // Fetch payments with client and user info
  let query = supabase
    .from('payments')
    .select(`
      id,
      amount,
      payment_date,
      notes,
      receipt_url,
      created_at,
      client_id,
      user_id,
      clients (name, dni),
      users (name, stores)
    `)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (fromDate) {
    query = query.gte('payment_date', fromDate) as typeof query
  }

  const { data: payments, error } = await query

  if (error) console.error('[PaymentHistoryPage]', error)

  // Filter by store: only show payments recorded by users in the same store(s)
  const filtered = userStores.length === 1
    ? (payments || []).filter((p: any) => {
        const recorderStores: string[] = p.users?.stores || []
        return recorderStores.some((s: string) =>
          userStores.some((us: string) => s.toUpperCase() === us.toUpperCase())
        )
      })
    : (payments || [])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Historial de Cobros</h1>
        <p className="text-sm text-muted-foreground">Pagos registrados por período</p>
      </div>
      <PaymentHistoryView
        initialPayments={filtered as any[]}
        initialPeriod={initialPeriod as '3M' | '6M' | '1Y'}
        userStores={userStores}
      />
    </div>
  )
}
