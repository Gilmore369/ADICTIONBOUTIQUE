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

  const [stockRes, storesRes] = await Promise.all([
    supabase.from('stock').select('*, products(id, name, barcode, min_stock)').order('warehouse_id'),
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
