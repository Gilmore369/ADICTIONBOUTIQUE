/**
 * Sales History Page
 *
 * Renders the SalesHistoryView shell — actual data is fetched client-side
 * from /api/sales/paginated (server-side pagination — 50 ventas por página)
 * para no colapsar el servidor con los 41,658+ tickets históricos.
 */

import { createServerClient } from '@/lib/supabase/server'
import { SalesHistoryView } from '@/components/sales/sales-history-view'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Historial de Ventas | Adiction Boutique',
  description: 'Historial completo de ventas con indicadores y filtros'
}

export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await (searchParams ?? Promise.resolve({}))
  const validPeriods = ['TODAY', 'WEEK', 'MONTH', 'ALL'] as const
  const initialPeriod = validPeriods.includes((params.period?.toUpperCase() as any))
    ? (params.period!.toUpperCase() as 'TODAY' | 'WEEK' | 'MONTH' | 'ALL')
    : 'ALL'

  return <SalesHistoryView initialSales={[]} lockedStore={null} initialPeriod={initialPeriod} />
}
