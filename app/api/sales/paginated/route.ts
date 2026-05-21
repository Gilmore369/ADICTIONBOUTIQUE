/**
 * GET /api/sales/paginated
 *
 * Server-side paginated sales endpoint. Replaces the all-at-once server fetch
 * in app/(auth)/sales/page.tsx which was loading 41,658+ sales with JOINs and
 * causing the page to never load.
 *
 * Query params:
 *   page      default 1
 *   per_page  default 50, max 200
 *   search    filter by sale_number / client name / DNI
 *   store     ALL | MUJERES | HOMBRES
 *   period    TODAY | WEEK | MONTH | ALL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const STORE_KEY_MAP: Record<string, string> = {
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
    const period  = params.get('period') || 'ALL'
    const offset  = (page - 1) * perPage

    // Resolve store filter (locked for single-store users, cookie for admins)
    const { data: profile } = await supabase
      .from('users').select('roles, stores').eq('id', user.id).single()
    const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
    const isAdmin = userRoles.includes('admin')
    const userStores: string[] = (profile as any)?.stores || []

    const cookieStore = await cookies()
    const cookieSelected = cookieStore.get('selected-store')?.value

    let lockedStore: string | null = null
    if (userStores.length === 1) {
      lockedStore = STORE_KEY_MAP[userStores[0]] ?? userStores[0]
    } else if (isAdmin && cookieSelected && cookieSelected !== 'ALL') {
      lockedStore = STORE_KEY_MAP[cookieSelected.toUpperCase()] ?? null
    }

    // Build base query — sin JOIN a sale_items para evitar timeout en paginación profunda.
    // sale_items se obtiene on-demand al abrir el PDF/ticket (otra API)
    let q = supabase
      .from('sales')
      .select(`
        id, sale_number, created_at, sale_type, subtotal, discount, total, store_id, voided,
        clients ( id, name, dni )
      `, { count: 'estimated' })
      .order('created_at', { ascending: false })

    if (lockedStore) q = q.eq('store_id', lockedStore) as typeof q

    // Period filter
    if (period !== 'ALL') {
      const now = new Date()
      let startDate: Date
      if (period === 'TODAY') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (period === 'WEEK') {
        startDate = new Date(now); startDate.setDate(startDate.getDate() - 7)
      } else if (period === 'MONTH') {
        startDate = new Date(now); startDate.setMonth(startDate.getMonth() - 1)
      } else {
        startDate = new Date(0)
      }
      q = q.gte('created_at', startDate.toISOString()) as typeof q
    }

    // Search (sale_number contains)
    if (search) {
      q = q.ilike('sale_number', `%${search}%`) as typeof q
    }

    q = q.range(offset, offset + perPage - 1)

    const { data, count, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fetch return totals for this page's sales only
    const saleIds = (data || []).map((s: any) => s.id)
    let returnTotals = new Map<string, number>()
    if (saleIds.length > 0) {
      const { data: rets } = await supabase
        .from('returns')
        .select('sale_id, total_amount, status')
        .in('sale_id', saleIds)
        .neq('status', 'RECHAZADA')
      for (const r of rets || []) {
        const sid = String((r as any).sale_id)
        returnTotals.set(sid, (returnTotals.get(sid) || 0) + Number((r as any).total_amount || 0))
      }
    }

    const sales = (data || []).map((sale: any) => {
      const returnedTotal = Math.min(Number(sale.total || 0), returnTotals.get(sale.id) || 0)
      const netTotal = Math.max(0, Math.round((Number(sale.total || 0) - returnedTotal) * 100) / 100)
      return { ...sale, returned_total: returnedTotal, net_total: netTotal }
    })

    return NextResponse.json({
      sales,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil((count || 0) / perPage)),
      locked_store: lockedStore,
    })
  } catch (err) {
    console.error('[GET /api/sales/paginated]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
