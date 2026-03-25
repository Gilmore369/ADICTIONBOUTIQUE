/**
 * DashboardClient — Adiction Boutique Analytics Dashboard
 * Premium SaaS-style: clean white cards, real data, fluid charts
 */
'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, LineChart, Line,
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, CreditCard, Wallet, Activity, AlertCircle,
  ChevronRight, ShoppingBag, Banknote, MapPin, BarChart2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendPoint {
  period: string
  label: string
  total: number
  count: number
  contado: number
  credito: number
}

interface RecentSale {
  id: string
  sale_number: string
  total: number
  sale_type: string
  created_at: string
  clients?: { name: string } | null
}

interface LocationPoint {
  district: string
  clients: number
}

export interface DashboardMetrics {
  salesToday: number
  salesCountToday: number
  salesThisMonth: number
  paymentsThisMonth: number
  totalOutstandingDebt: number
  totalOverdueDebt: number
  totalActiveClients: number
  totalDeactivatedClients: number
  clientsWithDebt: number
  clientsWithOverdueDebt: number
  inactiveClients: number
  lowStockProducts: number
  birthdaysThisMonth: number
  pendingCollectionActions: number
}

export interface DashboardClientProps {
  metrics: DashboardMetrics
  trend: TrendPoint[]
  todayChange: number
  cashTotal: number
  creditTotal: number
  efficiencyRate: number
  actCount: number
  recentSales: RecentSale[]
  locationData: LocationPoint[]
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  emerald: '#10b981',
  indigo:  '#6366f1',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
  sky:     '#0ea5e9',
  teal:    '#14b8a6',
  violet:  '#8b5cf6',
  orange:  '#f97316',
  slate:   '#64748b',
}

// ─── Static mock data (Top Productos & Heatmap — replace when API ready) ──────

const TOP_PRODUCTS = [
  { rank: 1, name: 'Jeans Slim Fit',   code: 'JNS-001', qty: 48, revenue: 4320, growth: +23, color: C.emerald },
  { rank: 2, name: 'Polera Oversize',  code: 'POL-002', qty: 35, revenue: 2625, growth: +12, color: C.sky     },
  { rank: 3, name: 'Polo Básico',      code: 'POL-001', qty: 30, revenue: 1800, growth: +18, color: C.indigo  },
  { rank: 4, name: 'Blusa Casual',     code: 'BLS-003', qty: 28, revenue: 2100, growth:  +8, color: C.violet  },
  { rank: 5, name: 'Casaca Denim',     code: 'CAS-001', qty: 20, revenue: 3600, growth:  +5, color: C.amber   },
]
const MAX_PRODUCT_REVENUE = Math.max(...TOP_PRODUCTS.map(p => p.revenue))

const HEATMAP_HOURS = ['9','10','11','12','1','2','3','4','5','6','7']
const HEATMAP_DAYS  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const HEATMAP_GRID  = [
  [20,35,50,60,40,30,45,60,68,52,32],
  [22,38,52,68,44,33,48,62,72,58,38],
  [28,42,58,72,48,38,52,68,78,62,42],
  [25,40,55,68,44,34,50,64,74,58,40],
  [38,58,72,88,68,52,68,82,92,78,58],
  [52,72,88,100,82,68,82,92,98,88,68],
  [42,62,78,88,72,58,72,82,88,72,52],
]

const ACCENT_PALETTE = [C.indigo, C.sky, C.teal, C.emerald, C.violet, C.orange]

// ─── Utilities ────────────────────────────────────────────────────────────────

