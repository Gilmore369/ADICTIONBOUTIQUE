/**
 * GET /api/inventory/movements/paginated
 *
 * Server-side paginated stock movements endpoint.
 * Replaces the all-at-once server fetch that was loading 86,000+ movements.
 *
 * Query params:
 *   page      default 1
 *   per_page  default 50, max 200
 *   search    barcode / product name
 *   warehouse forced for single-store users; cookie for admins
 *   type      IN | OUT | ALL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const STORE_NAME_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const params  = request.nextUrl.searchParams
    const page    = Math.max(1, parseInt(params.get('page') || '1'))
    const perPage = Math.min(200, Math.max(10, parseInt(params.get('per_page') || '50')))
    const search  = params.get('search')?.trim() || ''
    const typeFilter = params.get('type') || 'ALL'
    const fromDate = params.get('from') || ''   // YYYY-MM-DD
    const toDate   = params.get('to')   || ''   // YYYY-MM-DD
    const offset  = (page - 1) * perPage

    // Resolve warehouse filter
    const { data: profile } = await supabase
      .from('users').select('stores').eq('id', user.id).single()
    const userStores: string[] = (profile as any)?.stores || []
    const hasAllAccess = userStores.length >= 2 &&
      userStores.map(s => s.toUpperCase()).includes('MUJERES') &&
      userStores.map(s => s.toUpperCase()).includes('HOMBRES')

    const cookieStore = await cookies()
    const cookieSelected = cookieStore.get('selected-store')?.value

    let warehouseFilter: string | null = null
    if (!hasAllAccess && userStores.length > 0) {
      const storeCode = userStores[0].toUpperCase()
      warehouseFilter = STORE_NAME_MAP[storeCode] ?? userStores[0]
    } else if (hasAllAccess && cookieSelected && cookieSelected !== 'ALL') {
      warehouseFilter = STORE_NAME_MAP[cookieSelected.toUpperCase()] ?? null
    }

    let q = supabase
      .from('movements')
      .select('*, products(name, barcode)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (warehouseFilter) q = q.eq('warehouse_id', warehouseFilter) as typeof q
    if (typeFilter === 'IN')  q = q.in('type', ['IN', 'ENTRADA']) as typeof q
    if (typeFilter === 'OUT') q = q.in('type', ['OUT', 'SALIDA']) as typeof q
    if (fromDate) q = q.gte('created_at', `${fromDate}T00:00:00Z`) as typeof q
    if (toDate)   q = q.lte('created_at', `${toDate}T23:59:59Z`)   as typeof q

    q = q.range(offset, offset + perPage - 1)

    const { data, count, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let movements = (data || []).map((m: any) => ({
      ...m,
      type: m.type === 'ENTRADA' || m.type === 'IN' ? 'IN' : 'OUT'
    }))

    // In-memory search post-filter (since search applies to joined product fields)
    if (search) {
      const q = search.toLowerCase()
      movements = movements.filter((m: any) =>
        m.products?.name?.toLowerCase().includes(q) ||
        m.products?.barcode?.toLowerCase().includes(q)
      )
    }

    const singleStoreName = !hasAllAccess && userStores.length > 0
      ? (STORE_NAME_MAP[userStores[0].toUpperCase()] ?? userStores[0])
      : null

    return NextResponse.json({
      movements,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil((count || 0) / perPage)),
      single_store: singleStoreName,
    })
  } catch (err) {
    console.error('[GET /api/inventory/movements/paginated]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
