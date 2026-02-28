import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { SizesManager } from '@/components/catalogs/sizes-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Tallas | Adiction Boutique',
  description: 'Gestión de tallas por categoría',
}

async function SizesData() {
  const supabase = await createServerClient()
  
  const [sizesResult, categoriesResult, linesResult] = await Promise.all([
    supabase.from('sizes').select('*, categories(name, line_id)').order('name'),
    supabase.from('categories').select('id, name, line_id').eq('active', true).order('name'),
    supabase.from('lines').select('id, name').eq('active', true).order('name')
  ])
  
  if (sizesResult.error) {
    throw new Error(sizesResult.error.message)
  }
  
  return <SizesManager 
    initialSizes={sizesResult.data || []} 
    categories={categoriesResult.data || []}
    lines={linesResult.data || []}
  />
}

export default function SizesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tallas</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona las tallas disponibles por categoría
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <SizesData />
      </Suspense>
    </div>
  )
}
