/**
 * GET /api/credit-plans
 *
 * Paginated credit plans grouped by client.
 * Replaces the direct Supabase query in credit-plans-view.tsx which was
 * loading ALL 2,600+ plans in one shot causing severe lag.
 *
 * Strategy — 3 targeted queries instead of 1 massive nested query:
 *   1. Paginate clients that have ACTIVE/OVERDUE plans (sorted by credit_used desc)
 *   2. Fetch plans (no installments) for those N clients
 *   3. Fetch installment aggregates for those plan IDs (overdue stats)
 *
 * Query params:
 *   page       default 1
 *   per_page   default 25, max 50
 *   search     filter by client name / phone / DNI / sale_number
 *   store      ALL | MUJERES | HOMBRES
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru } from '@/lib/utils/timezone'
import { fetchAllRows } from '@/lib/supabase/paginate'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const params = request.nextUrl.searchParams
    const page    = Math.max(1, parseInt(params.get('page') || '1'))
    const perPage = Math.min(Math.max(1, parseInt(params.get('per_page') || '25')), 50)
    const search  = params.get('search')?.trim() || ''
    const store   = params.get('store') || 'ALL'
    const offset  = (page - 1) * perPage

    // ── Query 1: Get ALL clients with active plans (just IDs + name + credit_used) ─
    // We need the full list to:
    //   a) apply search filter
    //   b) count total pages
    //   c) sort by overdue_amount (approximated via credit_used) then pick the page slice
    //
    // This is a lightweight query — no plans, no installments embedded.

    // Fetch ALL clients with active plans — paginated to bypass Supabase max_rows cap (1000/request)
    const clientsList = await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('clients')
        .select('id, name, phone, dni, credit_limit, credit_used, imported_from_legacy')
        .gt('credit_used', 0)
        .order('credit_used', { ascending: false })
        .range(from, to)
      if (search) {
        q = q.or(
          `name.ilike.%${search}%,phone.ilike.%${search}%,dni.ilike.%${search}%`
        ) as typeof q
      }
      return q
    })

    // ── Filter: only clients that actually have ACTIVE/OVERDUE plans ────────────
    // (credit_used > 0 is a good proxy but not perfect — get definitive list)
    // We do this check against plans below; for now use credit_used > 0 as pre-filter
    // and reconcile after fetching plans.

    const totalClients = clientsList.length
    const totalPages   = Math.max(1, Math.ceil(totalClients / perPage))
    const pageClients  = clientsList.slice(offset, offset + perPage)
    const pageClientIds = pageClients.map(c => c.id)

    if (pageClientIds.length === 0) {
      return NextResponse.json({
        data: [],
        total: totalClients,
        page,
        per_page: perPage,
        total_pages: totalPages,
      })
    }

    // ── Query 2: Plans for this page's clients (no installments) ────────────────
    const STORE_TEXT: Record<string, string> = {
      MUJERES: 'Tienda Mujeres',
      HOMBRES: 'Tienda Hombres',
    }

    let plansQuery = supabase
      .from('credit_plans')
      .select(`
        id,
        client_id,
        total_amount,
        installments_count,
        sale_id,
        status,
        created_at,
        imported_from_legacy,
        legacy_purchase_description,
        legacy_purchase_date,
        legacy_source,
        sale:sales ( id, sale_number, created_at, store_id )
      `)
      .in('client_id', pageClientIds)
      .in('status', ['ACTIVE', 'OVERDUE'])
      .order('created_at', { ascending: false })

    const { data: plansData, error: plansError } = await plansQuery
    if (plansError) {
      return NextResponse.json({ error: plansError.message }, { status: 500 })
    }

    const plans = plansData || []

    // Apply store filter (sales.store_id is text "Tienda Mujeres")
    const filteredPlans = store !== 'ALL'
      ? plans.filter(p => {
          const saleStore = (p.sale as any)?.store_id
          if (!saleStore) return true // legacy plans without sale — include
          return saleStore === STORE_TEXT[store]
        })
      : plans

    // Also filter by search in sale_number when search provided
    const searchFilteredPlans = search
      ? filteredPlans.filter(p => {
          const saleNum: string = (p.sale as any)?.sale_number || ''
          return (
            pageClients.some(c => c.id === p.client_id) || // already filtered clients
            saleNum.toLowerCase().includes(search.toLowerCase())
          )
        })
      : filteredPlans

    const planIds = searchFilteredPlans.map(p => p.id)

    // ── Query 3: Installment aggregates for those plan IDs ──────────────────────
    // Load ALL installments for this page's plans — only ~25 clients × ~5 plans
    // × ~6 cuotas = ~750 rows max. Totally manageable.
    let installmentsData: any[] = []
    if (planIds.length > 0) {
      const { data: insts } = await supabase
        .from('installments')
        .select('id, plan_id, installment_number, amount, paid_amount, due_date, status, paid_at')
        .in('plan_id', planIds)
        .order('due_date', { ascending: true })
      installmentsData = insts || []
    }

    const todayStr = getTodayPeru()

    // ── Aggregate: group installments by plan_id ─────────────────────────────
    const instsByPlan = new Map<string, any[]>()
    for (const inst of installmentsData) {
      if (!instsByPlan.has(inst.plan_id)) instsByPlan.set(inst.plan_id, [])
      instsByPlan.get(inst.plan_id)!.push(inst)
    }

    // ── Build per-plan enriched data ─────────────────────────────────────────
    interface PlanRow {
      plan_id: string
      sale_id: string | null
      sale_number: string | null
      sale_date: string | null
      total_amount: number
      paid_amount: number
      pending_amount: number
      installments_count: number
      overdue_count: number
      overdue_amount: number
      installments: any[]
      imported_from_legacy: boolean
      legacy_purchase_description: string | null
      legacy_purchase_date: string | null
      legacy_source: string | null
    }

    interface ClientRow {
      client_id: string
      name: string
      phone: string | null
      dni: string | null
      credit_limit: number
      total_debt: number
      overdue_count: number
      overdue_amount: number
      imported_from_legacy: boolean
      plans: PlanRow[]
    }

    const byClient = new Map<string, ClientRow>()

    // Pre-populate with page clients (preserve order)
    for (const c of pageClients) {
      byClient.set(c.id, {
        client_id: c.id,
        name: c.name,
        phone: c.phone || null,
        dni: c.dni || null,
        credit_limit: Number(c.credit_limit || 0),
        total_debt: 0,
        overdue_count: 0,
        overdue_amount: 0,
        imported_from_legacy: !!c.imported_from_legacy,
        plans: [],
      })
    }

    for (const plan of searchFilteredPlans) {
      const clientId = plan.client_id
      const clientRow = byClient.get(clientId)
      if (!clientRow) continue

      const insts = instsByPlan.get(plan.id) || []
      const paidAmt = insts.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0)
      const pendingAmt = Number(plan.total_amount) - paidAmt

      const overdueInsts = insts.filter((i: any) => {
        const balance = Number(i.amount) - Number(i.paid_amount || 0)
        return (
          balance > 0.009 &&
          i.status !== 'PAID' &&
          (i.due_date as string).split('T')[0] < todayStr
        )
      })
      const overdueAmt = overdueInsts.reduce(
        (s: number, i: any) => s + (Number(i.amount) - Number(i.paid_amount || 0)),
        0
      )

      const sale = plan.sale as any

      clientRow.plans.push({
        plan_id: plan.id,
        sale_id: plan.sale_id || null,
        sale_number: sale?.sale_number || null,
        sale_date: sale?.created_at || null,
        total_amount: Number(plan.total_amount),
        paid_amount: paidAmt,
        pending_amount: pendingAmt,
        installments_count: plan.installments_count || insts.length,
        overdue_count: overdueInsts.length,
        overdue_amount: overdueAmt,
        installments: insts,
        imported_from_legacy: !!(plan as any).imported_from_legacy,
        legacy_purchase_description: (plan as any).legacy_purchase_description || null,
        legacy_purchase_date: (plan as any).legacy_purchase_date || null,
        legacy_source: (plan as any).legacy_source || null,
      })

      clientRow.total_debt += pendingAmt
      clientRow.overdue_count += overdueInsts.length
      clientRow.overdue_amount += overdueAmt
    }

    // Remove clients with no plans (filtered out by store)
    const result = Array.from(byClient.values()).filter(c => c.plans.length > 0)

    // Re-sort: overdue first, then by total_debt
    result.sort((a, b) => b.overdue_amount - a.overdue_amount || b.total_debt - a.total_debt)

    return NextResponse.json({
      data: result,
      total: totalClients,
      page,
      per_page: perPage,
      total_pages: totalPages,
    })
  } catch (err) {
    console.error('[GET /api/credit-plans]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
