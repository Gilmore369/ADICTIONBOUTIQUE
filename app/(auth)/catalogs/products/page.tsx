import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { ProductsManager } from '@/components/products/products-manager'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

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
  
  // Fetch only first 100 products for initial load (performance optimization)
  // Full search will be handled client-side with debouncing
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      *,
      lines:line_id(id, name),
      categories:category_id(id, name),
      brands:brand_id(id, name)
    `)
    .eq('active', true)
    .order('name')
    .limit(100)
  
  if (error) {
    throw new Error(`Error loading products: ${error.message}`)
  }

  // Fetch stock separately and merge with products
  const { data: stockData } = await supabase
    .from('stock')
    .select('product_id, quantity')
  
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

  // Fetch lines and categories for filters
  const { data: lines } = await supabase
    .from('lines')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, line_id')
    .eq('active', true)
    .order('name')
  
  return (
    <ProductsManager 
      initialProducts={productsWithStock} 
      lines={lines || []}
      categories={categories || []}
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
