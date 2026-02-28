'use client'

import { forwardRef } from 'react'
import { Card } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, ComposedChart, ReferenceLine
} from 'recharts'

// ─── Paleta profesional ───────────────────────────────────────────────────────
const C = {
  emerald: '#10b981', teal: '#14b8a6', blue: '#3b82f6',
  indigo: '#6366f1', violet: '#8b5cf6', pink: '#ec4899',
  amber: '#f59e0b', orange: '#f97316', rose: '#f43f5e',
  cyan: '#06b6d4', gray: '#94a3b8', slate: '#475569'
}
const PIE_COLORS = [C.emerald, C.blue, C.violet, C.amber, C.rose, C.cyan, C.orange, C.pink]
const GRADIENT_ID = (id: string) => `grad-${id}`

// ─── Formatters ───────────────────────────────────────────────────────────────
const fCur = (v: any) => `S/ ${Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fNum = (v: any) => Number(v || 0).toLocaleString('es-PE')
const fK = (v: any) => {
  const n = Number(v || 0)
  return n >= 1000 ? `S/ ${(n / 1000).toFixed(1)}k` : `S/ ${n.toFixed(0)}`
}
const fPct = (v: any) => `${Number(v || 0).toFixed(1)}%`
const truncate = (s: string, n = 18) => s?.length > n ? s.slice(0, n) + '…' : (s || 'N/A')

// ─── Sub-componentes comunes ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color = C.emerald }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border rounded-xl p-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-lg font-bold tabular-nums text-gray-900" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
    </div>
  )
}

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </Card>
  )
}


const CustomTooltipCur = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fCur(p.value)}</p>
      ))}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
interface ReportChartsProps {
  data: any[]
  reportType: string
}

export const ReportCharts = forwardRef<HTMLDivElement, ReportChartsProps>(
  function ReportCharts({ data, reportType }, ref) {
    if (!data || data.length === 0) {
      return (
        <Card className="p-8 text-center text-gray-400 text-sm">
          No hay datos suficientes para mostrar graficos
        </Card>
      )
    }

    const inner = () => {
      switch (reportType) {
        case 'inventory-rotation':
        case 'stock-rotation':
          return <InventoryRotationCharts data={data} />
        case 'inventory-valuation':
        case 'stock-valuation':
          return <InventoryValuationCharts data={data} />
        case 'low-stock':
          return <LowStockCharts data={data} />
        case 'kardex':
          return <KardexCharts data={data} />
        case 'sales-timeline':
        case 'sales-by-period':
          return <SalesByPeriodCharts data={data} />
        case 'sales-by-month':
          return <SalesByMonthCharts data={data} />
        case 'sales-summary':
          return <SalesSummaryCharts data={data} />
        case 'sales-by-product':
          return <SalesByProductCharts data={data} />
        case 'sales-by-category':
          return <SalesByCategoryCharts data={data} />
        case 'credit-vs-cash':
          return <CreditVsCashCharts data={data} />
        case 'sales-by-store':
          return <SalesByStoreCharts data={data} />
        case 'purchases-by-supplier':
          return <PurchasesBySupplierCharts data={data} />
        case 'purchases-by-period':
          return <PurchasesByPeriodCharts data={data} />
        case 'clients-debt':
        case 'clients-with-debt':
          return <ClientsDebtCharts data={data} />
        case 'overdue-installments':
          return <OverdueInstallmentsCharts data={data} />
        case 'collection-effectiveness':
          return <CollectionEffectivenessCharts data={data} />
        case 'profit-margin':
          return <ProfitMarginCharts data={data} />
        case 'cash-flow':
          return <CashFlowCharts data={data} />
        default:
          return (
            <Card className="p-5 text-center text-gray-400 text-sm">
              Grafico no disponible para este tipo de reporte
            </Card>
          )
      }
    }

    return <div ref={ref} className="space-y-4">{inner()}</div>
  }
)

// ────────────────────────────────────────────────────────────────────────────
// INVENTARIO — ROTACION
// ────────────────────────────────────────────────────────────────────────────
function InventoryRotationCharts({ data }: { data: any[] }) {
  const totalSold = data.reduce((s, d) => s + (d.totalSold || 0), 0)
  const withRotation = data.filter(d => d.rotation > 0)
  const avgRotation = withRotation.length > 0
    ? (withRotation.reduce((s, d) => s + d.rotation, 0) / withRotation.length).toFixed(2)
    : '0'

  const top15 = data.slice(0, 15).map(d => ({
    name: truncate(d.name, 20),
    vendidos: d.totalSold || 0,
    stock: d.currentStock || 0,
    rotacion: d.rotation || 0
  }))

  const top10Rot = data.filter(d => d.rotation > 0).slice(0, 10).map(d => ({
    name: truncate(d.name, 20),
    rotacion: d.rotation,
    vendidos: d.totalSold || 0
  }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Productos con movimiento" value={fNum(data.length)} color={C.emerald} />
        <StatCard label="Unidades vendidas" value={fNum(totalSold)} color={C.blue} />
        <StatCard label="Rotacion promedio" value={avgRotation + 'x'} sub="productos con stock actual" color={C.violet} />
      </div>

      <ChartCard title="Top 15 — Productos Mas Vendidos (Unidades)">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top15} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v, n) => [fNum(v), n === 'vendidos' ? 'Vendidos' : 'Stock']} />
            <Legend />
            <Bar dataKey="vendidos" fill={C.emerald} name="Vendidos" radius={[0, 4, 4, 0]} />
            <Bar dataKey="stock" fill={C.blue} name="Stock Actual" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {top10Rot.length > 0 && (
        <ChartCard title="Top 10 — Productos con Mayor Indice de Rotacion">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top10Rot} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}x`} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, n) => [n === 'rotacion' ? `${Number(v).toFixed(2)}x` : fNum(v), n === 'rotacion' ? 'Indice Rotacion' : 'Vendidos']} />
              <Legend />
              <Bar dataKey="rotacion" fill={C.teal} name="Indice Rotacion" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// INVENTARIO — VALORIZACION
