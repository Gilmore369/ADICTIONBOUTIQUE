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
  
  const { data: movements, error } = await supabase
    .from('movements')
    .select('*, products(name, barcode)')
    .order('created_at', { ascending: false })
    .limit(100)
  
  if (error) {
    console.error('Error loading movements:', error)
    return <div className="text-center text-gray-500 py-8">Error al cargar movimientos</div>
  }
  
  // Normalizar tipos de movimiento
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
