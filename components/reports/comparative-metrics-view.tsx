'use client'

/**
 * ComparativeMetricsView
 *
 * Permite comparar 2 períodos (A y B) sobre los mismos indicadores:
 * ventas, cobros, clientes, productos, inventario.
 *
 * Cada métrica muestra el valor en A, B, diferencia absoluta y % de cambio.
 */

import { useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  TrendingUp, TrendingDown, Minus, DollarSign, ShoppingCart,
  Users, UserPlus, Package, Wallet, ArrowUpRight, ArrowDownRight, Loader2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { useStore } from '@/contexts/store-context'

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

interface Response {
  period_a: { from: string; to: string; metrics: PeriodMetrics }
  period_b: { from: string; to: string; metrics: PeriodMetrics }
  diff: Record<string, { abs: number; pct: number | null }>
  store: string
}

// ── Presets de períodos rápidos ──────────────────────────────────────────
function firstDayOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function lastDayOfMonth(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

const today = new Date()
const thisMonth = { from: firstDayOfMonth(today), to: lastDayOfMonth(today), label: `${today.toLocaleString('es-PE', { month: 'long' })} ${today.getFullYear()}` }
const lastMonth = (() => {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return { from: firstDayOfMonth(d), to: lastDayOfMonth(d), label: `${d.toLocaleString('es-PE', { month: 'long' })} ${d.getFullYear()}` }
})()
const thisYear = { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31`, label: `${today.getFullYear()}` }
const lastYear = { from: `${today.getFullYear() - 1}-01-01`, to: `${today.getFullYear() - 1}-12-31`, label: `${today.getFullYear() - 1}` }

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function ComparativeMetricsView() {
  const { selectedStore } = useStore()
  // Defaults: comparar mes pasado vs mes actual
  const [fromA, setFromA] = useState(lastMonth.from)
  const [toA,   setToA]   = useState(lastMonth.to)
  const [fromB, setFromB] = useState(thisMonth.from)
  const [toB,   setToB]   = useState(thisMonth.to)
  const [labelA, setLabelA] = useState(lastMonth.label)
  const [labelB, setLabelB] = useState(thisMonth.label)

  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ from_a: fromA, to_a: toA, from_b: fromB, to_b: toB })
      if (selectedStore && selectedStore !== 'ALL') qs.set('store', selectedStore)
      const res = await fetch(`/api/reports/comparative-metrics?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [fromA, toA, fromB, toB, selectedStore])

  // Carga inicial + cuando cambia tienda
  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  const applyPreset = (preset: 'monthVsLast' | 'yearVsLast' | 'lastQuarter') => {
    if (preset === 'monthVsLast') {
      setFromA(lastMonth.from); setToA(lastMonth.to); setLabelA(lastMonth.label)
      setFromB(thisMonth.from); setToB(thisMonth.to); setLabelB(thisMonth.label)
    } else if (preset === 'yearVsLast') {
      setFromA(lastYear.from); setToA(lastYear.to); setLabelA(lastYear.label)
      setFromB(thisYear.from); setToB(thisYear.to); setLabelB(thisYear.label)
    } else if (preset === 'lastQuarter') {
      const m = today.getMonth()
      const q = Math.floor(m / 3) - 1 // trimestre anterior
      const year = q < 0 ? today.getFullYear() - 1 : today.getFullYear()
      const qReal = (q + 4) % 4
      const startMonth = qReal * 3
      const fromD = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`
      const toD   = `${year}-${String(startMonth + 3).padStart(2, '0')}-${String(new Date(year, startMonth + 3, 0).getDate()).padStart(2, '0')}`
      setFromA(fromD); setToA(toD); setLabelA(`Q${qReal + 1} ${year}`)
      const curStartMonth = Math.floor(today.getMonth() / 3) * 3
      const curFrom = `${today.getFullYear()}-${String(curStartMonth + 1).padStart(2, '0')}-01`
      const curTo   = `${today.getFullYear()}-${String(curStartMonth + 3).padStart(2, '0')}-${String(new Date(today.getFullYear(), curStartMonth + 3, 0).getDate()).padStart(2, '0')}`
      setFromB(curFrom); setToB(curTo); setLabelB(`Q${Math.floor(today.getMonth() / 3) + 1} ${today.getFullYear()}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header con descripción */}
      <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 dark:from-indigo-950/30 dark:to-purple-950/30 dark:border-indigo-900">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
            <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Métricas comparativas</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Compara dos períodos de tiempo en ventas, cobros, clientes e inventario.
              Cambia tienda en el header para filtrar.
            </p>
          </div>
        </div>
      </Card>

      {/* Selectores de período */}
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Período A */}
          <div className="space-y-2 p-3 border-2 border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50/40 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Período A
              </label>
              <Input
                value={labelA}
                onChange={e => setLabelA(e.target.value)}
                className="h-7 text-xs w-32 text-right"
                placeholder="Etiqueta"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={fromA} onChange={e => setFromA(e.target.value)} className="h-9 text-sm" />
              <span className="text-muted-foreground text-xs">→</span>
              <Input type="date" value={toA} onChange={e => setToA(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Período B */}
          <div className="space-y-2 p-3 border-2 border-emerald-200 dark:border-emerald-900 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Período B
              </label>
              <Input
                value={labelB}
                onChange={e => setLabelB(e.target.value)}
                className="h-7 text-xs w-32 text-right"
                placeholder="Etiqueta"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={fromB} onChange={e => setFromB(e.target.value)} className="h-9 text-sm" />
              <span className="text-muted-foreground text-xs">→</span>
              <Input type="date" value={toB} onChange={e => setToB(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Presets:</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('monthVsLast')}>
            Mes pasado vs Este mes
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('lastQuarter')}>
            Trimestre pasado vs Actual
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('yearVsLast')}>
            Año pasado vs Este año
          </Button>
          <div className="flex-1" />
          <Button size="sm" className="h-8 px-4 text-xs" onClick={fetchMetrics} disabled={loading}>
            {loading ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Calculando…</> : 'Comparar'}
          </Button>
        </div>
      </Card>

      {/* Resultados */}
      {error && (
        <Card className="p-4 border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900">
          <p className="text-sm text-rose-700 dark:text-rose-300">Error: {error}</p>
        </Card>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {METRICS_DEFS.map(def => (
            <MetricCard
              key={def.key}
              label={def.label}
              icon={def.icon}
              format={def.format}
              valueA={(data.period_a.metrics as any)[def.key]}
              valueB={(data.period_b.metrics as any)[def.key]}
              diff={data.diff[def.key]}
              higherIsBetter={def.higherIsBetter}
              labelA={labelA}
              labelB={labelB}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface MetricDef {
  key: keyof PeriodMetrics
  label: string
  icon: any
  format: 'currency' | 'count'
  higherIsBetter: boolean
}

const METRICS_DEFS: MetricDef[] = [
  { key: 'sales_total',       label: 'Ventas Totales (S/)',   icon: DollarSign,   format: 'currency', higherIsBetter: true },
  { key: 'sales_count',       label: 'N° de Ventas',           icon: ShoppingCart, format: 'count',    higherIsBetter: true },
  { key: 'avg_ticket',        label: 'Ticket Promedio',        icon: TrendingUp,   format: 'currency', higherIsBetter: true },
  { key: 'sales_contado',     label: 'Ventas Contado (S/)',    icon: DollarSign,   format: 'currency', higherIsBetter: true },
  { key: 'sales_credito',     label: 'Ventas Crédito (S/)',    icon: DollarSign,   format: 'currency', higherIsBetter: true },
  { key: 'payments_total',    label: 'Cobros Recibidos (S/)',  icon: Wallet,       format: 'currency', higherIsBetter: true },
  { key: 'payments_count',    label: 'N° de Cobros',           icon: Wallet,       format: 'count',    higherIsBetter: true },
  { key: 'new_clients',       label: 'Clientes Nuevos',        icon: UserPlus,     format: 'count',    higherIsBetter: true },
  { key: 'active_clients',    label: 'Clientes con Compras',   icon: Users,        format: 'count',    higherIsBetter: true },
  { key: 'units_sold',        label: 'Unidades Vendidas',      icon: Package,      format: 'count',    higherIsBetter: true },
  { key: 'stock_in',          label: 'Entradas de Stock (u)',  icon: ArrowUpRight, format: 'count',    higherIsBetter: true },
  { key: 'stock_out',         label: 'Salidas de Stock (u)',   icon: ArrowDownRight, format: 'count',  higherIsBetter: false },
]

function MetricCard({
  label, icon: Icon, format, valueA, valueB, diff, higherIsBetter, labelA, labelB,
}: {
  label: string
  icon: any
  format: 'currency' | 'count'
  valueA: number
  valueB: number
  diff: { abs: number; pct: number | null }
  higherIsBetter: boolean
  labelA: string
  labelB: string
}) {
  const fmt = (n: number) => format === 'currency' ? formatCurrency(n) : n.toLocaleString('es-PE')
  const isUp     = diff.abs > 0
  const isDown   = diff.abs < 0
  const isFlat   = diff.abs === 0
  const isGood   = (isUp && higherIsBetter) || (isDown && !higherIsBetter)
  const isBad    = (isDown && higherIsBetter) || (isUp && !higherIsBetter)

  const trendColor = isGood
    ? 'text-emerald-600 dark:text-emerald-400'
    : isBad
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-muted-foreground'

  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground/85">{label}</span>
        </div>
      </div>

      {/* Valores A y B */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium truncate max-w-[40%]">
            A — {labelA}
          </span>
          <span className="text-sm font-bold text-foreground tabular-nums">{fmt(valueA)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[40%]">
            B — {labelB}
          </span>
          <span className="text-sm font-bold text-foreground tabular-nums">{fmt(valueB)}</span>
        </div>
      </div>

      {/* Diferencia */}
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <div className={`flex items-center gap-1.5 ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          <span className="text-sm font-semibold tabular-nums">
            {diff.abs > 0 ? '+' : ''}{fmt(diff.abs)}
          </span>
        </div>
        {diff.pct !== null ? (
          <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full ${
            isGood ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
            : isBad  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            : 'bg-muted text-muted-foreground'
          }`}>
            {diff.pct > 0 ? '+' : ''}{diff.pct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">A=0, sin %</span>
        )}
      </div>
    </Card>
  )
}
