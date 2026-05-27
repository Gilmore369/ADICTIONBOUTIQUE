/**
 * GET /api/reports/comparative-metrics
 *
 * Computa indicadores agregados para 2 períodos (A y B) y devuelve
 * los valores + diferencias (absoluta y porcentual) para comparar.
 *
 * Query params:
 *   from_a, to_a   YYYY-MM-DD del período A (obligatorios)
 *   from_b, to_b   YYYY-MM-DD del período B (obligatorios)
 *   store          ALL | MUJERES | HOMBRES (opcional, default ALL)
 *
 * Métricas devueltas (por período):
 *   sales_total          → SUM(sales.total) NETO (menos devoluciones), no anuladas
 *   sales_count          → COUNT(sales)
 *   sales_contado        → SUM neto contado
 *   sales_credito        → SUM neto crédito
 *   avg_ticket           → sales_total / sales_count
 *   payments_total       → SUM(payments.amount) por payment_date
 *   payments_count       → COUNT(payments)
 *   new_clients          → COUNT(clients creados en el período)
 *   active_clients       → COUNT(distinct clients con venta en el período)
 *   units_sold           → SUM(sale_items.quantity) en el período
 *   stock_in             → SUM(movements.quantity) tipo ENTRADA
 *   stock_out            → SUM(movements.quantity) tipo SALIDA
 *   stock_adjustments    → COUNT(movements) tipo AJUSTE
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchAllRows } from '@/lib/supabase/paginate'

export const dynamic = 'force-dynamic'

const STORE_TEXT: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

interface PeriodMetrics {
  sales_total: number
  sales_count: number
  sales_contado: number
  sales_credito: number
  avg_ticket: number
  payments_total: number
  payments_count: number
  new_clients: number
  active_clients: number
  units_sold: number
  stock_in: number
  stock_out: number
  stock_adjustments: number
}

async function computePeriod(
  svc: ReturnType<typeof createServiceClient>,
  fromDate: string,
  toDate: string,
  storeFilter: string | null,
): Promise<PeriodMetrics> {
  const fromIso = `${fromDate}T00:00:00.000Z`
  // Inclusive to end of day
  const toIso   = `${toDate}T23:59:59.999Z`

  // ── Sales — fetch lightweight rows for the period ───────────────────────
  const sales = await fetchAllRows<any>((from, to) => {
    let q = svc.from('sales')
      .select('id, total, sale_type, voided')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .eq('voided', false)
      .range(from, to)
    if (storeFilter) q = q.eq('store_id', storeFilter) as typeof q
    return q
  })

  const saleIds = sales.map((s: any) => s.id)

  // ── Returns para descontar (chunked .in() para evitar HeadersOverflow) ──
  const returnTotalsMap = new Map<string, number>()
  if (saleIds.length > 0) {
    const CHUNK = 200
    const chunks: string[][] = []
    for (let i = 0; i < saleIds.length; i += CHUNK) chunks.push(saleIds.slice(i, i + CHUNK))
    const retResults = await Promise.all(chunks.map(chunk =>
      svc.from('returns')
        .select('sale_id, total_amount')
        .in('sale_id', chunk)
        .neq('status', 'RECHAZADA')
    ))
    for (const r of retResults) {
      for (const row of (r.data || [])) {
        const sid = String((row as any).sale_id)
        returnTotalsMap.set(sid, (returnTotalsMap.get(sid) || 0) + Number((row as any).total_amount || 0))
      }
    }
  }

  // Compute net totals
  let salesTotal = 0, salesContado = 0, salesCredito = 0
  let salesCount = 0
  for (const s of sales) {
    const ret = returnTotalsMap.get(s.id) || 0
    const net = Math.max(0, Math.round((Number(s.total || 0) - ret) * 100) / 100)
    salesTotal += net
    salesCount++
    if (s.sale_type === 'CONTADO') salesContado += net
    else if (s.sale_type === 'CREDITO') salesCredito += net
  }
  const avgTicket = salesCount > 0 ? salesTotal / salesCount : 0

  // ── Active clients (distinct clients with sales in period) ─────────────
  let activeClients = 0
  if (saleIds.length > 0) {
    const saleClientsRes = await fetchAllRows<any>((from, to) => {
      let q = svc.from('sales')
        .select('client_id')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .eq('voided', false)
        .not('client_id', 'is', null)
        .range(from, to)
      if (storeFilter) q = q.eq('store_id', storeFilter) as typeof q
      return q
    })
    activeClients = new Set(saleClientsRes.map(r => r.client_id)).size
  }

  // ── Sale items — units sold ─────────────────────────────────────────────
  let unitsSold = 0
  if (saleIds.length > 0) {
    const CHUNK = 200
    const chunks: string[][] = []
    for (let i = 0; i < saleIds.length; i += CHUNK) chunks.push(saleIds.slice(i, i + CHUNK))
    const itemResults = await Promise.all(chunks.map(chunk =>
      svc.from('sale_items').select('quantity').in('sale_id', chunk)
    ))
    for (const r of itemResults) {
      for (const row of (r.data || [])) {
        unitsSold += Number((row as any).quantity || 0)
      }
    }
  }

  // ── Payments by payment_date ────────────────────────────────────────────
  // Para filtrar por tienda, identificamos clients que tienen al menos un plan
  // de la tienda. Para ALL, sin filtro.
  let paymentsTotal = 0, paymentsCount = 0
  if (storeFilter) {
    // Get client_ids that have plans in this store
    const planClients = await fetchAllRows<any>((from, to) =>
      svc.from('credit_plans')
        .select('client_id, legacy_source, sale:sales(store_id)')
        .range(from, to)
    )
    const clientIdsSet = new Set<string>()
    for (const p of planClients) {
      const src = (p.legacy_source || '').toLowerCase()
      const ss = (p.sale as any)?.store_id
      const isMujer = src.includes('dbadiction') || src.includes('mujeres') || ss === 'Tienda Mujeres'
      const isHomb  = src.includes('boutiquev') || src.includes('hombres') || ss === 'Tienda Hombres'
      if (storeFilter === 'Tienda Mujeres' && isMujer && p.client_id) clientIdsSet.add(p.client_id)
      if (storeFilter === 'Tienda Hombres' && isHomb  && p.client_id) clientIdsSet.add(p.client_id)
    }
    // Chunked payments query by client_id
    const cids = [...clientIdsSet]
    if (cids.length > 0) {
      const CHUNK = 200
      const chunks: string[][] = []
      for (let i = 0; i < cids.length; i += CHUNK) chunks.push(cids.slice(i, i + CHUNK))
      const results = await Promise.all(chunks.map(chunk =>
        svc.from('payments')
          .select('amount')
          .in('client_id', chunk)
          .gte('payment_date', fromDate)
          .lte('payment_date', toDate)
      ))
      for (const r of results) {
        for (const row of (r.data || [])) {
          paymentsTotal += Number((row as any).amount || 0)
          paymentsCount++
        }
      }
    }
  } else {
    const pays = await fetchAllRows<any>((from, to) =>
      svc.from('payments')
        .select('amount')
        .gte('payment_date', fromDate)
        .lte('payment_date', toDate)
        .range(from, to)
    )
    paymentsCount = pays.length
    paymentsTotal = pays.reduce((s, p) => s + Number(p.amount || 0), 0)
  }

  // ── New clients (created_at in period) ──────────────────────────────────
  const newClientsRes = await fetchAllRows<any>((from, to) =>
    svc.from('clients')
      .select('id')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .range(from, to)
  )
  const newClients = newClientsRes.length

  // ── Movements ───────────────────────────────────────────────────────────
  let stockIn = 0, stockOut = 0, stockAdj = 0
  const movs = await fetchAllRows<any>((from, to) => {
    let q = svc.from('movements')
      .select('type, quantity')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .range(from, to)
    if (storeFilter) q = q.eq('warehouse_id', storeFilter) as typeof q
    return q
  })
  for (const m of movs) {
    const qty = Math.abs(Number((m as any).quantity || 0))
    const t = (m as any).type
    if (t === 'IN' || t === 'ENTRADA') stockIn += qty
    else if (t === 'OUT' || t === 'SALIDA') stockOut += qty
    else if (t === 'AJUSTE') stockAdj++
  }

  return {
    sales_total: salesTotal,
    sales_count: salesCount,
    sales_contado: salesContado,
    sales_credito: salesCredito,
    avg_ticket: avgTicket,
    payments_total: paymentsTotal,
    payments_count: paymentsCount,
    new_clients: newClients,
    active_clients: activeClients,
    units_sold: unitsSold,
    stock_in: stockIn,
    stock_out: stockOut,
    stock_adjustments: stockAdj,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const params = request.nextUrl.searchParams
    const fromA = params.get('from_a') || ''
    const toA   = params.get('to_a')   || ''
    const fromB = params.get('from_b') || ''
    const toB   = params.get('to_b')   || ''
    const store = params.get('store')  || 'ALL'

    if (!fromA || !toA || !fromB || !toB) {
      return NextResponse.json({ error: 'Faltan params: from_a, to_a, from_b, to_b' }, { status: 400 })
    }

    const storeFilter = store !== 'ALL' ? (STORE_TEXT[store] || null) : null
    const svc = createServiceClient()

    // Ejecutar ambos períodos en paralelo
    const [metricsA, metricsB] = await Promise.all([
      computePeriod(svc, fromA, toA, storeFilter),
      computePeriod(svc, fromB, toB, storeFilter),
    ])

    // Compute diffs
    const keys = Object.keys(metricsA) as (keyof PeriodMetrics)[]
    const diff: Record<string, { abs: number; pct: number | null }> = {}
    for (const k of keys) {
      const a = metricsA[k]
      const b = metricsB[k]
      const abs = b - a
      const pct = a !== 0 ? (abs / Math.abs(a)) * 100 : null
      diff[k as string] = { abs, pct }
    }

    return NextResponse.json({
      period_a: { from: fromA, to: toA, metrics: metricsA },
      period_b: { from: fromB, to: toB, metrics: metricsB },
      diff,
      store,
    })
  } catch (err) {
    console.error('[GET /api/reports/comparative-metrics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
