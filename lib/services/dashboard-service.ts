/**
 * Dashboard Service
 *
 * Provides functions for calculating and fetching dashboard metrics.
 * All heavy aggregations are done server-side via the get_dashboard_metrics()
 * RPC function (migration 20260223000004) instead of fetching all rows to JS.
 */

import { createServerClient } from '@/lib/supabase/server'
import { DashboardMetrics } from '@/lib/types/crm'

/**
 * Fetch all dashboard metrics via a single DB RPC call.
 *
 * The heavy lifting (counting installments, clients, debt, etc.) is done
 * entirely in Postgres by get_dashboard_metrics(). This avoids fetching
 * thousands of installment rows to JavaScript just to aggregate them.
 *
 * @returns DashboardMetrics object with all calculated metrics
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createServerClient()

  // Read inactivity threshold from system_config (default 90 days)
  const configResult = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'inactivity_threshold_days')
    .maybeSingle()

  const inactivityDays = parseInt(configResult?.data?.value ?? '90', 10)

  // Single RPC call replaces 7 parallel queries + JS loops
  const { data, error } = await supabase
    .rpc('get_dashboard_metrics', { p_inactivity_days: inactivityDays })

  if (error) {
    console.error('[dashboard-service] get_dashboard_metrics error:', error)
    // Return safe defaults so the UI never crashes
    return {
      totalActiveClients: 0,
      totalDeactivatedClients: 0,
      clientsWithDebt: 0,
      clientsWithOverdueDebt: 0,
      inactiveClients: 0,
      birthdaysThisMonth: 0,
      pendingCollectionActions: 0,
      totalOutstandingDebt: 0,
      totalOverdueDebt: 0,
    }
  }

  const m = data as Record<string, number>

  return {
    totalActiveClients:       m.totalActiveClients       ?? 0,
    totalDeactivatedClients:  m.totalDeactivatedClients  ?? 0,
    clientsWithDebt:          m.clientsWithDebt          ?? 0,
    clientsWithOverdueDebt:   m.clientsWithOverdueDebt   ?? 0,
    inactiveClients:          m.inactiveClients           ?? 0,
    birthdaysThisMonth:       m.birthdaysThisMonth        ?? 0,
    pendingCollectionActions: m.pendingCollectionActions  ?? 0,
    totalOutstandingDebt:     Number(m.totalOutstandingDebt  ?? 0),
    totalOverdueDebt:         Number(m.totalOverdueDebt       ?? 0),
  }
}

/**
 * Fetch sales grouped by period for dashboard charts.
 * Uses the get_sales_by_period() RPC (migration 20260223000004).
 *
 * @param period - 'day' | 'week' | 'month' | 'year'
 * @param storeId - Optional TEXT store_id filter
 * @param limit  - Max number of periods to return (default 12)
 */
export async function fetchSalesByPeriod(
  period: 'day' | 'week' | 'month' | 'year' = 'month',
  storeId?: string,
  limit = 12
) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('get_sales_by_period', {
    p_period:   period,
    p_store_id: storeId ?? null,
    p_limit:    limit,
  })

  if (error) {
    console.error('[dashboard-service] get_sales_by_period error:', error)
    return []
  }

  // Data comes ordered DESC from DB — reverse for chart display (oldest first)
  return ((data as unknown[]) ?? []).reverse()
}
