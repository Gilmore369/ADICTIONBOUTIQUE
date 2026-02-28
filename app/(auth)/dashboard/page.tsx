/**
 * Dashboard Page - Optimizado con tarjetas navegables
 *
 * FIXES vs version anterior:
 * 1. ~20 queries independientes -> 4 queries en Promise.all
 * 2. Usa get_dashboard_metrics() RPC para todos los KPIs
 * 3. Usa get_sales_by_period() RPC para tendencia de ventas
 * 4. Fix result codes: PAGO/PROMESA_PAGO (no PAID/PROMISE_TO_PAY)
 * 5. Fix deuda: cuenta desde installments, no credit_used desincronizado
 * 6. SalesTrendChart: 1 RPC en lugar de 7 queries en loop
 * 7. Tarjetas KPI son enlaces navegables con hover effects
 * 8. Alertas son botones que llevan a la seccion correspondiente
 */

import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { formatSafeDate } from '@/lib/utils/date'
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, CreditCard, Wallet, Activity, AlertCircle,
  ChevronRight
} from 'lucide-react'

interface Metrics {
  totalActiveClients:       number
  totalDeactivatedClients:  number
  clientsWithDebt:          number
  clientsWithOverdueDebt:   number
  inactiveClients:          number
  birthdaysThisMonth:       number
  pendingCollectionActions: number
  totalOutstandingDebt:     number
  totalOverdueDebt:         number
  salesToday:               number
  salesCountToday:          number
  salesThisMonth:           number
  lowStockProducts:         number
  paymentsThisMonth:        number
}

interface TrendPoint {
  period: string; label: string; total: number; count: number
  contado: number; credito: number
}

