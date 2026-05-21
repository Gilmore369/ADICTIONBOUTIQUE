/**
 * GET /api/catalogs/products?store_id=UUID
 * Returns ALL active products (paginated via fetchAllRows to bypass PostgREST 1000-row cap).
 * Optionally filtered by store (via line_stores join).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = request.nextUrl.searchParams.get('store_id')

  // Build product query — paginar todos los productos activos (5,857+)
  const products = await fetchAllRows<any>((from, to) => {
    if (storeId) {
      return supabase
        .from('products')
        .select(`
          *,
          lines:line_id!inner(
            id, name,
            line_stores!inner(store_id)
          ),
          categories:category_id(id, name),
          brands:brand_id(id, name)
        `)
        .eq('active', true)
        .eq('lines.line_stores.store_id', storeId)
        .order('name')
        .range(from, to)
    }
    return supabase
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
  })

  // Fetch stock — también paginado (5,857+ rows en stock)
  const productIds = products.map((p: any) => p.id)
  let stockMap: Record<string, number> = {}
  if (productIds.length > 0) {
    const stockData = await fetchAllRows<any>((from, to) =>
      supabase.from('stock').select('product_id, quantity').range(from, to)
    )
    const idSet = new Set(productIds)
    for (const s of stockData) {
      if (idSet.has(s.product_id)) {
        stockMap[s.product_id] = (stockMap[s.product_id] || 0) + s.quantity
      }
    }
  }

  const result = products.map((p: any) => ({
    ...p,
    stock: { quantity: stockMap[p.id] || 0 },
  }))

  // Also return filtered lines & categories for the dropdowns
  const lineIds = [...new Set(result.map((p: any) => p.line_id).filter(Boolean))]

  let lines: any[] = []
  let categories: any[] = []

  if (storeId) {
    const { data: linesData } = await supabase
      .from('lines')
      .select('id, name, line_stores!inner(store_id)')
      .eq('active', true)
      .eq('line_stores.store_id', storeId)
      .order('name')
    lines = linesData || []

    if (lineIds.length > 0) {
      const { data: catsData } = await supabase
        .from('categories')
        .select('id, name, line_id')
        .eq('active', true)
        .in('line_id', lineIds)
        .order('name')
      categories = catsData || []
    }
  } else {
    const { data: linesData } = await supabase
      .from('lines').select('id, name').eq('active', true).order('name')
    lines = linesData || []
    const { data: catsData } = await supabase
      .from('categories').select('id, name, line_id').eq('active', true).order('name')
    categories = catsData || []
  }

  return NextResponse.json({ products: result, lines, categories })
}
