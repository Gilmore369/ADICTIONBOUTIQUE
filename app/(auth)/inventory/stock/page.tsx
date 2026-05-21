import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { StockManager } from '@/components/inventory/stock-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { fetchAllRows } from '@/lib/supabase/paginate'

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

  // Determinar filtro de warehouse antes de fetchAllRows
  let warehouseFilter: string | null = null
  if (!hasAllAccess && userStores.length > 0) {
    const storeCode = userStores[0].toUpperCase()
    warehouseFilter = STORE_NAME_MAP[storeCode] ?? userStores[0]
  } else if (hasAllAccess && cookieSelected && cookieSelected !== 'ALL') {
    warehouseFilter = STORE_NAME_MAP[cookieSelected.toUpperCase()] ?? null
  }

  // INNER JOIN con products + filtro active=true (excluye stock huérfano de soft-deleted)
  // fetchAllRows pagina en lotes de 1000 para superar el cap de PostgREST (5857 productos × 2 tiendas)
  const stockData = await fetchAllRows<any>((from, to) => {
    let q = supabase
      .from('stock')
      .select('*, products!inner(id, name, barcode, min_stock, active)')
      .eq('products.active', true)
      .order('warehouse_id')
      .range(from, to)
    if (warehouseFilter) {
      q = q.eq('warehouse_id', warehouseFilter) as typeof q
    }
    return q
  })

  const { data: storesData } = await supabase.from('stores').select('id, name, code')

  return <StockManager initialData={stockData} stores={storesData || []} />
}

export default function StockPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Stock</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualiza y gestiona el inventario por tienda
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <StockData />
      </Suspense>
    </div>
  )
}
