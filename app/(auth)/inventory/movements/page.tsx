import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { MovementsTable } from '@/components/inventory/movements-table'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { fetchAllRows } from '@/lib/supabase/paginate'

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

  // Read selected-store cookie for multi-store admins
  const cookieStore = await cookies()
  const cookieSelected = cookieStore.get('selected-store')?.value

  // Determine warehouse filter
  let warehouseFilter: string | null = null
  if (!hasAllAccess && userStores.length > 0) {
    const storeCode = userStores[0].toUpperCase()
    warehouseFilter = STORE_NAME_MAP[storeCode] ?? userStores[0]
  } else if (hasAllAccess && cookieSelected && cookieSelected !== 'ALL') {
    warehouseFilter = STORE_NAME_MAP[cookieSelected.toUpperCase()] ?? null
  }

  // Fetch ALL movements — paginated to bypass Supabase PostgREST max_rows cap (1000/request)
  const movements = await fetchAllRows<any>((from, to) => {
    let q = supabase
      .from('movements')
      .select('*, products(name, barcode)')
      .order('created_at', { ascending: false })
      .range(from, to)
    if (warehouseFilter) {
      q = q.eq('warehouse_id', warehouseFilter) as typeof q
    }
    return q
  })

  if (!movements.length && warehouseFilter) {
    // Check if it was an error vs genuinely empty — non-critical, show empty table
    console.info('[MovementsPage] 0 movements returned for warehouse:', warehouseFilter)
  }

  const normalizedMovements = movements.map(m => ({
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
        <h1 className="text-2xl font-semibold text-foreground">Movimientos de Inventario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial de entradas y salidas de productos
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <MovementsData />
      </Suspense>
    </div>
  )
}
