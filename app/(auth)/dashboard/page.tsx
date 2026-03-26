/**
 * Dashboard Page — Server Component
 *
 * Fetches all metrics in parallel and passes to DashboardClient for rendering.
 * Chart data uses 30-day window (vs 7 before) for richer visualizations.
 */

import { createServerClient } from '@/lib/supabase/server'
import DashboardClient, { type DashboardMetrics } from '@/components/dashboard/DashboardClient'

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
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr      = yesterday.toISOString().split('T')[0]
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  // ── Resolver tienda según perfil del usuario ────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase
    .from('users').select('roles,stores').eq('id', user.id).single() : { data: null }

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  const isAdmin = userRoles.includes('admin')
  const userStores: string[] = (profile as any)?.stores || []

  // Admin puede filtrar via URL param; no-admin con 1 tienda queda bloqueado
  const params = await (searchParams ?? Promise.resolve({}))
  let storeFilter: string | null = null
  if (!isAdmin && userStores.length === 1) {
    storeFilter = STORE_KEY_MAP[userStores[0]] ?? userStores[0]
  } else if (isAdmin && params.store && params.store !== 'ALL') {
    storeFilter = STORE_KEY_MAP[params.store] ?? params.store
  }

  // ── All queries in parallel ─────────────────────────────────────────────
  // Helper para agregar filtro de tienda a queries de sales
  const buildSalesQuery = (q: any) => storeFilter ? q.eq('store_id', storeFilter) : q

  const [metricsRes, trendRes, yRes, recentRes, actionsRes, cvcRes, clientsAddressRes,
         salesTodayRes, salesMonthRes] =
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
        .gte('created_at', thirtyAgo.toISOString()).eq('voided', false)),
      supabase.from('clients').select('address').eq('active', true).not('address', 'is', null),
      // Ventas hoy filtradas por tienda (override RPC)
      buildSalesQuery(supabase.from('sales').select('total')
        .gte('created_at', today).eq('voided', false)),
      // Ventas este mes filtradas por tienda (override RPC)
      buildSalesQuery(supabase.from('sales').select('total')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .eq('voided', false)),
    ])

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

  const metrics: DashboardMetrics = {
    totalActiveClients:       raw.totalActiveClients       ?? 0,
    totalDeactivatedClients:  raw.totalDeactivatedClients  ?? 0,
    clientsWithDebt:          raw.clientsWithDebt          ?? 0,
    clientsWithOverdueDebt:   raw.clientsWithOverdueDebt   ?? 0,
    inactiveClients:          raw.inactiveClients          ?? 0,
    birthdaysThisMonth:       raw.birthdaysThisMonth       ?? 0,
    pendingCollectionActions: raw.pendingCollectionActions ?? 0,
    totalOutstandingDebt:     raw.totalOutstandingDebt     ?? 0,
    totalOverdueDebt:         raw.totalOverdueDebt         ?? 0,
    salesToday:               filteredSalesToday,
    salesCountToday:          filteredCountToday,
    salesThisMonth:           filteredSalesMonth,
    lowStockProducts:         raw.lowStockProducts         ?? 0,
    paymentsThisMonth:        raw.paymentsThisMonth        ?? 0,
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
      isAdmin={isAdmin}
      activeStoreParam={params.store ?? null}
      userStores={userStores}
    />
  )
}
