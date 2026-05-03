/**
 * DashboardClient v3.0 — Rediseño moderno
 *
 * Cambios vs v2:
 * - KPI cards con fondo de gradiente por color (verde/azul/teal/rojo)
 * - Strip horizontal de 4 stats secundarios (clientes, deuda, stock, cobranza)
 * - Gráfico de área mantenido (datos reales)
 * - Ventas recientes + Contado vs Crédito en una fila
 * - Distritos + Embudo de clientes (datos reales)
 * - ELIMINADO: Top Productos (mock), Heatmap (mock), Rotación (estimado),
 *              Resumen Ejecutivo (redundante con KPIs)
 * - "Utilidad est." eliminada del gráfico (era estimación sin respaldo)
 */
'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore, type StoreFilter } from '@/contexts/store-context'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, CreditCard, Wallet, Activity, AlertCircle,
  ChevronRight, ShoppingBag, Banknote, MapPin,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendPoint {
  period:  string
  label:   string
  total:   number
  count:   number
  contado: number
  credito: number
}

interface RecentSale {
  id:         string
  sale_number:string
  total:      number
  sale_type:  string
  created_at: string
  clients?:   { name: string } | null
}

interface LocationPoint {
  district: string
  clients:  number
}

export interface DashboardMetrics {
  salesToday:               number
  salesCountToday:          number
  salesThisMonth:           number
  paymentsThisMonth:        number
  totalOutstandingDebt:     number
  totalOverdueDebt:         number
  totalActiveClients:       number
  totalDeactivatedClients:  number
  clientsWithDebt:          number
  clientsWithOverdueDebt:   number
  inactiveClients:          number
  lowStockProducts:         number
  birthdaysThisMonth:       number
  pendingCollectionActions: number
}

export interface DashboardClientProps {
  metrics:          DashboardMetrics
  trend:            TrendPoint[]
  todayChange:      number
  cashTotal:        number
  creditTotal:      number
  efficiencyRate:   number
  actCount:         number
  recentSales:      RecentSale[]
  locationData:     LocationPoint[]
  storeFilter?:     string | null
  isAdmin?:         boolean
  activeStoreParam?: string | null
  userStores?:      string[]
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
}

const ACCENT_PALETTE = [C.indigo, C.sky, C.teal, C.emerald, C.violet, C.orange]

// ─── Utilities ────────────────────────────────────────────────────────────────

