/**
 * GET /api/sales/paginated
 *
 * Server-side paginated sales endpoint.
 *
 * Query params:
 *   page      default 1
 *   per_page  default 50, max 200
 *   search    filter by sale_number
 *   store     ALL | MUJERES | HOMBRES
 *   period    TODAY | WEEK | MONTH | 3MONTHS | 6MONTHS | 12MONTHS | YEAR | LASTYEAR | ALL | CUSTOM
 *   from, to  YYYY-MM-DD (only when period=CUSTOM)
 *
 * Returns:
 *   sales[]            current page
 *   total, total_pages
 *   stats { total, contado, credito, count, contado_count, credito_count, avg }
 *     ↑ aggregated over the FULL filtered range, not just the current page
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const STORE_KEY_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

function resolvePeriodRange(period: string, customFrom?: string, customTo?: string): { from: Date | null; to: Date | null } {
  const now = new Date()
  if (period === 'TODAY') {
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: null }
  }
  if (period === 'WEEK') {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    return { from: d, to: null }
  }
  if (period === 'MONTH') {
    const d = new Date(now); d.setMonth(d.getMonth() - 1)
    return { from: d, to: null }
  }
  if (period === '3MONTHS') {
    const d = new Date(now); d.setMonth(d.getMonth() - 3)
    return { from: d, to: null }
  }
  if (period === '6MONTHS') {
    const d = new Date(now); d.setMonth(d.getMonth() - 6)
    return { from: d, to: null }
  }
  if (period === '12MONTHS') {
    const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
    return { from: d, to: null }
  }
  if (period === 'YEAR') {
    return { from: new Date(now.getFullYear(), 0, 1), to: null }
  }
  if (period === 'LASTYEAR') {
    return {
      from: new Date(now.getFullYear() - 1, 0, 1),
      to:   new Date(now.getFullYear(), 0, 1),
    }
  }
  if (period === 'CUSTOM') {
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00.000Z`) : null,
      to:   customTo   ? new Date(`${customTo}T23:59:59.999Z`)   : null,
    }
  }
  return { from: null, to: null } // ALL
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
    const period  = params.get('period') || 'ALL'
    const customFrom = params.get('from') || ''
    const customTo   = params.get('to')   || ''
    const storeParam = params.get('store') || ''
    const offset  = (page - 1) * perPage

    // Resolve store filter (locked for single-store users, cookie for admins, or explicit param)
    const { data: profile } = await supabase
      .from('users').select('roles, stores').eq('id', user.id).single()
    const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
    const isAdmin = userRoles.includes('admin')
    const userStores: string[] = (profile as any)?.stores || []

    const cookieStore = await cookies()
    const cookieSelected = cookieStore.get('selected-store')?.value

    let storeFilter: string | null = null
    if (userStores.length === 1) {
      storeFilter = STORE_KEY_MAP[userStores[0]] ?? userStores[0]
    } else if (storeParam && storeParam !== 'ALL') {
      storeFilter = storeParam.startsWith('Tienda') ? storeParam : (STORE_KEY_MAP[storeParam.toUpperCase()] ?? null)
    } else if (isAdmin && cookieSelected && cookieSelected !== 'ALL') {
      storeFilter = STORE_KEY_MAP[cookieSelected.toUpperCase()] ?? null
    }

    const { from: fromDate, to: toDate } = resolvePeriodRange(period, customFrom, customTo)

    // ── Helper to apply filters to any query ──────────────────────────────────
    const applyFilters = <T extends any>(q: T): T => {
      let r: any = q
      if (storeFilter) r = r.eq('store_id', storeFilter)
      if (fromDate) r = r.gte('created_at', fromDate.toISOString())
      if (toDate)   r = r.lt('created_at',  toDate.toISOString())
      if (search)   r = r.ilike('sale_number', `%${search}%`)
      return r as T
    }

    // ── 1. Page data ──────────────────────────────────────────────────────────
    const pageQ = applyFilters(
      supabase
        .from('sales')
        .select(`
          id, sale_number, created_at, sale_type, subtotal, discount, total, store_id, voided,
          clients ( id, name, dni )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1)
    )

    // ── 2. Aggregated stats over the FULL filtered range ─────────────────────
    // We need totals per sale_type (CONTADO vs CREDITO). Query totals via aggregation.
    // Supabase JS doesn't support SUM aggregates directly via PostgREST without an RPC,
    // so we fetch (id, total, sale_type, voided) for the whole range — typically <= 5k rows.
    const statsQ = applyFilters(
      supabase
        .from('sales')
        .select('id, total, sale_type, voided')
        .eq('voided', false)
    )

    const [pageRes, statsRes] = await Promise.all([pageQ, statsQ])

    if (pageRes.error) return NextResponse.json({ error: pageRes.error.message }, { status: 500 })

    // ── 3. Returns deduction for both page sales AND stats ───────────────────
    const allSaleIds = new Set<string>()
    for (const s of pageRes.data || []) allSaleIds.add((s as any).id)
    for (const s of statsRes.data || []) allSaleIds.add((s as any).id)

    const returnTotals = new Map<string, number>()
    if (allSaleIds.size > 0) {
      // Chunk to avoid URL-too-long when >1000 ids
      const ids = [...allSaleIds]
      const CHUNK = 500
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK)
        const { data: rets } = await supabase
          .from('returns')
          .select('sale_id, total_amount, status')
          .in('sale_id', slice)
          .neq('status', 'RECHAZADA')
        for (const r of rets || []) {
          const sid = String((r as any).sale_id)
          returnTotals.set(sid, (returnTotals.get(sid) || 0) + Number((r as any).total_amount || 0))
        }
      }
    }

    const netOf = (sale: any): number => {
      const returned = Math.min(Number(sale.total || 0), returnTotals.get(sale.id) || 0)
      return Math.max(0, Math.round((Number(sale.total || 0) - returned) * 100) / 100)
    }

    // Page sales with net_total
    const sales = (pageRes.data || []).map((sale: any) => {
      const returnedTotal = Math.min(Number(sale.total || 0), returnTotals.get(sale.id) || 0)
      const netTotal = netOf(sale)
      return { ...sale, returned_total: returnedTotal, net_total: netTotal }
    })

    // Aggregated stats over full filter
    let totalNet = 0, contadoNet = 0, creditoNet = 0
    let count = 0, contadoCount = 0, creditoCount = 0
    for (const s of statsRes.data || []) {
      const n = netOf(s)
      totalNet += n
      count++
      if ((s as any).sale_type === 'CONTADO') { contadoNet += n; contadoCount++ }
      else if ((s as any).sale_type === 'CREDITO') { creditoNet += n; creditoCount++ }
    }
    const stats = {
      total: totalNet,
      contado: contadoNet,
      credito: creditoNet,
      count, contado_count: contadoCount, credito_count: creditoCount,
      avg: count > 0 ? totalNet / count : 0,
    }

    return NextResponse.json({
      sales,
      total: pageRes.count || 0,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil((pageRes.count || 0) / perPage)),
      locked_store: userStores.length === 1 ? storeFilter : null,
      stats,
    })
  } catch (err) {
    console.error('[GET /api/sales/paginated]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
