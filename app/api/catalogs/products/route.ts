/**
 * GET /api/catalogs/products
 *
 * Server-side paginated product catalog.
 * Replaced the old fetchAllRows approach (caused Supabase timeout with 14k+ products).
 *
 * Query params:
 *   page       number  (default 1)
 *   limit      number  (default 100, max 200)
 *   search     string  (ILIKE on name or barcode)
 *   line_id    uuid
 *   category_id uuid
 *   store_id   uuid    (filter via line_stores join)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const page       = Math.max(1, parseInt(params.get('page')  || '1'))
  const limit      = Math.min(200, Math.max(1, parseInt(params.get('limit') || '100')))
  const search     = params.get('search')      || ''
  const lineId     = params.get('line_id')     || ''
  const categoryId = params.get('category_id') || ''
  const storeId    = params.get('store_id')    || ''

  const from = (page - 1) * limit
  const to   = from + limit - 1

  // ── Build product query ──────────────────────────────────────────────────────
  let query = storeId
    ? supabase
        .from('products')
        .select(
          `*, lines:line_id!inner(id, name, line_stores!inner(store_id)),
           categories:category_id(id, name), brands:brand_id(id, name)`,
          { count: 'exact' }
        )
        .eq('active', true)
        .eq('lines.line_stores.store_id', storeId)
    : supabase
        .from('products')
        .select(
          `*, lines:line_id(id, name), categories:category_id(id, name), brands:brand_id(id, name)`,
          { count: 'exact' }
        )
        .eq('active', true)

  if (search)     query = (query as any).or(`name.ilike.%${search}%,barcode.ilike.%${search}%`)
  if (lineId)     query = (query as any).eq('line_id', lineId)
  if (categoryId) query = (query as any).eq('category_id', categoryId)

  const { data: products, count, error } = await (query as any).order('name').range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Stock — only for current page products ───────────────────────────────────
  const productIds = (products || []).map((p: any) => p.id)
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

  const result = (products || []).map((p: any) => ({
    ...p,
    stock: { quantity: stockMap[p.id] || 0 },
  }))

  // ── Lines & categories for filter dropdowns (small datasets, no pagination needed) ──
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

    const lineIds = lines.map(l => l.id)
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
    const [linesRes, catsRes] = await Promise.all([
      supabase.from('lines').select('id, name').eq('active', true).order('name'),
      supabase.from('categories').select('id, name, line_id').eq('active', true).order('name'),
    ])
    lines = linesRes.data || []
    categories = catsRes.data || []
  }

  return NextResponse.json({
    products: result,
    total: count || 0,
    page,
    limit,
    lines,
    categories,
  })
}