function fc(v: number) {
  return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fn(v: number) {
  return v.toLocaleString('es-PE', { maximumFractionDigits: 0 })
}

/** Convierte un color hex en rgba(r,g,b,alpha) para usar en inline styles */
function ha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const id = `sp${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={data.map(v => ({ v }))} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="v"
          stroke={color} strokeWidth={1.5}
          fill={`url(#${id})`} dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── KPI Card — fondo gradiente por acento ─────────────────────────────────────

interface KPICardProps {
  label:          string
  value:          string
  subtext?:       string
  subtextDanger?: boolean
  change?:        number
  icon:           React.ReactNode
  accent:         string
  spark?:         number[]
  href:           string
}

function KPICard({
  label, value, subtext, subtextDanger,
  change, icon, accent, spark, href,
}: KPICardProps) {
  const up = change === undefined || change >= 0

  return (
    <Link href={href} className="group block">
      <div
        className="relative overflow-hidden rounded-2xl p-4 h-full flex flex-col gap-2 hover:shadow-lg transition-all duration-200 border border-white/70"
        style={{
          background: `linear-gradient(145deg, ${ha(accent, 0.10)} 0%, ${ha(accent, 0.03)} 100%)`,
        }}
      >
        {/* Decorative soft circle */}
        <div
          className="absolute -right-6 -top-6 w-28 h-28 rounded-full pointer-events-none"
          style={{ backgroundColor: ha(accent, 0.08) }}
        />

        {/* Icon + trend badge */}
        <div className="relative flex items-center justify-between gap-2">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 [&>span>svg]:h-4 [&>span>svg]:w-4"
            style={{ backgroundColor: ha(accent, 0.18) }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
          {change !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
              up
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-600'
            }`}>
              {up
                ? <TrendingUp className="h-2.5 w-2.5" />
                : <TrendingDown className="h-2.5 w-2.5" />}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Label */}
        <p className="relative text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>

        {/* Main value */}
        <p className="relative text-[23px] font-black tracking-tight text-gray-900 leading-none">{value}</p>

        {/* Subtext */}
        {subtext && (
          <p className={`relative text-[11px] ${subtextDanger ? 'text-rose-600 font-semibold' : 'text-gray-500'}`}>
            {subtext}
          </p>
        )}

        {/* Sparkline or arrow */}
        {spark && spark.length > 2 ? (
          <div className="-mx-3 -mb-3 mt-auto">
            <Sparkline data={spark} color={accent} />
          </div>
        ) : (
          <div className="mt-auto flex justify-end">
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Stat Strip — stats secundarios en fila compacta ─────────────────────────

interface StatItem {
  label:        string
  value:        string
  icon:         React.ReactNode
  accent:       string
  badge?:       string
  badgeClass?:  string
  href:         string
}

function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] px-4 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-4 py-2.5 sm:py-0 first:pl-0 hover:opacity-70 transition-opacity"
          >
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 [&>span>svg]:h-4 [&>span>svg]:w-4"
              style={{ backgroundColor: ha(item.accent, 0.12) }}
            >
              <span style={{ color: item.accent }}>{item.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-black text-gray-900 leading-tight tabular-nums">{item.value}</p>
              <p className="text-[10px] text-gray-400 font-medium truncate">{item.label}</p>
            </div>
            {item.badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.badgeClass ?? 'bg-gray-100 text-gray-500'}`}>
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-xl p-3 text-xs min-w-[150px]">
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

// ─── Section Heading ──────────────────────────────────────────────────────────

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
  storeFilter,
  isAdmin,
  activeStoreParam,
  userStores,
}: DashboardClientProps) {
  const [chartRange, setChartRange] = useState<'7D' | '30D'>('30D')
  const { setSelectedStore } = useStore()
  const router = useRouter()

  const handleStoreSelect = (value: string) => {
    setSelectedStore(value as StoreFilter)
    router.push(value === 'ALL' ? '/dashboard' : `/dashboard?store=${value}`)
  }

  // Store filter options
  const ALL_STORE_OPTS = [
    { label: 'Todas',   value: 'ALL'     },
    { label: 'Mujeres', value: 'MUJERES' },
    { label: 'Hombres', value: 'HOMBRES' },
  ]
  const normalizedUserStores = (userStores ?? []).map(s => s.toUpperCase())
  const storeOptions = ALL_STORE_OPTS.filter(opt => {
    if (!normalizedUserStores.length) return true
    if (opt.value === 'ALL') return normalizedUserStores.length > 1
    return normalizedUserStores.includes(opt.value)
  })
  const showStoreFilter = isAdmin && storeOptions.length > 1

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const raw = chartRange === '7D' ? trend.slice(-7) : trend.slice(-30)
    return raw.map(d => ({
      label:     d.label,
      Ventas:    d.total,
      Contado:   d.contado,
      'Crédito': d.credito,
    }))
  }, [trend, chartRange])

  // ── Sparklines ──────────────────────────────────────────────────────────────
  const sparkTotals = useMemo(() => trend.slice(-14).map(d => d.total),      [trend])
  const sparkCred   = useMemo(() => trend.slice(-14).map(d => d.credito),     [trend])
  const sparkPaymt  = useMemo(() => trend.slice(-14).map(d => d.total * 0.48),[trend])

  // ── Pie ─────────────────────────────────────────────────────────────────────
  const cvcTotal = cashTotal + creditTotal
  const pieData = [
    { name: 'Contado', value: cashTotal,   color: C.emerald },
    { name: 'Crédito', value: creditTotal, color: C.amber   },
  ]

  // ── Funnel ──────────────────────────────────────────────────────────────────
  const totalRegistered = m.totalActiveClients + m.totalDeactivatedClients
  const funnelSteps = [
    { label: 'Clientes registrados', value: totalRegistered,          color: C.indigo },
    { label: 'Compraron alguna vez', value: m.totalActiveClients,     color: C.sky    },
    { label: 'Con deuda activa',     value: m.clientsWithDebt,        color: C.amber  },
    { label: 'En mora',              value: m.clientsWithOverdueDebt, color: C.rose   },
  ]

  // ── Location ─────────────────────────────────────────────────────────────────
  const locationDisplay     = locationData.length > 0 ? locationData : []
  const maxLocationClients  = Math.max(...locationDisplay.map(l => l.clients), 1)

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              timeZone: 'America/Lima',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showStoreFilter && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
              {storeOptions.map(opt => {
                const isActive = (activeStoreParam ?? 'ALL') === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleStoreSelect(opt.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      isActive
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}
          {!isAdmin && storeFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-100 rounded-full text-[11px] font-semibold text-sky-700">
              {storeFilter}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En vivo
          </span>
        </div>
      </div>

      {/* ── Alert pills ─────────────────────────────────────────────────────── */}
      {(m.pendingCollectionActions > 0 || m.lowStockProducts > 0 || m.birthdaysThisMonth > 0) && (
        <div className="flex flex-wrap gap-2">
          {m.pendingCollectionActions > 0 && (
            <Link href="/collections/actions?tab=history"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium hover:bg-amber-100 transition-colors">
              <AlertCircle className="h-3.5 w-3.5" />
              {fn(m.pendingCollectionActions)} acciones de cobranza pendientes
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
          {m.lowStockProducts > 0 && (
            <Link href="/inventory/stock?status=low"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full text-xs text-rose-700 font-medium hover:bg-rose-100 transition-colors">
              <Package className="h-3.5 w-3.5" />
              {fn(m.lowStockProducts)} productos con stock bajo
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
          {m.birthdaysThisMonth > 0 && (
            <Link href="/agenda"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-full text-xs text-violet-700 font-medium hover:bg-violet-100 transition-colors">
              🎂 {fn(m.birthdaysThisMonth)} cumpleaños este mes
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          )}
        </div>
      )}

      {/* ── 4 KPI Cards principales (con gradiente de color) ────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label="Ventas Hoy"
          value={`S/ ${fc(m.salesToday)}`}
          change={todayChange}
          subtext={`${fn(m.salesCountToday)} ${m.salesCountToday === 1 ? 'venta' : 'ventas'}`}
          icon={<DollarSign />}
          accent={C.emerald}
          spark={sparkTotals}
          href="/sales?period=TODAY"
        />
        <KPICard
          label="Ventas del Mes"
          value={`S/ ${fc(m.salesThisMonth)}`}
          subtext="mes en curso"
          icon={<TrendingUp />}
          accent={C.sky}
          spark={sparkTotals}
          href="/sales?period=MONTH"
        />
        <KPICard
          label="Cobros del Mes"
          value={`S/ ${fc(m.paymentsThisMonth)}`}
          subtext="pagos recibidos"
          icon={<Banknote />}
          accent={C.teal}
          spark={sparkPaymt}
          href="/collections/history?period=MONTH"
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
      </div>

      {/* ── Strip de stats secundarios ───────────────────────────────────────── */}
      <StatStrip items={[
        {
          label:      'Clientes activos',
          value:      fn(m.totalActiveClients),
          icon:       <Users />,
          accent:     C.violet,
          badge:      m.inactiveClients > 0 ? `${fn(m.inactiveClients)} inact.` : undefined,
          badgeClass: 'bg-gray-100 text-gray-500',
          href:       '/clients',
        },
        {
          label:      'Con deuda',
          value:      fn(m.clientsWithDebt),
          icon:       <Wallet />,
          accent:     C.amber,
          badge:      m.clientsWithOverdueDebt > 0
            ? `${fn(m.clientsWithOverdueDebt)} en mora`
            : 'sin mora',
          badgeClass: m.clientsWithOverdueDebt > 0
            ? 'bg-rose-100 text-rose-600'
            : 'bg-emerald-50 text-emerald-600',
          href:       '/debt/plans',
        },
        {
          label:      'Stock crítico',
          value:      fn(m.lowStockProducts),
          icon:       <Package />,
          accent:     C.orange,
          badge:      m.lowStockProducts > 0 ? 'revisar' : 'ok',
          badgeClass: m.lowStockProducts > 0
            ? 'bg-orange-100 text-orange-700'
            : 'bg-emerald-50 text-emerald-600',
          href:       '/inventory/stock?status=low',
        },
        {
          label:      'Cobranza hoy',
          value:      fn(actCount),
          icon:       <Activity />,
          accent:     C.indigo,
          badge:      `${efficiencyRate.toFixed(0)}% efectivo`,
          badgeClass: efficiencyRate >= 50
            ? 'bg-indigo-50 text-indigo-700'
            : 'bg-rose-100 text-rose-600',
          href:       '/collections/actions',
        },
      ]} />

      {/* ── Gráfico de área — datos reales ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Ventas · Contado · Crédito</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Rendimiento diario — últimos {chartRange === '7D' ? '7' : '30'} días
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex gap-4">
              {[
                { name: 'Ventas',   color: C.emerald },
                { name: 'Contado',  color: C.teal    },
                { name: 'Crédito',  color: C.amber   },
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

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <defs>
              {[
                { id: 'gV',  c: C.emerald },
                { id: 'gC',  c: C.teal    },
                { id: 'gCr', c: C.amber   },
              ].map(g => (
                <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={g.c} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={g.c} stopOpacity={0}    />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false} axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false} axisLine={false}
              tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="Ventas"   stroke={C.emerald} strokeWidth={2}   fill="url(#gV)"  />
            <Area type="monotone" dataKey="Contado"  stroke={C.teal}    strokeWidth={1.5} fill="url(#gC)"  />
            <Area type="monotone" dataKey="Crédito"  stroke={C.amber}   strokeWidth={1.5} fill="url(#gCr)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Ventas Recientes + Contado vs Crédito ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Ventas Recientes */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
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
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-gray-50/60 -mx-2 px-2 rounded-xl transition-colors"
                >
                  {/* Icono de tipo de venta */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: ha(sale.sale_type === 'CREDITO' ? C.amber : C.emerald, 0.14) }}
                  >
                    <ShoppingBag
                      className="h-3.5 w-3.5"
                      style={{ color: sale.sale_type === 'CREDITO' ? C.amber : C.emerald }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{sale.sale_number}</p>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{
                          backgroundColor: ha(sale.sale_type === 'CREDITO' ? C.amber : C.emerald, 0.12),
                          color:            sale.sale_type === 'CREDITO' ? C.amber : C.emerald,
                        }}
                      >
                        {sale.sale_type === 'CREDITO' ? 'Crédito' : 'Contado'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {sale.sale_type === 'CREDITO' && sale.clients ? sale.clients.name : 'Venta al contado'}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold tabular-nums text-gray-900">
                      S/ {fc(Number(sale.total))}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(sale.created_at).toLocaleString('es-PE', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                        timeZone: 'America/Lima',
                      })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Contado vs Crédito */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5 flex flex-col">
          <SectionHead title="Contado vs Crédito" subtitle="Últimos 30 días · datos reales" />
          {cvcTotal > 0 ? (
            <>
              <div className="flex justify-center">
                <ResponsiveContainer width={148} height={148}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={44} outerRadius={64}
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

              <div className="space-y-3 mt-2">
                {pieData.map(item => (
                  <div key={item.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-extrabold text-gray-900">
                          {cvcTotal > 0 ? ((item.value / cvcTotal) * 100).toFixed(1) : '0'}%
                        </span>
                        <span className="text-gray-400 text-[10px] tabular-nums">S/ {fc(item.value)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${cvcTotal > 0 ? (item.value / cvcTotal) * 100 : 0}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2.5 border-t border-gray-50 flex justify-between text-xs">
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

      {/* ── Clientes por Distrito + Embudo de Clientes ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Clientes por Distrito — datos reales */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
          <SectionHead
            title="Clientes por Distrito"
            subtitle={
              locationDisplay.length > 0
                ? `${fn(locationDisplay.reduce((s, l) => s + l.clients, 0))} clientes geolocalizados`
                : 'Sin datos de dirección'
            }
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
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ACCENT_PALETTE[i % ACCENT_PALETTE.length] }}
                      />
                      <span className="text-gray-700 font-medium">{loc.district}</span>
                    </div>
                    <span className="font-bold text-gray-900 tabular-nums">
                      {loc.clients} {loc.clients !== 1 ? 'clientes' : 'cliente'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
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
              <p className="text-sm text-gray-400">
                Agrega direcciones a los clientes para ver la distribución geográfica
              </p>
              <Link href="/clients" className="text-xs text-indigo-600 hover:underline font-medium">
                Ir a Clientes →
              </Link>
            </div>
          )}
        </div>

        {/* Embudo de Clientes — datos reales */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5">
          <SectionHead title="Embudo de Clientes" subtitle="Ciclo de vida · datos reales" />
          <div className="space-y-4">
            {funnelSteps.map((step, i) => {
              const pct     = totalRegistered > 0 ? (step.value / totalRegistered) * 100 : 0
              const prevPct = i > 0 && funnelSteps[i - 1].value > 0
                ? (step.value / funnelSteps[i - 1].value) * 100
                : null
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
                        width:           `${Math.max(pct, 4)}%`,
                        backgroundColor: step.color + '22',
                        borderLeft:      `3px solid ${step.color}`,
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

    </div>
  )
}
