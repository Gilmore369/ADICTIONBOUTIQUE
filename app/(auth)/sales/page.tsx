/**
 * Sales History Page
 * 
 * Historial completo de ventas con dashboard de indicadores
 * Permite ver, filtrar y descargar tickets en PDF
 */

import { cookies } from 'next/headers'
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

  // Read selected-store cookie
  const cookieStore = await cookies()
  const cookieSelected = cookieStore.get('selected-store')?.value

  // Resolve store filter: locked for single-store users, cookie for multi-store admins
  let lockedStore: string | null = null
  if (userStores.length === 1) {
    lockedStore = STORE_KEY_MAP[userStores[0]] ?? userStores[0]
  } else if (isAdmin && cookieSelected && cookieSelected !== 'ALL') {
    lockedStore = STORE_KEY_MAP[cookieSelected.toUpperCase()] ?? null
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
