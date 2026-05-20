/**
 * GET /api/clients/paginated
 *
 * Server-side paginated clients list. Replaces loading ALL 4,927+ clients
 * at once. Returns only the requested page + total count.
 *
 * Query params:
 *   page            default 1
 *   per_page        default 50, max 200
 *   search          name / DNI / phone substring
 *   status          ACTIVO | INACTIVO  (default ACTIVO)
 *   rating          comma-separated: A,B,C,D,E
 *   debt_status     CON_DEUDA | AL_DIA | MOROSO
 *   blacklisted     true  (filter to blacklisted only)
 *   birthday_month  1-12  (requires full-scan; rare use case)
 *   days_since      number (days since last purchase; full-scan)
 *
 * Response: { clients, total, pages, blacklisted_total }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchAllRows } from '@/lib/supabase/paginate'

export const dynamic = 'force-dynamic'

const SELECT_COLS =
  'id, dni, name, phone, rating, rating_score, last_purchase_date, credit_used, active, deactivation_reason, blacklisted, birthday, imported_from_legacy'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const params  = request.nextUrl.searchParams

    const page           = Math.max(1, parseInt(params.get('page') || '1'))
    const perPage        = Math.min(200, Math.max(10, parseInt(params.get('per_page') || '50')))
    const search         = params.get('search')?.trim() || ''
    const status         = params.get('status') || 'ACTIVO'
    const ratings        = params.get('rating')?.split(',').filter(Boolean) || []
    const debtStatus     = params.get('debt_status') || ''
    const blacklistedOnly = params.get('blacklisted') === 'true'
    const birthdayMonth  = params.get('birthday_month') ? parseInt(params.get('birthday_month')!) : null
    const daysSince      = params.get('days_since') ? parseInt(params.get('days_since')!) : null

    const offset = (page - 1) * perPage

    // Helper: apply common filters to a query builder
    const applyFilters = (q: any) => {
      if (status === 'ACTIVO')   q = q.eq('active', true)
      else if (status === 'INACTIVO') q = q.eq('active', false)
      if (search) q = q.or(`name.ilike.%${search}%,dni.ilike.%${search}%,phone.ilike.%${search}%`)
      if (ratings.length > 0)   q = q.in('rating', ratings)
      if (blacklistedOnly)       q = q.eq('blacklisted', true)
      if (debtStatus === 'CON_DEUDA' || debtStatus === 'MOROSO') q = q.gt('credit_used', 0)
      if (debtStatus === 'AL_DIA') q = q.eq('credit_used', 0)
      return q
    }

    // ── Special full-scan path: birthday_month or days_since ──────────────
    // These require client-side logic after fetching all matching rows.
    // They're rare use cases; full-scan is acceptable.
    if (birthdayMonth !== null || daysSince !== null) {
      let all = await fetchAllRows<any>((from, to) =>
        applyFilters(
          service.from('clients')
            .select(SELECT_COLS)
            .order('blacklisted', { ascending: false })
            .order('name')
            .range(from, to)
        )
      )

      if (birthdayMonth !== null) {
        all = all.filter((c: any) => {
          if (!c.birthday) return false
          return new Date(c.birthday).getUTCMonth() + 1 === birthdayMonth
        })
      }
      if (daysSince !== null) {
        const now = Date.now()
        all = all.filter((c: any) => {
          if (!c.last_purchase_date) return false
          return (now - new Date(c.last_purchase_date).getTime()) / 86_400_000 > daysSince!
        })
      }

      const total = all.length
      return NextResponse.json({
        clients: all.slice(offset, offset + perPage),
        total,
        pages: Math.max(1, Math.ceil(total / perPage)),
        blacklisted_total: null, // not computed in full-scan path
      })
    }

    // ── Normal path: server-side pagination with exact count ──────────────
    const [mainResult, blCountResult] = await Promise.all([
      applyFilters(
        service.from('clients')
          .select(SELECT_COLS, { count: 'exact' })
          .order('blacklisted', { ascending: false })
          .order('name')
          .range(offset, offset + perPage - 1)
      ),
      // Blacklisted count for the "Lista Negra (N)" button — only when on ACTIVO view
      status === 'ACTIVO'
        ? service.from('clients').select('id', { count: 'exact', head: true }).eq('active', true).eq('blacklisted', true)
        : Promise.resolve({ count: 0, error: null }),
    ])

    if (mainResult.error) {
      return NextResponse.json({ error: mainResult.error.message }, { status: 500 })
    }

    return NextResponse.json({
      clients:          mainResult.data || [],
      total:            mainResult.count || 0,
      pages:            Math.max(1, Math.ceil((mainResult.count || 0) / perPage)),
      blacklisted_total: blCountResult.count ?? null,
    })
  } catch (err: any) {
    console.error('[/api/clients/paginated]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
