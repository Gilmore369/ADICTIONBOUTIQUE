/**
 * GET /api/payments/paginated
 *
 * Server-side paginated payment history endpoint.
 * Replaces the all-at-once fetchAllRows in /collections/history that was loading
 * everything (366+ rows with JOINs) and causing the page to lag.
 *
 * Query params:
 *   page      default 1
 *   per_page  default 50, max 200
 *   search    client name / DNI / user name
 *   from, to  YYYY-MM-DD (payment_date range)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    const offset  = (page - 1) * perPage

    let q = supabase
      .from('payments')
      .select(`
        id, amount, payment_date, notes, receipt_url, created_at, client_id, user_id,
        clients (name, dni),
        users (name, stores)
      `, { count: 'exact' })
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (from) q = q.gte('payment_date', from) as typeof q
    if (to)   q = q.lte('payment_date', to)   as typeof q

    q = q.range(offset, offset + perPage - 1)

    const { data, count, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let payments = data || []

    // In-memory search (joins fields can't easily go in ilike OR)
    if (search) {
      const s = search.toLowerCase()
      payments = payments.filter((p: any) =>
        p.clients?.name?.toLowerCase().includes(s) ||
        p.clients?.dni?.includes(search) ||
        p.users?.name?.toLowerCase().includes(s)
      )
    }

    // Aggregate stats over the WHOLE date range (not just current page)
    let stats = { total: 0, count: 0, avg: 0, max: 0 }
    if (from || to) {
      let statsQ = supabase.from('payments').select('amount', { count: 'exact' })
      if (from) statsQ = statsQ.gte('payment_date', from) as typeof statsQ
      if (to)   statsQ = statsQ.lte('payment_date', to)   as typeof statsQ
      const { data: allAmounts, count: statsCount } = await statsQ
      if (allAmounts) {
        const amts = (allAmounts as any[]).map(r => Number(r.amount))
        stats.total = amts.reduce((s, x) => s + x, 0)
        stats.count = statsCount || amts.length
        stats.avg   = stats.count > 0 ? stats.total / stats.count : 0
        stats.max   = amts.length > 0 ? Math.max(...amts) : 0
      }
    }

    return NextResponse.json({
      payments,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil((count || 0) / perPage)),
      stats,
    })
  } catch (err) {
    console.error('[GET /api/payments/paginated]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
