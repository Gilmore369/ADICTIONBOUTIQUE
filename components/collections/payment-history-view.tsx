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
import { ExternalLink, Search, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'

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

type Period = '3M' | '6M' | '1Y'

interface Props {
  initialPayments: Payment[]
  initialPeriod?: Period
  userStores?: string[]
}

const PERIOD_LABELS: Record<Period, string> = {
  '3M': 'Últimos 3 meses',
  '6M': 'Últimos 6 meses',
  '1Y': 'Último año',
}

function filterByPeriod(payments: Payment[], period: Period): Payment[] {
  const now = new Date()
  let from: Date
  if (period === '3M') {
    from = new Date(now); from.setMonth(from.getMonth() - 3)
  } else if (period === '6M') {
    from = new Date(now); from.setMonth(from.getMonth() - 6)
  } else {
    from = new Date(now); from.setFullYear(from.getFullYear() - 1)
  }
  return payments.filter(p => new Date(p.payment_date) >= from)
}

export function PaymentHistoryView({ initialPayments, initialPeriod = '3M' }: Props) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = filterByPeriod(initialPayments, period)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.clients?.name?.toLowerCase().includes(q) ||
        p.clients?.dni?.includes(search) ||
        p.users?.name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [initialPayments, period, search])

  const total = filtered.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-4">
      {/* Period selector + search */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-white shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, DNI o usuario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Summary */}
      <Card className="p-4 flex items-center gap-3 bg-teal-50 border-teal-200">
        <DollarSign className="h-5 w-5 text-teal-600" />
        <div>
          <p className="text-xs text-teal-600 font-medium uppercase tracking-wide">
            Total cobrado — {PERIOD_LABELS[period]}
          </p>
          <p className="text-2xl font-bold text-teal-700">{formatCurrency(total)}</p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {filtered.length} pago{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </Card>

      {/* Table */}
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
      </Card>
    </div>
  )
}
