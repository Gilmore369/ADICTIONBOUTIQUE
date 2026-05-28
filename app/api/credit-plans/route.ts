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

    const params     = request.nextUrl.searchParams
    const page       = Math.max(1, parseInt(params.get('page') || '1'))
    const perPage    = Math.min(Math.max(1, parseInt(params.get('per_page') || '25')), 50)
    const search     = params.get('search')?.trim() || ''
    const store      = params.get('store') || 'ALL'
    const minCredit  = parseFloat(params.get('min_credit') || '0')
    // status_filter: ALL | OVERDUE | UPTODATE
    const statusFilter = params.get('status_filter') || 'ALL'
    // origin: ALL | LEGACY | NEW
    const origin     = params.get('origin') || 'ALL'
    // sort: debt_desc | debt_asc | overdue_desc | name_asc | last_payment_asc
    const sort       = params.get('sort') || 'overdue_desc'
    // age_filter: ALL | NEVER | 12 | 24 | 36 | 60 | 120 (meses sin pagos)
    const ageFilter  = params.get('age_filter') || 'ALL'
    const offset     = (page - 1) * perPage

    // ── Query 1: Get ALL clients with active plans (just IDs + name + credit_used) ─
    // We need the full list to:
    //   a) apply search filter
    //   b) count total pages
    //   c) sort by overdue_amount (approximated via credit_used) then pick the page slice
    //
    // This is a lightweight query — no plans, no installments embedded.

    // ── Pre-fetch: SIEMPRE traer todos los planes ACTIVOS para identificar
    // qué clientes tienen deuda. Antes filtrábamos por credit_used > 0 pero
    // ese campo está desincronizado (944 vs 1,605 clientes únicos reales).
    const STORE_TEXT_FOR_FILTER: Record<string, string> = {
      MUJERES: 'Tienda Mujeres',
      HOMBRES: 'Tienda Hombres',
    }
    let storeClientIds: Set<string> | null = null
    let storeFilteredPlansLite: any[] = []   // {id, client_id, legacy_source}

    // Traer TODOS los planes activos siempre (lightweight). Sirve para:
    //   - filtro por tienda (storeClientIds)
    //   - lista REAL de clientes con deuda (allActivePlanClients) — bypassea credit_used
    const allActivePlans = await fetchAllRows<any>((from, to) =>
      supabase
        .from('credit_plans')
        .select('id, client_id, legacy_source, sale:sales(store_id)')
        .in('status', ['ACTIVE', 'OVERDUE'])
        .range(from, to)
    )
    const allActivePlanClients = new Set<string>(
      allActivePlans.map((p: any) => p.client_id).filter(Boolean)
    )

    if (store !== 'ALL') {
      storeFilteredPlansLite = allActivePlans.filter((p: any) => {
        const src = (p.legacy_source || '').toLowerCase()
        const saleStore = (p.sale as any)?.store_id
        const isHombres = src.includes('hombres') || src.includes('boutiquev') || saleStore === 'Tienda Hombres'
        if (store === 'HOMBRES') return isHombres
        // MUJERES: todo lo que no sea explícitamente Hombres
        // (incluye DBAdiction, Tienda Mujeres, Manual, y cualquier source sin tienda)
        if (store === 'MUJERES') return !isHombres
        return false
      })
      storeClientIds = new Set<string>()
      for (const p of storeFilteredPlansLite) {
        if (p.client_id) storeClientIds.add(p.client_id)
      }
    } else {
      // Para "Todas las tiendas", también guardamos los planes para los stats
      storeFilteredPlansLite = allActivePlans
    }

    // Fetch ALL clients (sin filtro credit_used) — paginated bypass max_rows
    const clientsListRaw = await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('clients')
        .select('id, name, phone, dni, credit_limit, credit_used, imported_from_legacy')
        .eq('active', true)
        .order('credit_used', { ascending: false })
        .range(from, to)
      if (search) {
        q = q.or(
          `name.ilike.%${search}%,phone.ilike.%${search}%,dni.ilike.%${search}%`
        ) as typeof q
      }
      if (origin === 'LEGACY') q = q.eq('imported_from_legacy', true)  as typeof q
      if (origin === 'NEW')    q = q.eq('imported_from_legacy', false) as typeof q
      return q
    })

    // ── Pre-fetch last_payment_date por cliente ───────────────────────────────
    // RPC get_clients_last_payment_date(p_client_ids) — migración 20260528000005.
    // Pasamos los IDs en chunks de 500 (bajo el cap de 1000 filas de PostgREST).
    // Cada llamada devuelve 1 fila por cliente con MAX(payment_date), sin sesgo
    // hacia pagos recientes (el bug del fallback anterior con .limit()).
    let lastPaymentByClient: Map<string, string> = new Map()
    const needsLastPayment = ageFilter !== 'ALL' || sort === 'last_payment_asc'
    if (needsLastPayment) {
      const relevantIds = Array.from(allActivePlanClients) as string[]
      const CHUNK = 500
      for (let i = 0; i < relevantIds.length; i += CHUNK) {
        const chunk = relevantIds.slice(i, i + CHUNK)
        if (chunk.length === 0) continue
        const { data: lpRows } = await supabase.rpc('get_clients_last_payment_date', {
          p_client_ids: chunk,
        })
        if (Array.isArray(lpRows)) {
          for (const r of lpRows) {
            if ((r as any).client_id && (r as any).last_payment) {
              lastPaymentByClient.set((r as any).client_id, (r as any).last_payment)
            }
          }
        }
      }
    }

    // Calcular cutoff para filtro de antigüedad
    let ageCutoffDate: string | null = null
    if (ageFilter !== 'ALL' && ageFilter !== 'NEVER') {
      const months = parseInt(ageFilter)
      if (!isNaN(months) && months > 0) {
        const d = new Date()
        d.setMonth(d.getMonth() - months)
        ageCutoffDate = d.toISOString().slice(0, 10) // YYYY-MM-DD
      }
    }

    // ── Filtros aplicables ──────────────────────────────────────────────────
    // 1) Sólo clientes con planes ACTIVOS reales
    // 2) Si hay filtro tienda, intersección con storeClientIds
    // 3) Si hay minCredit, filtrar por credit_used
    // 4) Si hay age_filter:
    //    - NEVER → solo clientes SIN registros de pago
    //    - N meses → último pago anterior a hoy-N meses (o nunca)
    const clientsList = clientsListRaw.filter(c => {
      if (storeClientIds) {
        if (!storeClientIds.has(c.id)) return false
      } else {
        if (!allActivePlanClients.has(c.id)) return false
      }
      if (minCredit > 0 && Number(c.credit_used || 0) < minCredit) return false
      if (ageFilter !== 'ALL') {
        const lp = lastPaymentByClient.get(c.id) // YYYY-MM-DD o undefined
        if (ageFilter === 'NEVER') {
          if (lp) return false
        } else if (ageCutoffDate) {
          // Incluir si NO tiene pagos, o si el último pago es <= cutoff
          if (lp && lp > ageCutoffDate) return false
        }
      }
      return true
    })

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
        legacy_notes,
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
    // For plans with sale_id=NULL (legacy BoutiqueV balance plans), use legacy_source
    const filteredPlans = store !== 'ALL'
      ? plans.filter(p => {
          const saleStore = (p.sale as any)?.store_id
          if (!saleStore) {
            // No sale linked — use legacy_source to assign store
            const src: string = ((p as any).legacy_source || '').toLowerCase()
            const isHombres = src.includes('hombres') || src.includes('boutiquev')
            if (store === 'HOMBRES') return isHombres
            // MUJERES: todo lo que no sea explícitamente Hombres (incluye Manual, DBAdiction, etc.)
            if (store === 'MUJERES') return !isHombres
            return true
          }
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
        legacy_notes: (plan as any).legacy_notes || null,
      })

      clientRow.total_debt += pendingAmt
      clientRow.overdue_count += overdueInsts.length
      clientRow.overdue_amount += overdueAmt
    }

    // Remove clients with no plans (filtered out by store)
    let result = Array.from(byClient.values()).filter(c => c.plans.length > 0)

    // Status filter at page level (since overdue is computed post-fetch)
    if (statusFilter === 'OVERDUE')   result = result.filter(c => c.overdue_count > 0)
    if (statusFilter === 'UPTODATE')  result = result.filter(c => c.overdue_count === 0)

    // Anexar last_payment al resultado (útil para mostrarlo en UI)
    for (const c of result) {
      const lp = lastPaymentByClient.get(c.client_id)
      ;(c as any).last_payment = lp || null
    }

    // Sort
    if (sort === 'debt_desc')         result.sort((a, b) => b.total_debt - a.total_debt)
    else if (sort === 'debt_asc')     result.sort((a, b) => a.total_debt - b.total_debt)
    else if (sort === 'name_asc')     result.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'last_payment_asc') result.sort((a, b) => {
      const la = (a as any).last_payment || '0000-00-00'
      const lb = (b as any).last_payment || '0000-00-00'
      return la.localeCompare(lb)  // más antiguo primero
    })
    else /* overdue_desc default */   result.sort((a, b) => b.overdue_amount - a.overdue_amount || b.total_debt - a.total_debt)

    // ── Stats globales — filtrados por tienda si aplica ──────────────────────
    let globalDebt = 0
    let globalOverdue = 0
    try {
      if (store === 'ALL') {
        // Sin filtro: usar RPC del dashboard (1 query SQL)
        const { data: dash } = await supabase.rpc('get_dashboard_metrics', { p_inactivity_days: 90 })
        if (dash) {
          globalDebt    = Number((dash as any).totalOutstandingDebt) || 0
          globalOverdue = Number((dash as any).totalOverdueDebt)     || 0
        }
      } else if (storeFilteredPlansLite.length > 0) {
        // Con filtro tienda: agregar installments de planes filtrados.
        // Chunkeamos por URL limit (.in con +500 UUIDs revienta headers).
        const planIds = storeFilteredPlansLite.map(p => p.id)
        const CHUNK = 200
        for (let i = 0; i < planIds.length; i += CHUNK) {
          const chunkIds = planIds.slice(i, i + CHUNK)
          const { data: insts } = await supabase
            .from('installments')
            .select('amount, paid_amount, due_date, status')
            .in('plan_id', chunkIds)
            .neq('status', 'PAID')
          for (const inst of (insts || [])) {
            const balance = Math.max(0, Number((inst as any).amount) - Number((inst as any).paid_amount || 0))
            globalDebt += balance
            if (balance > 0.009 && ((inst as any).due_date as string).split('T')[0] < todayStr) {
              globalOverdue += balance
            }
          }
        }
      }
    } catch (statsErr) {
      console.error('[credit-plans stats]', statsErr)
    }

    return NextResponse.json({
      data: result,
      total: totalClients,
      page,
      per_page: perPage,
      total_pages: totalPages,
      stats: {
        total_debt: globalDebt,
        overdue: globalOverdue,
      },
    })
  } catch (err) {
    console.error('[GET /api/credit-plans]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
