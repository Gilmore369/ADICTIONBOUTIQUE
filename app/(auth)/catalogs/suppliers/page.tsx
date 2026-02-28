import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { SuppliersManager } from '@/components/catalogs/suppliers-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

export const metadata = {
  title: 'Proveedores | Adiction Boutique',
  description: 'Gestión de proveedores',
}

async function SuppliersData() {
  const supabase = await createServerClient()
  
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name')
  
  if (error) {
    throw new Error(error.message)
  }
  
  return <SuppliersManager initialSuppliers={suppliers || []} />
}

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Proveedores</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona los proveedores de productos
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <SuppliersData />
      </Suspense>
    </div>
  )
}
