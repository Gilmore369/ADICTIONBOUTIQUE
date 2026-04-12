/**
 * GET /api/catalogs/products?store_id=UUID
 * Returns products filtered by store (via line_stores join).
 * Without store_id, returns all active products (limit 100).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = request.nextUrl.searchParams.get('store_id')

  // Build product query — join through lines → line_stores when filtering by store
  let productsQuery
  if (storeId) {
    productsQuery = supabase
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
      .limit(100)
  } else {
    productsQuery = supabase
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
  }

  const { data: products, error } = await productsQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch stock and merge
  const productIds = (products || []).map((p: any) => p.id)
  let stockMap: Record<string, number> = {}
  if (productIds.length > 0) {
    const { data: stockData } = await supabase
      .from('stock')
      .select('product_id, quantity')
      .in('product_id', productIds)
    if (stockData) {
      for (const s of stockData) {
        stockMap[s.product_id] = (stockMap[s.product_id] || 0) + s.quantity
      }
    }
  }

  const result = (products || []).map((p: any) => ({
    ...p,
    stock: { quantity: stockMap[p.id] || 0 },
  }))

  // Also return filtered lines & categories for the dropdowns
  const lineIds = [...new Set(result.map((p: any) => p.line_id).filter(Boolean))]
  const catIds  = [...new Set(result.map((p: any) => p.category_id).filter(Boolean))]

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
