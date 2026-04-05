import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { MovementsTable } from '@/components/inventory/movements-table'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Movimientos | Adiction Boutique',
  description: 'Historial de movimientos de inventario',
}

async function MovementsData() {
  const supabase = await createServerClient()

  // Enforce store isolation
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('stores').eq('id', user.id).single()
    : { data: null }

  const userStores: string[] = (profile as any)?.stores || []

  // Get warehouse IDs for user's store(s)
  let warehouseFilter: string[] | null = null
  if (userStores.length === 1) {
    const { data: storeData } = await supabase
      .from('stores').select('id').eq('code', userStores[0].toUpperCase()).maybeSingle()
    if (storeData?.id) {
      const { data: whData } = await supabase
        .from('warehouses').select('id').eq('store_id', storeData.id)
      warehouseFilter = (whData || []).map((w: any) => w.id)
    }
  }

  let query = supabase
    .from('movements')
    .select('*, products(name, barcode)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (warehouseFilter && warehouseFilter.length > 0) {
    query = query.in('warehouse_id', warehouseFilter) as typeof query
  }

  const { data: movements, error } = await query

  if (error) {
    console.error('Error loading movements:', error)
    return <div className="text-center text-gray-500 py-8">Error al cargar movimientos</div>
  }

  const normalizedMovements = (movements || []).map(m => ({
    ...m,
    type: m.type === 'ENTRADA' || m.type === 'IN' ? 'IN' : 'OUT'
  }))

  return <MovementsTable data={normalizedMovements} />
}

export default function MovementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Movimientos de Inventario</h1>
        <p className="text-sm text-gray-600 mt-1">
          Historial de entradas y salidas de productos
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <MovementsData />
      </Suspense>
    </div>
  )
}
