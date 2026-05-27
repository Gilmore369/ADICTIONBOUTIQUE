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

    // ⚠️ NO usar { count: 'exact' } — con 151k+ filas y JOIN a clients/users
    // genera statement timeout. Usamos stats.count del RPC (más abajo) como
    // total para la paginación.
    let q = supabase
      .from('payments')
      .select(`
        id, amount, payment_date, notes, receipt_url, created_at, client_id, user_id,
        clients (name, dni),
        users (name, stores)
      `)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (from) q = q.gte('payment_date', from) as typeof q
    if (to)   q = q.lte('payment_date', to)   as typeof q

    q = q.range(offset, offset + perPage - 1)

    const { data, error } = await q
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

    // Aggregate stats over the WHOLE date range (server-side via RPC).
    // El query antiguo .select('amount') estaba capeado a 1000 filas por
    // PostgREST → solo sumaba 1000 de 108,140 pagos → totales/promedios incorrectos.
    let stats = { total: 0, count: 0, avg: 0, max: 0 }
    const { data: statsRpc, error: statsErr } = await supabase.rpc('get_payments_stats', {
      p_from_date: from || null,
      p_to_date:   to   || null,
      p_search:    search,
    })
    if (!statsErr && statsRpc) {
      stats = {
        total: Number(statsRpc.total) || 0,
        count: Number(statsRpc.count) || 0,
        avg:   Number(statsRpc.avg)   || 0,
        max:   Number(statsRpc.max)   || 0,
      }
    } else if (statsErr) {
      console.error('[payments stats RPC]', statsErr)
      // Fallback: pagina y suma (lento pero correcto)
      const { fetchAllRows } = await import('@/lib/supabase/paginate')
      const allRows = await fetchAllRows<any>((f, t) => {
        let sq = supabase.from('payments').select('amount').range(f, t)
        if (from) sq = sq.gte('payment_date', from) as typeof sq
        if (to)   sq = sq.lte('payment_date', to)   as typeof sq
        return sq
      })
      const amts = allRows.map((r: any) => Number(r.amount))
      stats = {
        total: amts.reduce((s, x) => s + x, 0),
        count: amts.length,
        avg:   amts.length > 0 ? amts.reduce((s, x) => s + x, 0) / amts.length : 0,
        max:   amts.length > 0 ? Math.max(...amts) : 0,
      }
    }

    // Usamos stats.count (del RPC) como total — count='exact' en el query
    // principal hacía timeout con JOINs sobre 150k+ filas.
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