// ────────────────────────────────────────────────────────────────────────────
function InventoryValuationCharts({ data }: { data: any[] }) {
  const totalCost = data.reduce((s, d) => s + (d.totalCost || 0), 0)
  const totalSale = data.reduce((s, d) => s + (d.totalSale || 0), 0)
  const totalProfit = data.reduce((s, d) => s + (d.potentialProfit || 0), 0)

  const byCategory = Object.values(
    data.reduce((acc: any, d) => {
      const cat = d.category || 'Sin categoria'
      if (!acc[cat]) acc[cat] = { categoria: cat, costo: 0, venta: 0, unidades: 0 }
      acc[cat].costo += d.totalCost || 0
      acc[cat].venta += d.totalSale || 0
      acc[cat].unidades += d.quantity || 0
      return acc
    }, {})
  ).sort((a: any, b: any) => b.venta - a.venta).slice(0, 8)

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Valor en Costo" value={fCur(totalCost)} color={C.amber} />
        <StatCard label="Valor en Venta" value={fCur(totalSale)} color={C.emerald} />
        <StatCard label="Ganancia Potencial" value={fCur(totalProfit)} color={C.violet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Valor por Categoria — Costo vs Precio Venta">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 5, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fK} />
              <YAxis type="category" dataKey="categoria" width={110} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltipCur />} />
              <Legend />
              <Bar dataKey="costo" fill={C.amber} name="Costo" radius={[0, 3, 3, 0]} />
              <Bar dataKey="venta" fill={C.emerald} name="Precio Venta" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribucion del Inventario por Valor de Venta">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="venta"
                nameKey="categoria"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={40}
                label={({ percent }: any) => percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                {(byCategory as any[]).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={fCur} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// STOCK BAJO
// ────────────────────────────────────────────────────────────────────────────
function LowStockCharts({ data }: { data: any[] }) {
  const agotado = data.filter(d => d.currentStock === 0).length
  const bajo = data.filter(d => d.currentStock > 0).length

  const chartData = data.slice(0, 20).map(d => ({
    name: truncate(d.name, 22),
    stock: d.currentStock,
    status: d.status
  })).sort((a, b) => a.stock - b.stock)

  const pieData = [
    { name: 'Agotado', value: agotado },
    { name: 'Stock Bajo', value: bajo }
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total productos criticos" value={fNum(data.length)} color={C.rose} />
        <StatCard label="Agotados" value={fNum(agotado)} color={C.rose} />
        <StatCard label="Stock bajo" value={fNum(bajo)} color={C.amber} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Productos Criticos — Stock Actual">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v) => [fNum(v), 'Unidades']} />
              <Bar dataKey="stock" name="Stock Actual" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.stock === 0 ? C.rose : C.amber} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribucion — Agotado vs Stock Bajo">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                label={({ percent }: any) => percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                <Cell fill={C.rose} />
                <Cell fill={C.amber} />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// KARDEX
// ────────────────────────────────────────────────────────────────────────────
function KardexCharts({ data }: { data: any[] }) {
  const entradas = data.filter(d => d.type === 'Entrada').reduce((s, d) => s + (d.quantity || 0), 0)
  const salidas = data.filter(d => d.type === 'Salida').reduce((s, d) => s + (d.quantity || 0), 0)

  const byDate = Object.values(
    data.reduce((acc: any, d) => {
      if (!acc[d.date]) acc[d.date] = { fecha: d.date, entradas: 0, salidas: 0 }
      if (d.type === 'Entrada') acc[d.date].entradas += d.quantity || 0
      else acc[d.date].salidas += d.quantity || 0
      return acc
    }, {})
  ).slice(0, 30)

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total movimientos" value={fNum(data.length)} color={C.blue} />
        <StatCard label="Unidades entradas" value={fNum(entradas)} color={C.emerald} />
        <StatCard label="Unidades salidas" value={fNum(salidas)} color={C.rose} />
      </div>

      <ChartCard title="Movimientos de Inventario en el Tiempo">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={byDate as any[]}>
            <defs>
              <linearGradient id={GRADIENT_ID('ent')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.emerald} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.emerald} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={GRADIENT_ID('sal')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.rose} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.rose} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v, n) => [fNum(v), n]} />
            <Legend />
            <Area type="monotone" dataKey="entradas" stroke={C.emerald} fill={`url(#${GRADIENT_ID('ent')})`} name="Entradas" strokeWidth={2} />
            <Area type="monotone" dataKey="salidas" stroke={C.rose} fill={`url(#${GRADIENT_ID('sal')})`} name="Salidas" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// VENTAS POR PERIODO / TIMELINE
// ────────────────────────────────────────────────────────────────────────────
function SalesByPeriodCharts({ data }: { data: any[] }) {
  const totalRevenue = data.reduce((s, d) => s + (d.total || 0), 0)
  const avgPerSale = data.length > 0 ? totalRevenue / data.length : 0

  const byDate = Object.values(
    data.reduce((acc: any, d) => {
      const date = d.fecha || 'N/A'
      if (!acc[date]) acc[date] = { fecha: date, total: 0, contado: 0, credito: 0, ventas: 0 }
      acc[date].total += d.total || 0
      acc[date].ventas += 1
      if (d.tipo === 'Contado') acc[date].contado += d.total || 0
      else acc[date].credito += d.total || 0
      return acc
    }, {})
  ).slice(0, 30) as any[]

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total periodo" value={fCur(totalRevenue)} color={C.emerald} />
        <StatCard label="Transacciones" value={fNum(data.length)} color={C.blue} />
        <StatCard label="Ticket promedio" value={fCur(avgPerSale)} color={C.violet} />
      </div>

      <ChartCard title="Tendencia de Ventas Diarias">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={byDate}>
            <defs>
              <linearGradient id={GRADIENT_ID('tot')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.emerald} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.emerald} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Area type="monotone" dataKey="total" stroke={C.emerald} fill={`url(#${GRADIENT_ID('tot')})`} strokeWidth={2} name="Total" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Contado vs Credito por Dia">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byDate}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar dataKey="contado" fill={C.emerald} name="Contado" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="credito" fill={C.amber} name="Credito" stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// VENTAS POR MES (agrupado por mes)
// ────────────────────────────────────────────────────────────────────────────
function SalesByMonthCharts({ data }: { data: any[] }) {
  const totalRevenue = data.reduce((s, d) => s + (d.total || 0), 0)
  const bestMonth = data.reduce((a, b) => (b.total || 0) > (a.total || 0) ? b : a, data[0] || {})
  const avgMonthly = data.length > 0 ? totalRevenue / data.length : 0

  const chartData = data.map(d => ({
    mes: d.mes || 'N/A',
    contado: d.totalContado || 0,
    credito: d.totalCredito || 0,
    total: d.total || 0,
    ventas: d.cantidadVentas || 0
  }))

  const pieData = chartData.map(d => ({ name: d.mes, value: d.total }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total del periodo" value={fCur(totalRevenue)} color={C.emerald} />
        <StatCard label="Mejor mes" value={bestMonth.mes || 'N/A'} sub={fCur(bestMonth.total)} color={C.blue} />
        <StatCard label="Promedio mensual" value={fCur(avgMonthly)} color={C.violet} />
      </div>

      <ChartCard title="Evolucion Mensual de Ventas">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={55} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={fK} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar yAxisId="left" dataKey="contado" fill={C.emerald} name="Contado" stackId="a" />
            <Bar yAxisId="left" dataKey="credito" fill={C.amber} name="Credito" stackId="a" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="ventas" stroke={C.blue} strokeWidth={2} name="# Ventas" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {data.length > 1 && (
        <ChartCard title="Participacion por Mes (% del Total Anual)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={40}
                label={({ percent }: any) => percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={fCur} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// RESUMEN DE VENTAS
// ────────────────────────────────────────────────────────────────────────────
function SalesSummaryCharts({ data }: { data: any[] }) {
  const chartData = data.map(d => ({ concepto: truncate(d.concepto, 22), monto: d.monto || 0 }))

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.map((d, i) => (
          <StatCard
            key={i}
            label={d.concepto}
            value={i === 3 ? fCur(d.monto) : d.concepto === 'Total Ventas' ? fNum(d.valor) : fCur(d.monto)}
            sub={i > 0 && i < 3 ? `${d.valor} transacciones` : undefined}
            color={[C.emerald, C.teal, C.amber, C.violet][i] || C.blue}
          />
        ))}
      </div>

      <ChartCard title="Comparativa de Montos">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="concepto" tick={{ fontSize: 10 }} angle={-10} textAnchor="end" height={55} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
            <Tooltip content={<CustomTooltipCur />} />
            <Bar dataKey="monto" name="Monto" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// VENTAS POR PRODUCTO
// ────────────────────────────────────────────────────────────────────────────
function SalesByProductCharts({ data }: { data: any[] }) {
  const totalRevenue = data.reduce((s, d) => s + (d.totalRevenue || 0), 0)
  const totalProfit = data.reduce((s, d) => s + (d.profit || 0), 0)

  const top10Rev = data.slice(0, 10).map(d => ({
    name: truncate(d.name, 22),
    ingresos: d.totalRevenue || 0,
    ganancia: d.profit || 0
  }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total ingresos" value={fCur(totalRevenue)} color={C.emerald} />
        <StatCard label="Ganancia bruta" value={fCur(totalProfit)} color={C.violet} />
        <StatCard label="Productos" value={fNum(data.length)} color={C.blue} />
      </div>

      <ChartCard title="Top 10 — Ingresos por Producto">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top10Rev} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fK} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar dataKey="ingresos" fill={C.blue} name="Ingresos" radius={[0, 4, 4, 0]} />
            <Bar dataKey="ganancia" fill={C.emerald} name="Ganancia" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// VENTAS POR CATEGORIA
// ────────────────────────────────────────────────────────────────────────────
function SalesByCategoryCharts({ data }: { data: any[] }) {
  const totalRevenue = data.reduce((s, d) => s + (d.totalIngresos || 0), 0)

  const chartData = data.slice(0, 10).map(d => ({
    categoria: truncate(d.categoria, 18),
    ingresos: d.totalIngresos || 0,
    unidades: d.cantidadVendida || 0
  }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total ingresos" value={fCur(totalRevenue)} color={C.emerald} />
        <StatCard label="Categorias" value={fNum(data.length)} color={C.blue} />
        <StatCard label="Lider" value={truncate(data[0]?.categoria || 'N/A', 16)} sub={fCur(data[0]?.totalIngresos)} color={C.violet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Ingresos por Categoria">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fK} />
              <YAxis type="category" dataKey="categoria" width={120} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltipCur />} />
              <Bar dataKey="ingresos" name="Ingresos" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Participacion en Ingresos">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="ingresos"
                nameKey="categoria"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={40}
                label={({ percent }: any) => percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={fCur} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// CREDITO VS CONTADO
// ────────────────────────────────────────────────────────────────────────────
function CreditVsCashCharts({ data }: { data: any[] }) {
  const totalAmount = data.reduce((s, d) => s + (d.total || 0), 0)
  const totalCount = data.reduce((s, d) => s + (d.cantidad || 0), 0)

  const amountData = data.map(d => ({ name: d.tipo, value: d.total || 0 }))
  const countData = data.map(d => ({ tipo: d.tipo, cantidad: d.cantidad || 0, total: d.total || 0 }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total general" value={fCur(totalAmount)} color={C.emerald} />
        <StatCard label="Transacciones" value={fNum(totalCount)} color={C.blue} />
        <StatCard label="Ticket promedio" value={fCur(totalCount > 0 ? totalAmount / totalCount : 0)} color={C.violet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribucion por Monto">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={amountData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                label={({ percent }: any) => percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                <Cell fill={C.emerald} />
                <Cell fill={C.amber} />
              </Pie>
              <Tooltip formatter={fCur} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Comparativa Monto vs Cantidad">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={countData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={fK} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="total" fill={C.emerald} name="Monto (S/)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="cantidad" fill={C.blue} name="Transacciones" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// VENTAS POR TIENDA
// ────────────────────────────────────────────────────────────────────────────
function SalesByStoreCharts({ data }: { data: any[] }) {
  const totalRevenue = data.reduce((s, d) => s + (d.total || 0), 0)
  const totalTransactions = data.reduce((s, d) => s + (d.cantidadVentas || 0), 0)

  const chartData = data.map(d => ({
    tienda: truncate(d.tienda, 18),
    contado: d.totalContado || 0,
    credito: d.totalCredito || 0,
    total: d.total || 0,
    ventas: d.cantidadVentas || 0
  }))

  const pieData = data.map(d => ({ name: d.tienda, value: d.total || 0 }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total todas las tiendas" value={fCur(totalRevenue)} color={C.emerald} />
        <StatCard label="Total transacciones" value={fNum(totalTransactions)} color={C.blue} />
        <StatCard label="Tiendas activas" value={fNum(data.length)} color={C.violet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Ventas por Tienda — Contado y Credito">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="tienda" tick={{ fontSize: 10 }} angle={-10} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
              <Tooltip content={<CustomTooltipCur />} />
              <Legend />
              <Bar dataKey="contado" fill={C.emerald} name="Contado" stackId="a" />
              <Bar dataKey="credito" fill={C.amber} name="Credito" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Participacion por Tienda">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={45}
                label={({ percent }: any) => percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                {pieData.map((_, i) => <Cell key={i} fill={[C.emerald, C.blue, C.violet, C.amber][i % 4]} />)}
              </Pie>
              <Tooltip formatter={fCur} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Cantidad de Transacciones por Tienda">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="tienda" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [fNum(v), 'Ventas']} />
            <Bar dataKey="ventas" name="Transacciones" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// COMPRAS POR PROVEEDOR
// ────────────────────────────────────────────────────────────────────────────
function PurchasesBySupplierCharts({ data }: { data: any[] }) {
  const totalCost = data.reduce((s, d) => s + (d.totalCosto || 0), 0)
  const totalUnits = data.reduce((s, d) => s + (d.totalUnidades || 0), 0)

  const chartData = data.slice(0, 12).map(d => ({
    name: truncate(d.producto || d.barcode, 22),
    costo: d.totalCosto || 0,
    unidades: d.totalUnidades || 0,
    entradas: d.entradas || 0
  }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total invertido" value={fCur(totalCost)} color={C.violet} />
        <StatCard label="Unidades recibidas" value={fNum(totalUnits)} color={C.blue} />
        <StatCard label="Productos distintos" value={fNum(data.length)} color={C.emerald} />
      </div>

      <ChartCard title="Top 12 — Costo Total por Producto Comprado">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fK} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9 }} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar dataKey="costo" fill={C.violet} name="Costo Total" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Participacion en Compras por Producto">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="costo"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={95}
              innerRadius={40}
              label={({ percent }: any) => percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
              labelLine={false}
            >
              {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={fCur} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// COMPRAS POR PERIODO
// ────────────────────────────────────────────────────────────────────────────
function PurchasesByPeriodCharts({ data }: { data: any[] }) {
  const totalCost = data.reduce((s, d) => s + (d.costoTotal || 0), 0)
  const totalUnits = data.reduce((s, d) => s + (d.cantidad || 0), 0)

  const byDate = Object.values(
    data.reduce((acc: any, d) => {
      const date = d.fecha || 'N/A'
      if (!acc[date]) acc[date] = { fecha: date, costo: 0, cantidad: 0 }
      acc[date].costo += d.costoTotal || 0
      acc[date].cantidad += d.cantidad || 0
      return acc
    }, {})
  ).slice(0, 30) as any[]

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total periodo" value={fCur(totalCost)} color={C.violet} />
        <StatCard label="Unidades ingresadas" value={fNum(totalUnits)} color={C.blue} />
        <StatCard label="Entradas" value={fNum(data.length)} color={C.emerald} />
      </div>

      <ChartCard title="Costo de Compras en el Tiempo">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={byDate}>
            <defs>
              <linearGradient id={GRADIENT_ID('comp')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.violet} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.violet} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Area type="monotone" dataKey="costo" stroke={C.violet} fill={`url(#${GRADIENT_ID('comp')})`} strokeWidth={2} name="Costo Total" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Unidades Recibidas por Fecha">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byDate}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [fNum(v), 'Unidades']} />
            <Bar dataKey="cantidad" fill={C.blue} name="Unidades" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// CLIENTES CON DEUDA
// ────────────────────────────────────────────────────────────────────────────
function ClientsDebtCharts({ data }: { data: any[] }) {
  const totalDebt = data.reduce((s, d) => s + (d.creditUsed || 0), 0)
  const totalOverdue = data.reduce((s, d) => s + (d.overdueAmount || 0), 0)
  const avgDebt = data.length > 0 ? totalDebt / data.length : 0
  const overdueClients = data.filter(d => (d.overdueAmount || 0) > 0).length

  const top10 = data.slice(0, 10).map(d => ({
    name: truncate(d.name, 22),
    deuda: d.creditUsed || 0,
    vencido: d.overdueAmount || 0,
    limite: d.creditLimit || 0,
  }))

  // Buckets de utilizacion
  const buckets = [
    { rango: '0-25%', count: 0 },
    { rango: '26-50%', count: 0 },
    { rango: '51-75%', count: 0 },
    { rango: '76-100%', count: 0 },
    { rango: '>100%', count: 0 }
  ]
  data.forEach(d => {
    if (!d.creditLimit || d.creditLimit === 0) return
    const pct = (d.creditUsed / d.creditLimit) * 100
    if (pct <= 25) buckets[0].count++
    else if (pct <= 50) buckets[1].count++
    else if (pct <= 75) buckets[2].count++
    else if (pct <= 100) buckets[3].count++
    else buckets[4].count++
  })

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deuda total cartera" value={fCur(totalDebt)} color={C.rose} />
        <StatCard label="Monto vencido" value={fCur(totalOverdue)} color={C.orange} />
        <StatCard label="Clientes con deuda" value={fNum(data.length)} color={C.amber} />
        <StatCard label="Clientes con atraso" value={fNum(overdueClients)} color={C.gray} />
      </div>

      <ChartCard title="Top 10 — Deuda Total vs Monto Vencido por Cliente">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fK} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar dataKey="deuda" fill={C.amber} name="Deuda Total" radius={[0, 4, 4, 0]} />
            <Bar dataKey="vencido" fill={C.rose} name="Monto Vencido" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribucion por Nivel de Utilizacion del Credito">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [fNum(v), 'Clientes']} />
            <Bar dataKey="count" name="Clientes" radius={[4, 4, 0, 0]}>
              {buckets.map((_, i) => <Cell key={i} fill={[C.emerald, C.blue, C.amber, C.orange, C.rose][i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// CUOTAS VENCIDAS
// ────────────────────────────────────────────────────────────────────────────
function OverdueInstallmentsCharts({ data }: { data: any[] }) {
  const totalOverdue = data.reduce((s, d) => s + (d.pending || 0), 0)
  const maxDays = data.reduce((m, d) => Math.max(m, d.daysOverdue || 0), 0)

  // Agrupar por cliente
  const byClient = Object.values(
    data.reduce((acc: any, d) => {
      const key = d.client || 'N/A'
      if (!acc[key]) acc[key] = { cliente: key, monto: 0, cuotas: 0 }
      acc[key].monto += d.pending || 0
      acc[key].cuotas += 1
      return acc
    }, {})
  ).sort((a: any, b: any) => b.monto - a.monto).slice(0, 10) as any[]

  // Buckets de antiguedad
  const aging = [
    { rango: '1-30 dias', monto: 0, cuotas: 0 },
    { rango: '31-60 dias', monto: 0, cuotas: 0 },
    { rango: '61-90 dias', monto: 0, cuotas: 0 },
    { rango: '+90 dias', monto: 0, cuotas: 0 }
  ]
  data.forEach(d => {
    const days = d.daysOverdue || 0
    const idx = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3
    aging[idx].monto += d.pending || 0
    aging[idx].cuotas += 1
  })

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total vencido" value={fCur(totalOverdue)} color={C.rose} />
        <StatCard label="Cuotas vencidas" value={fNum(data.length)} color={C.amber} />
        <StatCard label="Max dias atraso" value={`${maxDays} dias`} color={C.orange} />
      </div>

      <ChartCard title="Deuda Vencida por Cliente (Top 10)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byClient} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fK} />
            <YAxis type="category" dataKey="cliente" width={150} tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar dataKey="monto" fill={C.rose} name="Monto Vencido" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Vencimiento por Antiguedad — Monto (S/)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={aging}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="rango" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
              <Tooltip content={<CustomTooltipCur />} />
              <Bar dataKey="monto" name="Monto Vencido" radius={[4, 4, 0, 0]}>
                {aging.map((_, i) => <Cell key={i} fill={[C.amber, C.orange, C.rose, '#7f1d1d'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cantidad de Cuotas por Tramo de Atraso">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={aging}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="rango" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [fNum(v), 'Cuotas']} />
              <Bar dataKey="cuotas" name="Cuotas Vencidas" radius={[4, 4, 0, 0]}>
                {aging.map((_, i) => <Cell key={i} fill={[C.amber, C.orange, C.rose, '#7f1d1d'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// EFECTIVIDAD DE COBRANZA
// ────────────────────────────────────────────────────────────────────────────
function CollectionEffectivenessCharts({ data }: { data: any[] }) {
  const cobrado = data.find(d => d.concepto?.toLowerCase().includes('cobrado'))?.monto || 0
  const vencido = data.find(d => d.concepto?.toLowerCase().includes('vencida'))?.monto || 0
  const efectividad = data.find(d => d.concepto?.toLowerCase().includes('efectividad'))?.monto || 0

  const gaugeData = [{ name: 'Efectividad', value: Math.min(efectividad, 100) }]

  const barData = [
    { concepto: 'Cobrado', monto: cobrado },
    { concepto: 'Vencido pendiente', monto: vencido }
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total cobrado" value={fCur(cobrado)} color={C.emerald} />
        <StatCard label="Deuda vencida" value={fCur(vencido)} color={C.rose} />
        <StatCard label="Efectividad" value={`${efectividad.toFixed(1)}%`} sub="del objetivo de cobros" color={efectividad >= 70 ? C.emerald : C.amber} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Tasa de Efectividad de Cobranza">
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={efectividad >= 70 ? C.emerald : efectividad >= 40 ? C.amber : C.rose}
                  strokeWidth="10"
                  strokeDasharray={`${Math.min(efectividad, 100) * 2.513} 251.3`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">{efectividad.toFixed(0)}%</span>
              </div>
            </div>
            <span className="text-xs text-gray-500 text-center">
              {efectividad >= 70 ? 'Buena efectividad' : efectividad >= 40 ? 'Efectividad moderada' : 'Baja efectividad — accion requerida'}
            </span>
          </div>
        </ChartCard>

        <ChartCard title="Cobrado vs Deuda Vencida">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="concepto" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
              <Tooltip content={<CustomTooltipCur />} />
              <Bar dataKey="monto" name="Monto (S/)" radius={[4, 4, 0, 0]}>
                <Cell fill={C.emerald} />
                <Cell fill={C.rose} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// MARGEN DE GANANCIA
// ────────────────────────────────────────────────────────────────────────────
function ProfitMarginCharts({ data }: { data: any[] }) {
  const totalIngresos = data.reduce((s, d) => s + (d.ingresos || 0), 0)
  const totalGanancia = data.reduce((s, d) => s + (d.ganancia || 0), 0)
  const avgMargen = data.length > 0
    ? (data.reduce((s, d) => s + (d.margenNum || 0), 0) / data.length).toFixed(1)
    : '0'

  const top15Ganancia = data.slice(0, 15).map(d => ({
    name: truncate(d.producto, 22),
    ganancia: d.ganancia || 0,
    ingresos: d.ingresos || 0,
    margen: d.margenNum || 0
  }))

  const top15Margen = [...data]
    .sort((a, b) => (b.margenNum || 0) - (a.margenNum || 0))
    .slice(0, 15)
    .map(d => ({
      name: truncate(d.producto, 22),
      margen: d.margenNum || 0,
      ganancia: d.ganancia || 0
    }))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total ingresos" value={fCur(totalIngresos)} color={C.blue} />
        <StatCard label="Ganancia bruta total" value={fCur(totalGanancia)} color={C.emerald} />
        <StatCard label="Margen promedio" value={`${avgMargen}%`} color={totalGanancia > 0 ? C.emerald : C.rose} />
      </div>

      <ChartCard title="Top 15 — Ganancia en S/ por Producto">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top15Ganancia} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fK} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9 }} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar dataKey="ingresos" fill={C.blue} name="Ingresos" radius={[0, 0, 0, 0]} fillOpacity={0.5} />
            <Bar dataKey="ganancia" fill={C.emerald} name="Ganancia" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top 15 — Margen % por Producto">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top15Margen} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v, n) => [n === 'margen' ? `${Number(v).toFixed(2)}%` : fCur(v), n === 'margen' ? 'Margen %' : 'Ganancia S/']} />
            <Legend />
            <Bar dataKey="margen" name="Margen %" radius={[0, 4, 4, 0]}>
              {top15Margen.map((d, i) => (
                <Cell key={i} fill={d.margen >= 30 ? C.emerald : d.margen >= 15 ? C.amber : C.rose} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// FLUJO DE CAJA
// ────────────────────────────────────────────────────────────────────────────
function CashFlowCharts({ data }: { data: any[] }) {
  const netoTotal = data.find(d => d.concepto?.includes('NETO') || d.concepto?.includes('Neto'))?.neto
    ?? data.reduce((s, d) => s + (d.neto || 0), 0)

  const totalIngreso = data.reduce((s, d) => s + (d.ingreso || 0), 0)
  const totalEgreso = data.reduce((s, d) => s + (d.egreso || 0), 0)

  const barData = data
    .filter(d => !d.concepto?.includes('FLUJO'))
    .map(d => ({
      concepto: truncate(d.concepto, 26),
      ingreso: d.ingreso || 0,
      egreso: d.egreso || 0,
      neto: d.neto || 0
    }))

  const summaryRow = data.find(d => d.concepto?.includes('FLUJO') || d.concepto?.includes('NETO'))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total ingresos" value={fCur(totalIngreso)} color={C.emerald} />
        <StatCard label="Total egresos" value={fCur(totalEgreso)} color={C.rose} />
        <StatCard
          label="Flujo neto"
          value={fCur(summaryRow?.neto ?? netoTotal)}
          sub={(summaryRow?.neto ?? netoTotal) >= 0 ? 'Flujo positivo' : 'Flujo negativo'}
          color={(summaryRow?.neto ?? netoTotal) >= 0 ? C.emerald : C.rose}
        />
      </div>

      <ChartCard title="Desglose del Flujo de Caja — Ingresos y Egresos">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="concepto" tick={{ fontSize: 9 }} angle={-10} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
            <Tooltip content={<CustomTooltipCur />} />
            <Legend />
            <Bar dataKey="ingreso" fill={C.emerald} name="Ingreso" radius={[4, 4, 0, 0]} />
            <Bar dataKey="egreso" fill={C.rose} name="Egreso" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Neto por Concepto">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="concepto" tick={{ fontSize: 9 }} angle={-10} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fK} />
            <Tooltip content={<CustomTooltipCur />} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
            <Bar dataKey="neto" name="Neto" radius={[4, 4, 0, 0]}>
              {barData.map((d, i) => (
                <Cell key={i} fill={d.neto >= 0 ? C.emerald : C.rose} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}
