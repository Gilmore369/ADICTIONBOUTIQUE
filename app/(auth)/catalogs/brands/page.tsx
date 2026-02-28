import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { BrandsManager } from '@/components/catalogs/brands-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Marcas | Adiction Boutique',
  description: 'Gestión de marcas de productos',
}

async function BrandsData() {
  const supabase = await createServerClient()
  
  const [brandsResult, suppliersResult] = await Promise.all([
    supabase
      .from('brands')
      .select(`
        *,
        supplier_brands(supplier_id, suppliers(id, name))
      `)
      .order('name'),
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('active', true)
      .order('name')
  ])
  
  if (brandsResult.error) {
    throw new Error(brandsResult.error.message)
  }
  
  return <BrandsManager 
    initialBrands={brandsResult.data || []} 
    suppliers={suppliersResult.data || []}
  />
}

export default function BrandsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Marcas</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona las marcas de productos de tu catálogo
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <BrandsData />
      </Suspense>
    </div>
  )
}
