import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { LinesManager } from '@/components/catalogs/lines-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Líneas | Adiction Boutique',
  description: 'Gestión de líneas de productos',
}

async function LinesData() {
  const supabase = await createServerClient()
  
  const { data: lines, error } = await supabase
    .from('lines')
    .select('*')
    .order('name')
  
  if (error) {
    throw new Error(error.message)
  }
  
  return <LinesManager initialLines={lines || []} />
}

export default function LinesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Líneas</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona las líneas de productos de tu catálogo
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <LinesData />
      </Suspense>
    </div>
  )
}
