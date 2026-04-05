import { Suspense } from 'react'
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
  // Users with exactly 1 store (or not both stores) are restricted
  const hasAllAccess = userStores.length >= 2 &&
    userStores.map(s => s.toUpperCase()).includes('MUJERES') &&
    userStores.map(s => s.toUpperCase()).includes('HOMBRES')

  let stockQuery = supabase
    .from('stock')
    .select('*, products(id, name, barcode, min_stock)')
    .order('warehouse_id')

  if (!hasAllAccess && userStores.length > 0) {
    // Filter by the store name used in warehouse_id column
    const storeCode = userStores[0].toUpperCase()
    const warehouseName = STORE_NAME_MAP[storeCode] ?? userStores[0]
    stockQuery = stockQuery.eq('warehouse_id', warehouseName) as typeof stockQuery
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
