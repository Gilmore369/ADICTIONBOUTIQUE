import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { MovementsTable } from '@/components/inventory/movements-table'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Movimientos | Adiction Boutique',
  description: 'Historial de movimientos de inventario',
}

// stock.warehouse_id and movements.warehouse_id store the store display name
// ('Tienda Mujeres' / 'Tienda Hombres'), NOT UUIDs.
const STORE_NAME_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

async function MovementsData() {
  const supabase = await createServerClient()

  // Enforce store isolation
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('stores').eq('id', user.id).single()
    : { data: null }

  const userStores: string[] = (profile as any)?.stores || []

  const hasAllAccess = userStores.length >= 2 &&
    userStores.map(s => s.toUpperCase()).includes('MUJERES') &&
    userStores.map(s => s.toUpperCase()).includes('HOMBRES')

  let query = supabase
    .from('movements')
    .select('*, products(name, barcode)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!hasAllAccess && userStores.length > 0) {
    const storeCode = userStores[0].toUpperCase()
    const warehouseName = STORE_NAME_MAP[storeCode] ?? userStores[0]
    query = query.eq('warehouse_id', warehouseName) as typeof query
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

  // Single-store users: hide the store filter UI and "Tienda" column
  const singleStoreName = !hasAllAccess && userStores.length > 0
    ? (STORE_NAME_MAP[userStores[0].toUpperCase()] ?? userStores[0])
    : undefined

  return <MovementsTable data={normalizedMovements} singleStore={singleStoreName} />
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
