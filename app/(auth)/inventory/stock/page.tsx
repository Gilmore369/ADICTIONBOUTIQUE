import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { StockManager } from '@/components/inventory/stock-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Stock | Adiction Boutique',
  description: 'Gestión de inventario por tienda',
}

// stock.warehouse_id and movements.warehouse_id store the store display name
// ('Tienda Mujeres' / 'Tienda Hombres'), NOT UUIDs.
const STORE_NAME_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

async function StockData() {
  const supabase = await createServerClient()

  // Enforce store isolation server-side
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('stores').eq('id', user.id).single()
    : { data: null }

  const userStores: string[] = (profile as any)?.stores || []

  // Determine if user is restricted to a specific store
  const hasAllAccess = userStores.length >= 2 &&
    userStores.map(s => s.toUpperCase()).includes('MUJERES') &&
    userStores.map(s => s.toUpperCase()).includes('HOMBRES')

  // Read selected-store cookie for multi-store admins
  const cookieStore = await cookies()
  const cookieSelected = cookieStore.get('selected-store')?.value  // 'ALL' | 'MUJERES' | 'HOMBRES'

  let stockQuery = supabase
    .from('stock')
    .select('*, products(id, name, barcode, min_stock)')
    .order('warehouse_id')

  if (!hasAllAccess && userStores.length > 0) {
    // Restricted user: always filter to their assigned store
    const storeCode = userStores[0].toUpperCase()
    const warehouseName = STORE_NAME_MAP[storeCode] ?? userStores[0]
    stockQuery = stockQuery.eq('warehouse_id', warehouseName) as typeof stockQuery
  } else if (hasAllAccess && cookieSelected && cookieSelected !== 'ALL') {
    // Multi-store user with specific store selected: filter by selected store
    const warehouseName = STORE_NAME_MAP[cookieSelected.toUpperCase()]
    if (warehouseName) {
      stockQuery = stockQuery.eq('warehouse_id', warehouseName) as typeof stockQuery
    }
  }

  const [stockRes, storesRes] = await Promise.all([
    stockQuery,
    supabase.from('stores').select('id, name, code')
  ])

  if (stockRes.error) throw new Error(stockRes.error.message)

  return <StockManager initialData={stockRes.data || []} stores={storesRes.data || []} />
}

export default function StockPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Stock</h1>
        <p className="text-sm text-gray-600 mt-1">
          Visualiza y gestiona el inventario por tienda
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <StockData />
      </Suspense>
    </div>
  )
}