export default async function DashboardPage() {
  const supabase   = await createServerClient()
  const today      = new Date().toISOString().split('T')[0]
  const yesterday  = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yStr       = yesterday.toISOString().split('T')[0]
  const thirtyAgo  = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  // 4 queries en paralelo (vs ~20 antes)
  const [metricsRes, trendRes, yRes, recentRes, actionsRes, cvcRes] =
    await Promise.all([
      supabase.rpc('get_dashboard_metrics', { p_inactivity_days: 90 }),
      supabase.rpc('get_sales_by_period', { p_period: 'day', p_limit: 7 }),
      supabase.from('sales').select('total').gte('created_at', yStr).lt('created_at', today).eq('voided', false),
      supabase.from('sales').select('id,sale_number,total,sale_type,created_at,clients(name)').order('created_at', { ascending: false }).limit(6),
      supabase.from('collection_actions').select('result').gte('created_at', today),
      supabase.from('sales').select('total,sale_type').gte('created_at', thirtyAgo.toISOString()).eq('voided', false),
    ])

  const m         = (metricsRes.data ?? {}) as Metrics
  const trend     = ((trendRes.data ?? []) as TrendPoint[]).reverse()
  const yTotal    = (yRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0)
  const todayChg  = yTotal > 0 ? ((m.salesToday - yTotal) / yTotal) * 100 : 0
  const recentSales = (recentRes.data ?? []) as any[]

  // Codigos correctos PAGO / PROMESA_PAGO
  const actions    = actionsRes.data ?? []
  const actCount   = actions.length
  const successCnt = actions.filter((a: any) => a.result === 'PAGO' || a.result === 'PROMESA_PAGO').length
  const effRate    = actCount > 0 ? (successCnt / actCount) * 100 : 0

  const salesCVC   = cvcRes.data ?? []
  const cashTot    = (salesCVC as any[]).filter((s: any) => s.sale_type === 'CONTADO').reduce((s: number, r: any) => s + Number(r.total), 0)
  const creditTot  = (salesCVC as any[]).filter((s: any) => s.sale_type === 'CREDITO').reduce((s: number, r: any) => s + Number(r.total), 0)
  const cvcTot     = cashTot + creditTot
  const cashPct    = cvcTot > 0 ? (cashTot / cvcTot) * 100 : 0
  const creditPct  = cvcTot > 0 ? (creditTot / cvcTot) * 100 : 0
  const maxTrend   = Math.max(...trend.map(d => d.total), 1)

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Metricas del negocio en tiempo real</p>
      </div>

      {/* Alertas rapidas - clickeables */}
      {(m.pendingCollectionActions > 0 || m.lowStockProducts > 0 || m.birthdaysThisMonth > 0) && (
        <div className="flex flex-wrap gap-2">
          {m.pendingCollectionActions > 0 && (
            <Link
              href="/collections/actions"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium hover:bg-amber-100 hover:border-amber-300 transition-all"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {formatNumber(m.pendingCollectionActions)} cobros pendientes vencidos
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
          {m.lowStockProducts > 0 && (
            <Link
              href="/inventory/stock"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full text-xs text-rose-700 font-medium hover:bg-rose-100 hover:border-rose-300 transition-all"
            >
              <Package className="h-3.5 w-3.5" />
              {formatNumber(m.lowStockProducts)} productos con stock bajo
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
          {m.birthdaysThisMonth > 0 && (
            <Link
              href="/clients"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-full text-xs text-violet-700 font-medium hover:bg-violet-100 hover:border-violet-300 transition-all"
            >
              🎂 {formatNumber(m.birthdaysThisMonth)} cumpleanos este mes
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
        </div>
      )}

      {/* Fila 1: KPIs ventas/cobros - todos clickeables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Ventas Hoy → /pos */}
        <Link href="/pos" className="group block">
          <Card className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60 transition-all hover:shadow-md hover:border-emerald-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 rounded-md">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ventas Hoy</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">S/ {formatCurrency(m.salesToday)}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {todayChg >= 0
                ? <TrendingUp className="h-3 w-3 text-emerald-600" />
                : <TrendingDown className="h-3 w-3 text-red-500" />}
              <span className={`text-xs font-medium ${todayChg >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {Math.abs(todayChg).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400">vs ayer · {formatNumber(m.salesCountToday)} ventas</span>
            </div>
          </Card>
        </Link>

        {/* Cobros del Mes → /collections/payments */}
        <Link href="/collections/payments" className="group block">
          <Card className="p-3 bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200/60 transition-all hover:shadow-md hover:border-teal-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-500/10 rounded-md">
                  <Wallet className="h-4 w-4 text-teal-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cobros del Mes</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-teal-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">S/ {formatCurrency(m.paymentsThisMonth)}</p>
            <p className="text-xs text-gray-400 mt-0.5">pagos registrados</p>
          </Card>
        </Link>

        {/* Deuda Total → /debt/plans */}
        <Link href="/debt/plans" className="group block">
          <Card className="p-3 bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200/60 transition-all hover:shadow-md hover:border-rose-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-500/10 rounded-md">
                  <CreditCard className="h-4 w-4 text-rose-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Deuda Total</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-rose-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">S/ {formatCurrency(m.totalOutstandingDebt)}</p>
            <p className="text-xs text-rose-500 font-medium mt-0.5">S/ {formatCurrency(m.totalOverdueDebt)} vencida</p>
          </Card>
        </Link>

        {/* Acciones Hoy → /collections/actions */}
        <Link href="/collections/actions" className="group block">
          <Card className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200/60 transition-all hover:shadow-md hover:border-indigo-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 rounded-md">
                  <Activity className="h-4 w-4 text-indigo-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones Hoy</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">{formatNumber(actCount)}</p>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">{effRate.toFixed(0)}% efectividad</p>
          </Card>
        </Link>

      </div>

      {/* Fila 2: Clientes y otros KPIs - todos clickeables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Clientes Activos → /clients */}
        <Link href="/clients" className="group block">
          <Card className="p-3 bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200/60 transition-all hover:shadow-md hover:border-violet-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-500/10 rounded-md">
                  <Users className="h-4 w-4 text-violet-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Clientes</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-violet-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">{formatNumber(m.totalActiveClients)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatNumber(m.inactiveClients)} inactivos +90 dias</p>
          </Card>
        </Link>

        {/* Con Deuda → /debt/plans */}
        <Link href="/debt/plans" className="group block">
          <Card className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60 transition-all hover:shadow-md hover:border-amber-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 rounded-md">
                  <Users className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Con Deuda</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">{formatNumber(m.clientsWithDebt)}</p>
            <p className="text-xs text-red-500 font-medium mt-0.5">{formatNumber(m.clientsWithOverdueDebt)} en mora</p>
          </Card>
        </Link>

        {/* Ventas del Mes → /reports */}
        <Link href="/reports" className="group block">
          <Card className="p-3 bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200/60 transition-all hover:shadow-md hover:border-sky-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/10 rounded-md">
                  <DollarSign className="h-4 w-4 text-sky-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ventas del Mes</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-sky-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">S/ {formatCurrency(m.salesThisMonth)}</p>
            <p className="text-xs text-gray-400 mt-0.5">mes en curso</p>
          </Card>
        </Link>

        {/* Stock Bajo → /inventory/stock */}
        <Link href="/inventory/stock" className="group block">
          <Card className="p-3 border-gray-200/60 transition-all hover:shadow-md hover:border-gray-300 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-100 rounded-md">
                  <AlertCircle className="h-4 w-4 text-gray-500" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stock Bajo</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-900">{formatNumber(m.lowStockProducts)}</p>
            <p className="text-xs text-gray-400 mt-0.5">productos bajo minimo</p>
          </Card>
        </Link>

      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Tendencia 7 dias */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Tendencia — Ultimos 7 dias</h3>
          {trend.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin datos de ventas</p>
          ) : (
            <div className="space-y-3">
              {trend.map((day, i) => {
                const pct = (day.total / maxTrend) * 100
                const d   = new Date(day.period + 'T12:00:00')
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium capitalize text-gray-700">
                        {d.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </span>
                      <span className="text-gray-500 tabular-nums">S/ {formatCurrency(day.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="pt-3 border-t flex justify-between text-xs">
                <span className="text-gray-500">Total 7 dias</span>
                <span className="font-bold tabular-nums text-emerald-600">
                  S/ {formatCurrency(trend.reduce((s, d) => s + d.total, 0))}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Contado vs Credito */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Contado vs Credito — 30 dias</h3>
          <div className="flex h-8 rounded-lg overflow-hidden mb-4">
            {cvcTot === 0
              ? <div className="flex-1 bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sin datos</div>
              : <>
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${cashPct}%` }}
                  >
                    {cashPct > 10 && `${cashPct.toFixed(0)}%`}
                  </div>
                  <div
                    className="bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${creditPct}%` }}
                  >
                    {creditPct > 10 && `${creditPct.toFixed(0)}%`}
                  </div>
                </>
            }
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <div>
                  <p className="text-xs font-medium text-gray-700">Contado</p>
                  <p className="text-xs text-gray-400">{cashPct.toFixed(1)}%</p>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums text-emerald-700">S/ {formatCurrency(cashTot)}</p>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-amber-50/60 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <div>
                  <p className="text-xs font-medium text-gray-700">Credito</p>
                  <p className="text-xs text-gray-400">{creditPct.toFixed(1)}%</p>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums text-amber-700">S/ {formatCurrency(creditTot)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between text-xs">
            <span className="text-gray-500">Total</span>
            <span className="font-bold tabular-nums text-gray-800">S/ {formatCurrency(cvcTot)}</span>
          </div>
        </Card>

      </div>

      {/* Ventas recientes */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Ventas Recientes</h2>
          <Link href="/pos" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5">
            Ver POS <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {recentSales.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No hay ventas registradas</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentSales.map((sale: any) => (
              <div key={sale.id} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{sale.sale_number}</p>
                  <p className="text-xs text-gray-400">
                    {sale.sale_type === 'CREDITO' && sale.clients ? sale.clients.name : 'Venta al contado'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-gray-900">S/ {formatCurrency(Number(sale.total))}</p>
                  <p className="text-xs text-gray-400">{formatSafeDate(sale.created_at, 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}
