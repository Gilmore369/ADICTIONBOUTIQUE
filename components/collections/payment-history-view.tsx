'use client'

/**
 * PaymentHistoryView
 * Client component for /collections/history
 * Shows payments with period filter and totals.
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { ExternalLink, Search, TrendingUp, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  payment_date: string
  notes?: string | null
  receipt_url?: string | null
  created_at: string
  client_id: string
  user_id: string
  clients?: { name: string; dni: string | null } | null
  users?: { name: string; stores: string[] } | null
}

type Period = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'custom'

interface Props {
  initialPayments: Payment[]
  initialPeriod?: '3M' | '6M' | '1Y'
  userStores?: string[]
}

const PERIODS: { key: Period; label: string; short: string }[] = [
  { key: '1D', label: 'Hoy',             short: 'Hoy' },
  { key: '1W', label: 'Última semana',   short: '7 días' },
  { key: '1M', label: 'Último mes',      short: '1 mes' },
  { key: '3M', label: 'Últimos 3 meses', short: '3 meses' },
  { key: '6M', label: 'Últimos 6 meses', short: '6 meses' },
  { key: '1Y', label: 'Último año',      short: '1 año' },
  { key: 'custom', label: 'Personalizado', short: 'Rango' },
]

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function todayStr(): string { return toDateStr(new Date()) }

function thisMonthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date()
  const to = todayStr()
  if (period === '1D') return { from: to, to }
  if (period === '1W') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return { from: toDateStr(d), to }
  }
  if (period === '1M') {
    const d = new Date(now); d.setMonth(d.getMonth() - 1)
    return { from: toDateStr(d), to }
  }
  if (period === '3M') {
    const d = new Date(now); d.setMonth(d.getMonth() - 3)
    return { from: toDateStr(d), to }
  }
  if (period === '6M') {
    const d = new Date(now); d.setMonth(d.getMonth() - 6)
    return { from: toDateStr(d), to }
  }
  // 1Y
  const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
  return { from: toDateStr(d), to }
}

export function PaymentHistoryView({ initialPayments, initialPeriod = '3M' }: Props) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [search, setSearch] = useState('')

  // Custom date range state
  const [customFrom, setCustomFrom] = useState(thisMonthStart)
  const [customTo, setCustomTo]   = useState(todayStr)

  const { from, to } = period === 'custom'
    ? { from: customFrom, to: customTo }
    : periodRange(period)

  const filtered = useMemo(() => {
    let list = initialPayments.filter(p => {
      const d = p.payment_date.slice(0, 10)
      return d >= from && d <= to
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.clients?.name?.toLowerCase().includes(q) ||
        p.clients?.dni?.includes(search) ||
        p.users?.name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [initialPayments, from, to, search])

  const total   = filtered.reduce((s, p) => s + Number(p.amount), 0)
  const avg     = filtered.length > 0 ? total / filtered.length : 0
  const maxPay  = filtered.length > 0 ? Math.max(...filtered.map(p => Number(p.amount))) : 0
  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? ''

  return (
    <div className="space-y-4">

      {/* ── Period tabs ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                period === p.key
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-800'
              )}
            >
              {p.short}
            </button>
          ))}
        </div>

        {/* Custom date pickers — shown always but highlighted when custom */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={period === 'custom' ? customFrom : from}
            onChange={e => { setPeriod('custom'); setCustomFrom(e.target.value) }}
            className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={period === 'custom' ? customTo : to}
            onChange={e => { setPeriod('custom'); setCustomTo(e.target.value) }}
            className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, DNI o usuario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* ── Compact summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wide leading-tight">
              Total cobrado
            </p>
            <p className="text-xl font-bold text-teal-700 leading-tight">{formatCurrency(total)}</p>
            <p className="text-[10px] text-teal-500 truncate">{periodLabel}</p>
          </div>
        </div>

        {/* Pagos */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-blue-600">#</span>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide leading-tight">
              Nº de cobros
            </p>
            <p className="text-xl font-bold text-gray-800 leading-tight">{filtered.length}</p>
            <p className="text-[10px] text-gray-400">registros</p>
          </div>
        </div>

        {/* Promedio */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-purple-600">Ø</span>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide leading-tight">
              Promedio
            </p>
            <p className="text-xl font-bold text-gray-800 leading-tight">{formatCurrency(avg)}</p>
            <p className="text-[10px] text-gray-400">por cobro</p>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay cobros en este período
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatSafeDate(p.payment_date)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{p.clients?.name ?? '—'}</p>
                    {p.clients?.dni && (
                      <p className="text-xs text-muted-foreground">{p.clients.dni}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-teal-700">
                    {formatCurrency(Number(p.amount))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.users?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                    {p.notes || '—'}
                  </TableCell>
                  <TableCell>
                    {p.receipt_url && (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Comprobante
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''} · Mayor pago: {formatCurrency(maxPay)}
        </div>
      </Card>
    </div>
  )
}
