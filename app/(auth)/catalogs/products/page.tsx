import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { ProductsManager } from '@/components/products/products-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { fetchAllRows } from '@/lib/supabase/paginate'

/**
 * Products Catalog Page
 * 
 * Server Component that fetches products data with related data (lines, categories, 
 * brands, stock) and renders the ProductsManager component.
 * Uses Suspense for lazy loading with skeleton.
 * 
 * Requirements: 9.1
 * Task: 8.10 Create products page
 */

async function ProductsData() {
  const supabase = await createServerClient()

  // Fetch products + stock + filtros en PARALELO para acelerar carga.
  // products y stock van con fetchAllRows (5,857 filas, ~6 batches cada uno),
  // pero al ejecutarse en paralelo el tiempo total es ~6 batches (no 12).
  const [products, stockData, linesRes, catsRes] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      supabase
        .from('products')
        .select(`
          *,
          lines:line_id(id, name),
          categories:category_id(id, name),
          brands:brand_id(id, name)
        `)
        .eq('active', true)
        .order('name')
        .range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from('stock').select('product_id, quantity').range(from, to)
    ),
    supabase.from('lines').select('id, name').eq('active', true).order('name'),
    supabase.from('categories').select('id, name, line_id').eq('active', true).order('name'),
  ])
  
  // Create a map of product_id -> total quantity
  const stockMap = new Map<string, number>()
  if (stockData) {
    stockData.forEach(stock => {
      const current = stockMap.get(stock.product_id) || 0
      stockMap.set(stock.product_id, current + stock.quantity)
    })
  }

  // Merge stock data with products
  const productsWithStock = (products || []).map(product => ({
    ...product,
    stock: {
      quantity: stockMap.get(product.id) || 0
    }
  }))

  return (
    <ProductsManager
      initialProducts={productsWithStock}
      lines={linesRes.data || []}
      categories={catsRes.data || []}
    />
  )
}

export default function ProductsPage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<TableSkeleton rows={10} columns={10} />}>
        <ProductsData />
      </Suspense>
    </div>
  )
}
