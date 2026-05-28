import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { ProductsManager } from '@/components/products/products-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

/**
 * Products Catalog Page — server-side paginated.
 *
 * Only loads the FIRST PAGE (100 products) on SSR.
 * Subsequent filtering / pagination is handled client-side via the
 * /api/catalogs/products API route (which uses proper DB pagination).
 *
 * Replaced old fetchAllRows pattern that caused Supabase statement timeout
 * with 14k+ products.
 */

const PAGE_LIMIT = 100

async function ProductsData() {
  const supabase = await createServerClient()

  // First page of products + count + filter data — all fast single queries
  const [productsRes, linesRes, catsRes] = await Promise.all([
    supabase
      .from('products')
      .select(
        `*, lines:line_id(id, name), categories:category_id(id, name), brands:brand_id(id, name)`,
        { count: 'exact' }
      )
      .eq('active', true)
      .order('name')
      .range(0, PAGE_LIMIT - 1),
    supabase.from('lines').select('id, name').eq('active', true).order('name'),
    supabase.from('categories').select('id, name, line_id').eq('active', true).order('name'),
  ])

  const productIds = (productsRes.data || []).map((p: any) => p.id)
  let stockMap: Record<string, number> = {}
  if (productIds.length > 0) {
    const { data: stockData } = await supabase
      .from('stock')
      .select('product_id, quantity')
      .in('product_id', productIds)
    stockData?.forEach((s: any) => {
      stockMap[s.product_id] = (stockMap[s.product_id] || 0) + s.quantity
    })
  }

  const productsWithStock = (productsRes.data || []).map((p: any) => ({
    ...p,
    stock: { quantity: stockMap[p.id] || 0 },
  }))

  return (
    <ProductsManager
      initialProducts={productsWithStock}
      initialTotal={productsRes.count || 0}
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
