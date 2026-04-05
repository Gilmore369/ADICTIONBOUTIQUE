/**
 * Sales History Page
 * 
 * Historial completo de ventas con dashboard de indicadores
 * Permite ver, filtrar y descargar tickets en PDF
 */

import { createServerClient } from '@/lib/supabase/server'
import { SalesHistoryView } from '@/components/sales/sales-history-view'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Historial de Ventas | Adiction Boutique',
  description: 'Historial completo de ventas con indicadores y filtros'
}

const STORE_KEY_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>
}) {
  const supabase = await createServerClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user profile to enforce store isolation
  const { data: profile } = await supabase
    .from('users')
    .select('roles, stores')
    .eq('id', user.id)
    .single()

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  const isAdmin = userRoles.includes('admin')
  const userStores: string[] = (profile as any)?.stores || []

  // Resolve locked store for non-admin with a single store
  let lockedStore: string | null = null
  if (!isAdmin && userStores.length === 1) {
    lockedStore = STORE_KEY_MAP[userStores[0]] ?? userStores[0]
  }

  // Build query — filter by store if restricted
  let query = supabase
    .from('sales')
    .select(`
      id,
      sale_number,
      created_at,
      sale_type,
      subtotal,
      discount,
      total,
      store_id,
      voided,
      clients (
        id,
        name,
        dni
      ),
      sale_items (
        id,
        quantity,
        unit_price,
        subtotal,
        products (
          name
        )
      )
    `)
    .eq('voided', false)
    .order('created_at', { ascending: false })
    .limit(200)

  if (lockedStore) {
    query = query.eq('store_id', lockedStore) as typeof query
  }

  const { data: sales, error } = await query

  if (error) {
    console.error('Error fetching sales:', error)
  }

  const params = await (searchParams ?? Promise.resolve({}))
  const validPeriods = ['TODAY', 'WEEK', 'MONTH', 'ALL'] as const
  const initialPeriod = validPeriods.includes((params.period?.toUpperCase() as any))
    ? (params.period!.toUpperCase() as 'TODAY' | 'WEEK' | 'MONTH' | 'ALL')
    : 'ALL'

  return <SalesHistoryView initialSales={sales || []} lockedStore={lockedStore} initialPeriod={initialPeriod} />
}
