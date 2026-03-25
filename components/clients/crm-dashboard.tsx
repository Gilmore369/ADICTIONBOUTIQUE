'use client'

/**
 * CRM Dashboard — redesigned
 * Tipo SaaS moderno: KPIs + Charts (Recharts) + Tabla de cobranza + Alertas
 */

import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/contexts/store-context'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertTriangle, DollarSign,
  Users, Phone, MessageCircle, Eye, ArrowUpRight,
  RefreshCw, UserPlus, CreditCard, MapPin, ChevronRight,
  Loader2, Clock,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metrics {
  totalActiveClients: number
  totalDeactivatedClients: number
  clientsWithDebt: number
  clientsWithOverdueDebt: number
  inactiveClients: number
  birthdaysThisMonth: number
  pendingCollectionActions: number
  totalOutstandingDebt: number
  totalOverdueDebt: number
}

interface DashboardData {
  metrics: Metrics
  ageingBuckets: { bucket: string; monto: number; color: string }[]
  topDebtors: {
    id: string; name: string; dni: string; phone: string;
    totalDebt: number; maxDaysOverdue: number; overdueDebt: number; score: number
  }[]
  monthlyTrend: { month: string; deuda: number; cobrado: number }[]
  clientStatus: { name: string; value: number; color: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRiskLabel(score: number) {
  if (score >= 3000) return { label: 'Crítico', color: 'bg-red-100 text-red-700 border-red-200' }
  if (score >= 1000) return { label: 'Alto', color: 'bg-orange-100 text-orange-700 border-orange-200' }
  if (score >= 300) return { label: 'Medio', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
  return { label: 'Bajo', color: 'bg-green-100 text-green-700 border-green-200' }
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6']
function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, sub, icon: Icon, trend, trendLabel, color, href,
}: {
  title: string; value: string | number; sub?: string; icon: any;
  trend?: 'up' | 'down' | 'neutral'; trendLabel?: string;
  color: string; href?: string
}) {
  const router = useRouter()
  const isClickable = !!href

  const trendEl = trend && trendLabel ? (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium',
      trend === 'up' ? 'text-red-600' : trend === 'down' ? 'text-green-600' : 'text-gray-500'
    )}>
      {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
      {trendLabel}
    </span>
  ) : null

  return (
    <div
      onClick={() => href && router.push(href)}
      className={cn(
        'bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm',
        isClickable && 'cursor-pointer hover:border-gray-300 hover:shadow-md transition-all'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
        <div className={cn('p-2 rounded-lg', color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
      {trendEl && <div>{trendEl}</div>}
    </div>
  )
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function CrmDashboard() {
  const { storeId, selectedStore } = useStore()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const params = storeId && selectedStore !== 'ALL' ? `?store_id=${storeId}` : ''
      const res = await fetch(`/api/crm/dashboard${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar dashboard')
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [storeId, selectedStore])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(fetchData, 60_000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-gray-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>No se pudieron cargar los datos</p>
        <button onClick={fetchData} className="mt-3 text-sm text-blue-600 hover:underline">Reintentar</button>
      </div>
    )
  }

  const { metrics, ageingBuckets, topDebtors, monthlyTrend, clientStatus } = data
  const overduePercent = metrics.totalOutstandingDebt > 0
    ? Math.round((metrics.totalOverdueDebt / metrics.totalOutstandingDebt) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}` : 'Actualizar'}
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Deuda Total"
          value={formatCurrency(metrics.totalOutstandingDebt)}
          sub={`${metrics.clientsWithDebt} clientes con deuda`}
          icon={DollarSign}
          color="bg-blue-500"
          href="/debt/plans"
        />
        <KpiCard
          title="Deuda Vencida"
          value={formatCurrency(metrics.totalOverdueDebt)}
          sub={`${overduePercent}% del total`}
          icon={TrendingDown}
          trend={overduePercent > 30 ? 'up' : 'neutral'}
          trendLabel={overduePercent > 30 ? 'Por encima del 30%' : undefined}
          color="bg-red-500"
          href="/collections/actions"
        />
        <KpiCard
          title="Clientes en Riesgo"
          value={metrics.clientsWithOverdueDebt}
          sub="con cuotas vencidas"
          icon={AlertTriangle}
          color="bg-orange-500"
          href="/collections/actions"
        />
        <KpiCard
          title="Acciones Pendientes"
          value={metrics.pendingCollectionActions}
          sub="seguimientos activos"
          icon={Clock}
          color="bg-purple-500"
          href="/collections/actions"
        />
      </div>

      {/* ── Row 2: Métricas secundarias ────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className="p-2.5 rounded-lg bg-green-100">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{metrics.totalActiveClients}</div>
            <div className="text-xs text-gray-500">Clientes activos</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className="p-2.5 rounded-lg bg-gray-100">
            <Users className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{metrics.inactiveClients}</div>
            <div className="text-xs text-gray-500">Clientes inactivos</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className="p-2.5 rounded-lg bg-pink-100">
            <Users className="h-5 w-5 text-pink-500" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{metrics.birthdaysThisMonth}</div>
            <div className="text-xs text-gray-500">Cumpleaños este mes</div>
          </div>
        </div>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Trend chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <SectionHeader title="Evolución mensual" sub="Deuda generada vs Cobrado (últimos 6 meses)" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradDeuda" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCobrado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `S/${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any, name: string) => [formatCurrency(v), name === 'deuda' ? 'Deuda' : 'Cobrado']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }}
                formatter={v => v === 'deuda' ? 'Deuda' : 'Cobrado'} />
              <Area type="monotone" dataKey="deuda" stroke="#3b82f6" strokeWidth={2}
                fill="url(#gradDeuda)" dot={{ r: 3 }} />
              <Area type="monotone" dataKey="cobrado" stroke="#22c55e" strokeWidth={2}
                fill="url(#gradCobrado)" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <SectionHeader title="Estado de clientes" />
          {clientStatus.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={clientStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={2}>
                    {clientStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, name: string) => [v, name]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {clientStatus.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-gray-600">{s.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">Sin datos</div>
          )}
        </div>
      </div>

      {/* Debt aging bar chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <SectionHeader title="Antigüedad de deuda vencida" sub="Monto acumulado por tiempo de atraso" />
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={ageingBuckets} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `S/${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: any) => [formatCurrency(v), 'Deuda vencida']}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
              {ageingBuckets.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Collection Priority Table ──────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <SectionHeader
            title="Prioridad de cobranza"
            sub="Ordenados por score de riesgo (deuda × 0.6 + días atraso × 0.4)"
            action={
              <button
                onClick={() => router.push('/collections/actions')}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                Ver todas <ChevronRight className="h-3 w-3" />
              </button>
            }
          />
        </div>

        {topDebtors.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Sin deudas vencidas 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deuda total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vencida</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Días atraso</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Riesgo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {topDebtors.map((debtor, i) => {
                  const risk = getRiskLabel(debtor.score)
                  const initials = getInitials(debtor.name)
                  const color = avatarColor(debtor.name)
                  return (
                    <tr key={debtor.id} className={cn('border-b border-gray-50 hover:bg-gray-50 transition-colors', i % 2 === 0 ? '' : 'bg-gray-50/40')}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: color }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{debtor.name}</div>
                            <div className="text-xs text-gray-400">{debtor.dni}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                        {formatCurrency(debtor.totalDebt)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-red-600">
                        {formatCurrency(debtor.overdueDebt)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-600 hidden md:table-cell">
                        {debtor.maxDaysOverdue > 0 ? `${debtor.maxDaysOverdue} días` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium border', risk.color)}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {debtor.phone && (
                            <a
                              href={`tel:${debtor.phone}`}
                              title="Llamar"
                              className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {debtor.phone && (
                            <a
                              href={`https://wa.me/51${debtor.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="p-1.5 rounded-md hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => router.push(`/clients/${debtor.id}`)}
                            title="Ver detalle"
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quick Actions ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <SectionHeader title="Acciones rápidas" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Registrar pago', icon: DollarSign, color: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200', href: '/collections/actions' },
            { label: 'Nuevo cliente', icon: UserPlus, color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200', href: '/clients' },
            { label: 'Registrar deuda', icon: CreditCard, color: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200', href: '/debt/plans' },
            { label: 'Mapa cobranzas', icon: MapPin, color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200', href: '/map' },
          ].map(({ label, icon: Icon, color, href }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors',
                color
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
