/**
 * GET /api/payments/paginated
 *
 * Server-side paginated payment history endpoint.
 * Usa RPC `get_payments_page` + `get_payments_stats` para filtrar
 * por fecha/búsqueda/tienda y agregar en una sola operación SQL.
 *
 * Query params:
 *   page      default 1
 *   per_page  default 50, max 200
 *   search    client name / DNI / user name
 *   from, to  YYYY-MM-DD (payment_date range)
 *   store     ALL | MUJERES | HOMBRES (opcional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STORE_TEXT: Record<string, string> = {
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
    const from    = params.get('from') || ''
    const to      = params.get('to')   || ''
    const storeParam = params.get('store') || ''
    const storeFilter = storeParam && storeParam !== 'ALL' ? (STORE_TEXT[storeParam] || null) : null
    const offset  = (page - 1) * perPage

    // Paralelo: stats + página
    const [statsRes, pageRes] = await Promise.all([
      supabase.rpc('get_payments_stats', {
        p_from_date: from || null,
        p_to_date:   to   || null,
        p_search:    search,
        p_store_id:  storeFilter,
      }),
      supabase.rpc('get_payments_page', {
        p_from_date: from || null,
        p_to_date:   to   || null,
        p_search:    search,
        p_store_id:  storeFilter,
        p_offset:    offset,
        p_limit:     perPage,
      }),
    ])

    // Stats handling
    let stats = { total: 0, count: 0, avg: 0, max: 0 }
    if (!statsRes.error && statsRes.data) {
      const s = statsRes.data as any
      stats = {
        total: Number(s.total) || 0,
        count: Number(s.count) || 0,
        avg:   Number(s.avg)   || 0,
        max:   Number(s.max)   || 0,
      }
    } else if (statsRes.error) {
      console.error('[payments stats RPC]', statsRes.error)
    }

    // Page rows
    let payments: any[] = []
    if (!pageRes.error && pageRes.data) {
      payments = Array.isArray(pageRes.data) ? pageRes.data : []
    } else if (pageRes.error) {
      console.error('[payments page RPC]', pageRes.error)
    }

    const total = stats.count || 0
    return NextResponse.json({
      payments,
      total,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
      stats,
    })
  } catch (err) {
    console.error('[GET /api/payments/paginated]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