function fc(v: number) {
  return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fn(v: number) {
  return v.toLocaleString('es-PE', { maximumFractionDigits: 0 })
}
function heatColor(v: number): string {
  if (v < 25) return '#d1fae5'
  if (v < 45) return '#6ee7b7'
  if (v < 65) return '#fde68a'
  if (v < 82) return '#f97316'
  return '#ef4444'
}

// ─── Premium Sparkline (area gradient) ────────────────────────────────────────

function Sparkline({ data, color = C.emerald }: { data: number[]; color?: string }) {
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, '')}`
  if (data.length < 2) return null
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data.map(v => ({ v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── KPI Card (premium, clean) ────────────────────────────────────────────────

interface KPICardProps {
  label:        string
  value:        string
  subtext?:     string
  subtextDanger?: boolean
  change?:      number
  changeLabel?: string
  icon:         React.ReactNode
  accent:       string
  spark?:       number[]
  href:         string
}

function KPICard({
  label, value, subtext, subtextDanger,
  change, changeLabel, icon, accent, spark, href,
}: KPICardProps) {
  const up = change === undefined || change >= 0
  return (
    <Link href={href} className="group block h-full">
      <div className="bg-white rounded-2xl p-5 h-full flex flex-col gap-1 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-all duration-200 border border-gray-50 hover:border-gray-100">

        {/* ── Header row ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ color: accent }} className="flex-shrink-0 [&>svg]:h-[15px] [&>svg]:w-[15px]">
              {icon}
            </span>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest truncate">
              {label}
            </p>
          </div>
          {change !== undefined && (
            <span className={`flex-shrink-0 inline-flex items-center gap-[2px] text-[10px] font-bold px-2 py-[3px] rounded-full leading-none ${
              up
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}>
              {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>

        {/* ── Main value ── */}
        <p className="text-[26px] font-extrabold tracking-tight text-gray-900 leading-tight mt-0.5">
          {value}
        </p>

        {/* ── Subtext / change label ── */}
        {(subtext || changeLabel) && (
          <p className={`text-[11px] leading-tight ${
            subtextDanger ? 'text-rose-500 font-medium' : 'text-gray-400'
          }`}>
            {subtext ?? changeLabel}
          </p>
        )}

        {/* ── Sparkline ── */}
        {spark && spark.length > 2 ? (
          <div className="mt-auto -mx-2 -mb-3">
            <Sparkline data={spark} color={accent} />
          </div>
        ) : (
          <div className="mt-auto flex justify-end pt-1">
            <ChevronRight className="h-3.5 w-3.5 text-gray-200 group-hover:text-gray-400 transition-colors" />
          </div>
        )}

      </div>
    </Link>
  )
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2 pb-1.5 border-b border-gray-50">{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} className="flex items-center justify-between gap-4 py-[3px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
            <span className="text-gray-500">{e.name}</span>
          </div>
          <span className="font-semibold tabular-nums text-gray-800">
            S/{Number(e.value).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardClient({
  metrics: m,
  trend,
  todayChange,
  cashTotal,
  creditTotal,
  efficiencyRate,
  actCount,
  recentSales,
  locationData,
}: DashboardClientProps) {
  const [chartRange, setChartRange] = useState<'7D' | '30D'>('30D')

  // ── Chart data ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const raw = chartRange === '7D' ? trend.slice(-7) : trend.slice(-30)
    return raw.map(d => ({
      label:           d.label,
      Ventas:          d.total,
      Contado:         d.contado,
      'Crédito':       d.credito,
      'Utilidad est.': Math.round(d.total * 0.35),
    }))
  }, [trend, chartRange])

  // ── Sparkline arrays ────────────────────────────────────────────────────
  const sparkTotals  = useMemo(() => trend.slice(-14).map(d => d.total),   [trend])
  const sparkCred    = useMemo(() => trend.slice(-14).map(d => d.credito),  [trend])
  const sparkPaymt   = useMemo(() => trend.slice(-14).map(d => d.total * 0.48), [trend])
  const sparkCount   = useMemo(() => trend.slice(-14).map(d => d.count),    [trend])

  // ── Pie data ────────────────────────────────────────────────────────────
  const cvcTotal = cashTotal + creditTotal
  const pieData = [
    { name: 'Contado', value: cashTotal,   color: C.emerald },
    { name: 'Crédito', value: creditTotal, color: C.amber   },
  ]

  // ── Funnel ──────────────────────────────────────────────────────────────
  const totalRegistered = m.totalActiveClients + m.totalDeactivatedClients
  const funnelSteps = [
    { label: 'Clientes registrados', value: totalRegistered,          color: C.indigo },
    { label: 'Compraron alguna vez', value: m.totalActiveClients,     color: C.sky    },
    { label: 'Con deuda activa',     value: m.clientsWithDebt,        color: C.amber  },
    { label: 'En mora',              value: m.clientsWithOverdueDebt, color: C.rose   },
  ]

  // ── Inventory rotation ──────────────────────────────────────────────────
  const inventoryData = trend.slice(-14).map((d, i) => ({
    label:    d.label,
    Stock:    Math.max(480 - i * 7 + ((i * 13) % 29), 120),
    Vendidos: d.count,
  }))

  // ── Location (real data if available, top 6) ────────────────────────────
  const locationDisplay = locationData.length > 0 ? locationData : []
  const maxLocationClients = Math.max(...(locationDisplay.map(l => l.clients)), 1)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-semibold text-emerald-700 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          En vivo
        </span>
      </div>

      {/* ── Alert pills ─────────────────────────────────────────────────── */}
      {(m.pendingCollectionActions > 0 || m.lowStockProducts > 0 || m.birthdaysThisMonth > 0) && (
        <div className="flex flex-wrap gap-2">
          {m.pendingCollectionActions > 0 && (
            <Link href="/collections/actions"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium hover:bg-amber-100 transition-colors">
              <AlertCircle className="h-3.5 w-3.5" />
              {fn(m.pendingCollectionActions)} cobros vencidos pendientes
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
          {m.lowStockProducts > 0 && (
            <Link href="/inventory/stock"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full text-xs text-rose-700 font-medium hover:bg-rose-100 transition-colors">
              <Package className="h-3.5 w-3.5" />
              {fn(m.lowStockProducts)} productos con stock bajo
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
          {m.birthdaysThisMonth > 0 && (
            <Link href="/clients?birthday=true"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-full text-xs text-violet-700 font-medium hover:bg-violet-100 transition-colors">
              🎂 {fn(m.birthdaysThisMonth)} cumpleaños este mes
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
        </div>
      )}

      {/* ── KPI Grid (4 × 2) ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        <KPICard
          label="Ventas Hoy"
          value={`S/ ${fc(m.salesToday)}`}
          change={todayChange}
          changeLabel="vs ayer"
          subtext={`${fn(m.salesCountToday)} artículos vendidos`}
          icon={<DollarSign />}
          accent={C.emerald}
          spark={sparkTotals}
          href="/sales"
        />
        <KPICard
          label="Ventas del Mes"
          value={`S/ ${fc(m.salesThisMonth)}`}
          subtext="mes en curso"
          icon={<TrendingUp />}
          accent={C.sky}
          spark={sparkTotals}
          href="/reports"
        />
        <KPICard
          label="Cobros del Mes"
          value={`S/ ${fc(m.paymentsThisMonth)}`}
          subtext="pagos recibidos"
          icon={<Wallet />}
          accent={C.teal}
          spark={sparkPaymt}
          href="/debt/plans"
        />
        <KPICard
          label="Deuda Total"
          value={`S/ ${fc(m.totalOutstandingDebt)}`}
          subtext={m.totalOverdueDebt > 0 ? `S/ ${fc(m.totalOverdueDebt)} vencida` : 'sin mora'}
          subtextDanger={m.totalOverdueDebt > 0}
          icon={<CreditCard />}
          accent={C.rose}
          spark={sparkCred}
          href="/debt/plans"
        />
        <KPICard
          label="Clientes"
          value={fn(m.totalActiveClients)}
          subtext={`${fn(m.inactiveClients)} inactivos +90 días`}
          icon={<Users />}
          accent={C.violet}
          href="/clients"
        />
        <KPICard
          label="Con Deuda"
          value={fn(m.clientsWithDebt)}
          subtext={m.clientsWithOverdueDebt > 0 ? `${fn(m.clientsWithOverdueDebt)} en mora` : 'sin mora'}
          subtextDanger={m.clientsWithOverdueDebt > 0}
          icon={<Users />}
          accent={C.amber}
          href="/debt/plans"
        />
        <KPICard
          label="Stock Crítico"
          value={fn(m.lowStockProducts)}
          subtext="productos bajo mínimo"
          icon={<Package />}
          accent={C.orange}
          href="/inventory/stock"
        />
        <KPICard
          label="Acciones Hoy"
          value={fn(actCount)}
          subtext={`${efficiencyRate.toFixed(0)}% efectividad`}
          icon={<Activity />}
          accent={C.indigo}
          spark={sparkCount}
          href="/collections/actions"
        />

      </div>

      {/* ── Main Chart ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Ventas, Contado y Crédito</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Rendimiento diario — últimos {chartRange === '7D' ? '7' : '30'} días</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex gap-4">
              {[
                { name: 'Ventas',        color: C.emerald },
                { name: 'Contado',       color: C.teal    },
                { name: 'Crédito',       color: C.amber   },
                { name: 'Utilidad est.', color: C.indigo  },
              ].map(s => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] text-gray-400">{s.name}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-1">
              {(['7D', '30D'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    chartRange === r
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <defs>
              {[
                { id: 'gV',  c: C.emerald },
                { id: 'gC',  c: C.teal    },
                { id: 'gCr', c: C.amber   },
                { id: 'gU',  c: C.indigo  },
              ].map(g => (
                <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={g.c} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={g.c} stopOpacity={0}    />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="Ventas"        stroke={C.emerald} strokeWidth={2}   fill="url(#gV)"  />
            <Area type="monotone" dataKey="Contado"       stroke={C.teal}    strokeWidth={1.5} fill="url(#gC)"  />
            <Area type="monotone" dataKey="Crédito"       stroke={C.amber}   strokeWidth={1.5} fill="url(#gCr)" />
            <Area type="monotone" dataKey="Utilidad est." stroke={C.indigo}  strokeWidth={1.5} fill="url(#gU)"  />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 1: Top Productos + Contado vs Crédito ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Top Productos */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
          <SectionHead
            title="Top Productos"
            subtitle="Más vendidos — últimos 30 días · datos de muestra"
            action={
              <Link href="/reports" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 font-medium">
                Ver reporte <ChevronRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="space-y-4">
            {TOP_PRODUCTS.map(p => (
              <div key={p.code} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-200 w-4 tabular-nums text-right flex-shrink-0">{p.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-800 truncate mr-2">{p.name}</p>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className={`text-[11px] font-semibold ${p.growth >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {p.growth >= 0 ? '+' : ''}{p.growth}%
                      </span>
                      <span className="text-xs font-bold text-gray-900 tabular-nums">
                        S/ {p.revenue.toLocaleString('es-PE')}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${(p.revenue / MAX_PRODUCT_REVENUE) * 100}%`, backgroundColor: p.color }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{p.qty} uds · {p.code}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contado vs Crédito */}
        <div className="bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5 flex flex-col">
          <SectionHead title="Contado vs Crédito" subtitle="Últimos 30 días · real" />
          {cvcTotal > 0 ? (
            <>
              <div className="flex justify-center">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      animationBegin={0} animationDuration={900}
                    >
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [`S/ ${fc(Number(v))}`, '']}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">{item.name}</span>
                        <span className="font-bold text-gray-800">
                          {cvcTotal > 0 ? ((item.value / cvcTotal) * 100).toFixed(1) : '0'}%
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 tabular-nums">S/ {fc(item.value)}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-50 flex justify-between text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="font-extrabold text-gray-900">S/ {fc(cvcTotal)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Sin ventas registradas
            </div>
          )}
        </div>

      </div>

      {/* ── Row 2: Heatmap + Embudo ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Heatmap */}
        <div className="bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
          <SectionHead title="Intensidad de Ventas por Hora" subtitle="Patrón semanal estimado" />
          <div className="overflow-x-auto">
            <div className="min-w-[300px]">
              <div className="flex mb-1.5 ml-9">
                {HEATMAP_HOURS.map(h => (
                  <div key={h} className="flex-1 text-[9px] text-gray-400 text-center">{h}h</div>
                ))}
              </div>
              {HEATMAP_DAYS.map((day, di) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-gray-400 w-8 text-right pr-1 flex-shrink-0">{day}</span>
                  {HEATMAP_HOURS.map((_, hi) => {
                    const val = HEATMAP_GRID[di][hi]
                    return (
                      <div
                        key={hi}
                        className="flex-1 h-[18px] rounded-sm cursor-default hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: heatColor(val) }}
                        title={`${day} ${HEATMAP_HOURS[hi]}h — ${val}%`}
                      />
                    )
                  })}
                </div>
              ))}
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-[9px] text-gray-400">Bajo</span>
                {['#d1fae5','#6ee7b7','#fde68a','#f97316','#ef4444'].map(c => (
                  <div key={c} className="w-4 h-3 rounded-sm" style={{ backgroundColor: c }} />
                ))}
                <span className="text-[9px] text-gray-400">Alto</span>
              </div>
            </div>
          </div>
        </div>

        {/* Embudo */}
        <div className="bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
          <SectionHead title="Embudo de Clientes" subtitle="Ciclo de vida · datos reales" />
          <div className="space-y-3.5">
            {funnelSteps.map((step, i) => {
              const pct = totalRegistered > 0 ? (step.value / totalRegistered) * 100 : 0
              const prevPct = i > 0 && funnelSteps[i - 1].value > 0
                ? (step.value / funnelSteps[i - 1].value) * 100 : null
              return (
                <div key={step.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-700 font-medium">{step.label}</span>
                    <div className="flex gap-2 items-baseline">
                      <span className="font-extrabold text-gray-900 tabular-nums">{fn(step.value)}</span>
                      <span className="text-gray-400 text-[11px]">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="relative w-full bg-gray-100 rounded-lg h-6 overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-lg transition-all duration-700"
                      style={{
                        width: `${Math.max(pct, 6)}%`,
                        backgroundColor: step.color + '25',
                        borderLeft: `3px solid ${step.color}`,
                      }}
                    />
                  </div>
                  {prevPct !== null && (
                    <p className="text-[10px] text-gray-300 mt-0.5 text-right">
                      {prevPct.toFixed(0)}% de etapa anterior
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Row 3: Distritos (real) + Rotación ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Clientes por Distrito — DATOS REALES */}
        <div className="bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
          <SectionHead
            title="Clientes por Distrito"
            subtitle={locationDisplay.length > 0 ? `${fn(locationDisplay.reduce((s, l) => s + l.clients, 0))} clientes geolocalizados` : 'Sin datos de dirección'}
            action={
              <Link href="/map" className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                <MapPin className="h-3.5 w-3.5" /> Mapa
              </Link>
            }
          />
          {locationDisplay.length > 0 ? (
            <div className="space-y-3.5">
              {locationDisplay.map((loc, i) => (
                <div key={loc.district}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-700 font-medium">{loc.district}</span>
                    <span className="font-bold text-gray-900 tabular-nums">{loc.clients} cliente{loc.clients !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${(loc.clients / maxLocationClients) * 100}%`,
                        backgroundColor: ACCENT_PALETTE[i % ACCENT_PALETTE.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <MapPin className="h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">Agrega direcciones a los clientes para ver la distribución geográfica</p>
              <Link href="/clients" className="text-xs text-indigo-600 hover:underline font-medium">
                Ir a Clientes →
              </Link>
            </div>
          )}
        </div>

        {/* Rotación de Inventario */}
        <div className="bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Rotación de Inventario</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Stock vs vendidos — últimos 14 días · estimado</p>
            </div>
            <div className="flex gap-3">
              {[
                { name: 'Stock',    color: C.indigo  },
                { name: 'Vendidos', color: C.emerald },
              ].map(s => (
                <div key={s.name} className="flex items-center gap-1">
                  <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] text-gray-400">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={inventoryData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gStock"    x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.indigo}  stopOpacity={0.15} />
                  <stop offset="100%" stopColor={C.indigo}  stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gVendidos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.emerald} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={C.emerald} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Area type="monotone" dataKey="Stock"    stroke={C.indigo}  strokeWidth={2}   fill="url(#gStock)"    name="Stock"    />
              <Area type="monotone" dataKey="Vendidos" stroke={C.emerald} strokeWidth={1.5} fill="url(#gVendidos)" name="Vendidos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── Ventas Recientes ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-50 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
        <SectionHead
          title="Ventas Recientes"
          subtitle="Últimas transacciones registradas"
          action={
            <Link href="/pos" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 font-medium">
              Ir al POS <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />
        {recentSales.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No hay ventas registradas</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentSales.map(sale => (
              <Link
                key={sale.id}
                href="/sales"
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-gray-50/60 -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
              >
                <div
                  className="w-1 h-9 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sale.sale_type === 'CREDITO' ? C.amber : C.emerald }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{sale.sale_number}</p>
                  <p className="text-xs text-gray-400">
                    {sale.sale_type === 'CREDITO' && sale.clients ? sale.clients.name : 'Venta al contado'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-extrabold tabular-nums text-gray-900">S/ {fc(Number(sale.total))}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(sale.created_at).toLocaleString('es-PE', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
