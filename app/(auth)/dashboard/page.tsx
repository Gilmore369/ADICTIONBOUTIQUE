/**
 * Dashboard Page — Server Component
 *
 * Fetches all metrics in parallel and passes to DashboardClient for rendering.
 * Chart data uses 30-day window (vs 7 before) for richer visualizations.
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import DashboardClient, { type DashboardMetrics } from '@/components/dashboard/DashboardClient'
import { getTodayPeru, peruMidnightUTC, PERU_TZ } from '@/lib/utils/timezone'

export const dynamic = 'force-dynamic'

interface TrendPoint {
  period: string
  label: string
  total: number
  count: number
  contado: number
  credito: number
}

const STORE_KEY_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string }>
}) {
  const supabase  = await createServerClient()

  // ── Zona horaria Perú (America/Lima, UTC-5) ────────────────────────────
  // Usamos getTodayPeru() y peruMidnightUTC() del módulo de timezone para que
  // "hoy" coincida con el día calendario en Lima, sin hardcodear el offset.
  const peruDateStr = getTodayPeru()               // 'YYYY-MM-DD' en Lima

  // Inicio de "hoy Perú" expresado en UTC: YYYY-MM-DDT05:00:00Z
  const today = peruMidnightUTC(peruDateStr)

  // Inicio de "ayer Perú" en UTC
  const yesterdayDate = new Date(peruDateStr + 'T12:00:00') // parse at noon to avoid DST edge
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yDateStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: PERU_TZ })
  const yStr = peruMidnightUTC(yDateStr)

  // Hace 30 días (en Lima)
  const thirtyAgoDt = new Date(peruDateStr + 'T12:00:00')
  thirtyAgoDt.setDate(thirtyAgoDt.getDate() - 30)
  const thirtyAgoStr = thirtyAgoDt.toLocaleDateString('en-CA', { timeZone: PERU_TZ })

  // ── Resolver tienda según perfil del usuario ────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase
    .from('users').select('roles,stores').eq('id', user.id).single() : { data: null }

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  const isAdmin = userRoles.includes('admin')
  const userStores: string[] = (profile as any)?.stores || []

  // Si tiene 1 sola tienda → siempre bloqueado a esa tienda (sin importar rol)
  // Si tiene 2+ tiendas Y es admin → puede filtrar via URL param
  const params = await (searchParams ?? Promise.resolve({}))
  const cookieStore = await cookies()
  const cookieSelected = cookieStore.get('selected-store')?.value  // 'ALL' | 'MUJERES' | 'HOMBRES'

  const canSwitchStore = isAdmin && userStores.length > 1
  let storeFilter: string | null = null   // used for sales.store_id filter ('Tienda Mujeres')
  let storeCode: string | null = null     // used for stores.code filter ('MUJERES')
  if (userStores.length === 1) {
    storeCode = (userStores[0] ?? '').toUpperCase()
    storeFilter = STORE_KEY_MAP[storeCode] ?? userStores[0]
  } else if (canSwitchStore) {
    // URL param takes priority, then cookie fallback
    const resolvedStore = (params.store && params.store !== 'ALL')
      ? params.store
      : (cookieSelected && cookieSelected !== 'ALL' ? cookieSelected : null)
    if (resolvedStore) {
      storeCode = resolvedStore.toUpperCase()
      storeFilter = STORE_KEY_MAP[storeCode] ?? resolvedStore
    }
  }

  // NOTE: stock.warehouse_id and movements.warehouse_id store display names
  // ('Tienda Mujeres' / 'Tienda Hombres'), NOT UUIDs from the warehouses table.
  // storeFilter already holds the correct value ('Tienda Mujeres') for filtering.
  const filteredWarehouseIds: string[] = storeFilter ? [storeFilter] : []

  // ── All queries in parallel ─────────────────────────────────────────────
  // Helper para agregar filtro de tienda a queries de sales
  const buildSalesQuery = (q: any) => storeFilter ? q.eq('store_id', storeFilter) : q

  // Inicio del mes actual en Lima → UTC 05:00 del día 1
  const monthFirstStr = peruDateStr.substring(0, 7) + '-01' // 'YYYY-MM-01'
  const monthStart = peruMidnightUTC(monthFirstStr)

  const [metricsRes, trendRes, yRes, recentRes, actionsRes, cvcRes, clientsAddressRes,
         salesTodayRes, salesMonthRes, lowStockFilteredRes,
         filteredDebtRes] =
    await Promise.all([
      supabase.rpc('get_dashboard_metrics', { p_inactivity_days: 90 }),
      supabase.rpc('get_sales_by_period', {
        p_period: 'day',
        p_limit: 30,
        ...(storeFilter ? { p_store_id: storeFilter } : {})
      }),
      buildSalesQuery(supabase.from('sales').select('total')
        .gte('created_at', yStr).lt('created_at', today).eq('voided', false)),
      buildSalesQuery(supabase.from('sales')
        .select('id,sale_number,total,sale_type,created_at,clients(name)')
        .order('created_at', { ascending: false }).limit(6)),
      supabase.from('collection_actions').select('result').gte('created_at', today),
      buildSalesQuery(supabase.from('sales').select('total,sale_type')
        .gte('created_at', peruMidnightUTC(thirtyAgoStr)).eq('voided', false)),
      supabase.from('clients').select('address').eq('active', true).not('address', 'is', null),
      // Ventas hoy filtradas por tienda (override RPC)
      buildSalesQuery(supabase.from('sales').select('total')
        .gte('created_at', today).eq('voided', false)),
      // Ventas este mes filtradas por tienda (override RPC)
      buildSalesQuery(supabase.from('sales').select('total')
        .gte('created_at', monthStart).eq('voided', false)),
      // Stock bajo filtrado por tienda
      filteredWarehouseIds.length > 0
        ? supabase.from('stock')
            .select('product_id, quantity, products!inner(min_stock, active)')
            .in('warehouse_id', filteredWarehouseIds)
            .eq('products.active', true)
        : Promise.resolve({ data: null, error: null }),
      // Planes de crédito filtrados via service client (bypasses RLS) con inner join store
      storeFilter
        ? createServiceClient().from('credit_plans')
            .select('id, client_id, sales!inner(store_id)')
            .eq('sales.store_id', storeFilter)
            .eq('status', 'ACTIVE')
        : Promise.resolve({ data: null, error: null }),
    ])

  // ── Compute filtered low stock count ───────────────────────────────────
  let filteredLowStock: number | null = null
  if (filteredWarehouseIds.length > 0 && lowStockFilteredRes?.data) {
    const byProduct: Record<string, { qty: number; min: number }> = {}
    for (const row of lowStockFilteredRes.data as any[]) {
      const prod = row.products as any
      if (!prod) continue
      if (!byProduct[row.product_id]) {
        byProduct[row.product_id] = { qty: 0, min: Number(prod.min_stock) || 0 }
      }
      byProduct[row.product_id].qty += Number(row.quantity) || 0
    }
    // "Bajo" = sin stock (qty=0) OR (min_stock>0 AND qty<=min_stock)
    // Excludes products with min_stock=0 and qty>0 (no minimum configured)
    filteredLowStock = Object.values(byProduct).filter(p => p.qty === 0 || (p.min > 0 && p.qty <= p.min)).length
  }

  // ── Compute derived values ──────────────────────────────────────────────
  const raw       = (metricsRes.data ?? {}) as Record<string, number>
  const trend     = ((trendRes.data ?? []) as TrendPoint[]).reverse()
  const yTotal    = (yRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0)

  // When a store filter is active, override sales figures with filtered queries
  const filteredSalesToday   = storeFilter
    ? (salesTodayRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0)
    : (raw.salesToday ?? 0)
  const filteredSalesMonth   = storeFilter
    ? (salesMonthRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0)
    : (raw.salesThisMonth ?? 0)
  const filteredCountToday   = storeFilter
    ? (salesTodayRes.data ?? []).length
    : (raw.salesCountToday ?? 0)

  // Store-filtered debt counts
  const filteredDebtPlans = (filteredDebtRes?.data ?? null) as any[] | null
  let filteredClientsWithDebt: number | null = null
  let filteredClientsOverdue: number | null = null
  if (filteredDebtPlans !== null) {
    // Count distinct client_ids with active plans that have pending installments
    const activeClientIds = [...new Set(filteredDebtPlans.map((p: any) => p.client_id))]
    filteredClientsWithDebt = activeClientIds.length
    // For overdue: check which active plan IDs have installments past due
    const activePlanIds = filteredDebtPlans.map((p: any) => p.id)
    if (activePlanIds.length > 0) {
      const { data: overdueRows } = await createServiceClient()
        .from('installments')
        .select('plan_id')
        .in('plan_id', activePlanIds)
        .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
        .lt('due_date', peruDateStr)
      const overdueClientIds = new Set(
        (overdueRows || []).map((r: any) => {
          const plan = filteredDebtPlans.find((p: any) => p.id === r.plan_id)
          return plan?.client_id
        }).filter(Boolean)
      )
      filteredClientsOverdue = overdueClientIds.size
    } else {
      filteredClientsOverdue = 0
    }
  }

  // ── Compute filtered debt totals ──────────────────────────────────────────
  let filteredTotalDebt: number | null = null
  let filteredTotalOverdue: number | null = null
  if (filteredDebtPlans !== null && filteredDebtPlans.length > 0) {
    const activePlanIds = filteredDebtPlans.map((p: any) => p.id)
    const { data: installmentRows } = await createServiceClient()
      .from('installments')
      .select('amount, paid_amount, due_date, status')
      .in('plan_id', activePlanIds)
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
    if (installmentRows) {
      filteredTotalDebt = installmentRows.reduce(
        (s: number, r: any) => s + Math.max(0, Number(r.amount) - Number(r.paid_amount || 0)), 0
      )
      filteredTotalOverdue = installmentRows
        .filter((r: any) => r.due_date < peruDateStr)
        .reduce((s: number, r: any) => s + Math.max(0, Number(r.amount) - Number(r.paid_amount || 0)), 0)
    }
  } else if (filteredDebtPlans !== null && filteredDebtPlans.length === 0) {
    filteredTotalDebt = 0
    filteredTotalOverdue = 0
  }

  // ── Compute filtered payments this month (via plan_id → sale_id → store) ─
  let filteredPaymentsMonth: number | null = null
  if (filteredDebtPlans !== null) {
    const planIds = (filteredDebtPlans ?? []).map((p: any) => p.id)
    if (planIds.length > 0) {
      const { data: payRows } = await createServiceClient()
        .from('payments')
        .select('amount')
        .in('plan_id', planIds)
        .gte('created_at', monthStart)
      filteredPaymentsMonth = (payRows ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
    } else {
      filteredPaymentsMonth = 0
    }
  }

  const metrics: DashboardMetrics = {
    totalActiveClients:       raw.totalActiveClients       ?? 0,
    totalDeactivatedClients:  raw.totalDeactivatedClients  ?? 0,
    clientsWithDebt:          filteredClientsWithDebt ?? (raw.clientsWithDebt ?? 0),
    clientsWithOverdueDebt:   filteredClientsOverdue  ?? (raw.clientsWithOverdueDebt ?? 0),
    inactiveClients:          raw.inactiveClients          ?? 0,
    birthdaysThisMonth:       raw.birthdaysThisMonth       ?? 0,
    pendingCollectionActions: raw.pendingCollectionActions ?? 0,
    totalOutstandingDebt:     filteredTotalDebt        ?? (raw.totalOutstandingDebt ?? 0),
    totalOverdueDebt:         filteredTotalOverdue     ?? (raw.totalOverdueDebt     ?? 0),
    salesToday:               filteredSalesToday,
    salesCountToday:          filteredCountToday,
    salesThisMonth:           filteredSalesMonth,
    lowStockProducts:         filteredLowStock ?? raw.lowStockProducts ?? 0,
    paymentsThisMonth:        filteredPaymentsMonth ?? (raw.paymentsThisMonth ?? 0),
  }

  const todayChange = yTotal > 0
    ? ((metrics.salesToday - yTotal) / yTotal) * 100
    : 0

  const actions    = (actionsRes.data ?? []) as Array<{ result: string }>
  const actCount   = actions.length
  const successCnt = actions.filter(a => a.result === 'PAGO' || a.result === 'PROMESA_PAGO').length
  const effRate    = actCount > 0 ? (successCnt / actCount) * 100 : 0

  const salesCVC   = (cvcRes.data ?? []) as Array<{ total: number; sale_type: string }>
  const cashTotal  = salesCVC.filter(s => s.sale_type === 'CONTADO').reduce((s, r) => s + Number(r.total), 0)
  const creditTotal = salesCVC.filter(s => s.sale_type === 'CREDITO').reduce((s, r) => s + Number(r.total), 0)

  const recentSales = (recentRes.data ?? []) as any[]

  // ── District data (real) — parse "Street, District" address format ──────
  // Only count addresses that contain a comma (have an explicit district part)
  // and whose district part is ≤ 35 chars (avoids long full-addresses being used)
  const districtMap: Record<string, number> = {}
  for (const c of (clientsAddressRes.data ?? []) as Array<{ address: string }>) {
    const raw = (c.address ?? '').trim()
    if (!raw.includes(',')) continue                 // no comma → no district
    const parts = raw.split(',')
    const district = parts[parts.length - 1].trim()
    if (!district || district.length > 35) continue  // too long = full address, skip
    // Normalize: title-case each word (avoids regex bugs with accented chars)
    const key = district
      .split(' ')
      .map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
      .join(' ')
    districtMap[key] = (districtMap[key] ?? 0) + 1
  }
  const locationData = Object.entries(districtMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([district, clients]) => ({ district, clients }))

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <DashboardClient
      metrics={metrics}
      trend={trend}
      todayChange={todayChange}
      cashTotal={cashTotal}
      creditTotal={creditTotal}
      efficiencyRate={effRate}
      actCount={actCount}
      recentSales={recentSales}
      locationData={locationData}
      storeFilter={storeFilter}
      isAdmin={canSwitchStore}
      activeStoreParam={params.store ?? null}
      userStores={userStores}
    />
  )
}
