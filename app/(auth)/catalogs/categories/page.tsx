import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { CategoriesManager } from '@/components/catalogs/categories-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Categorías | Adiction Boutique',
  description: 'Gestión de categorías de productos',
}

async function CategoriesData() {
  const supabase = await createServerClient()
  
  const [categoriesResult, linesResult] = await Promise.all([
    supabase.from('categories').select('*, lines(name)').order('name'),
    supabase.from('lines').select('id, name').eq('active', true).order('name')
  ])
  
  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message)
  }
  
  return <CategoriesManager 
    initialCategories={categoriesResult.data || []} 
    lines={linesResult.data || []}
  />
}

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Categorías</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona las categorías de productos por línea
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <CategoriesData />
      </Suspense>
    </div>
  )
}
