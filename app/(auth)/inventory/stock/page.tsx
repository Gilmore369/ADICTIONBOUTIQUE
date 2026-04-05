import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { StockManager } from '@/components/inventory/stock-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Stock | Adiction Boutique',
  description: 'Gestión de inventario por tienda',
}

async function StockData() {
  const supabase = await createServerClient()

  // Enforce store isolation server-side
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('stores').eq('id', user.id).single()
    : { data: null }

  const userStores: string[] = (profile as any)?.stores || []

  // Get warehouse IDs for user's accessible stores
  let allowedWarehouseIds: string[] | null = null
  if (userStores.length > 0 && !(userStores.length === 2 && userStores.includes('MUJERES') && userStores.includes('HOMBRES'))) {
    // Not all-access: filter to specific stores
    const { data: storeData } = await supabase
      .from('stores')
      .select('id')
      .in('code', userStores.map(s => s.toUpperCase()))
    if (storeData && storeData.length > 0) {
      const storeIds = storeData.map((s: any) => s.id)
      const { data: whData } = await supabase
        .from('warehouses').select('id').in('store_id', storeIds)
      allowedWarehouseIds = (whData || []).map((w: any) => w.id)
    }
  }

  let stockQuery = supabase
    .from('stock')
    .select('*, products(id, name, barcode, min_stock)')
    .order('warehouse_id')

  if (allowedWarehouseIds && allowedWarehouseIds.length > 0) {
    stockQuery = stockQuery.in('warehouse_id', allowedWarehouseIds) as typeof stockQuery
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
