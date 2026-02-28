'use client'

/**
 * Credit Plans View — grouped by client
 *
 * Shows all clients with active credit, each expandable to reveal
 * their credit plans (sale tickets), which expand further to reveal
 * individual installments.
 */

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate, getSafeTimestamp, isValidDate } from '@/lib/utils/date'
import { InstallmentStatusBadge } from './installment-status-badge'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertCircle, Clock, ChevronRight, User, Phone,
  Receipt, Search, DollarSign, FileText, ChevronsDownUp,
  ChevronsUpDown, TrendingUp, Users, ExternalLink
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface InstallmentRow {
  id: string
  installment_number: number
  amount: number
  paid_amount: number
  due_date: string
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'
}

interface PlanRow {
  plan_id: string
  sale_id: string | null
  sale_number: string | null
  sale_date: string | null
  total_amount: number
  paid_amount: number
  pending_amount: number
  installments_count: number
  overdue_count: number
  overdue_amount: number
  installments: InstallmentRow[]
}

interface ClientRow {
  client_id: string
  name: string
  phone: string | null
  dni: string | null
  credit_limit: number
  plans: PlanRow[]
  total_debt: number
  overdue_count: number
  overdue_amount: number
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreditPlansView() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())

  useEffect(() => { loadData() }, [])

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadData = async () => {
    const supabase = createBrowserClient()

    // Fetch all active plans with client + sale + installments
    const { data: plans } = await supabase
      .from('credit_plans')
      .select(`
        id,
        total_amount,
        installments_count,
        sale_id,
        status,
        created_at,
        sale:sales ( id, sale_number, created_at ),
        client:clients ( id, name, phone, dni, credit_limit, credit_used ),
        installments ( id, installment_number, amount, paid_amount, due_date, status )
      `)
      .in('status', ['ACTIVE'])
      .order('created_at', { ascending: false })

    // Group by client
    const byClient: Record<string, ClientRow> = {}

    for (const plan of plans || []) {
      const c = plan.client as any
      if (!c) continue

      if (!byClient[c.id]) {
        byClient[c.id] = {
          client_id: c.id,
          name: c.name,
          phone: c.phone || null,
          dni: c.dni || null,
          credit_limit: Number(c.credit_limit || 0),
          plans: [],
          total_debt: 0,
          overdue_count: 0,
          overdue_amount: 0,
        }
      }

      const insts = (plan.installments as InstallmentRow[] || [])
        .sort((a, b) => getSafeTimestamp(a.due_date) - getSafeTimestamp(b.due_date))

      const paidAmt = insts.reduce((s, i) => s + Number(i.paid_amount || 0), 0)
      const pendingAmt = Number(plan.total_amount) - paidAmt
      const overdueInsts = insts.filter(i => i.status === 'OVERDUE')
      const overdueAmt = overdueInsts.reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0)
      const sale = plan.sale as any

      byClient[c.id].plans.push({
        plan_id: plan.id,
        sale_id: plan.sale_id || null,
        sale_number: sale?.sale_number || null,
        sale_date: sale?.created_at || null,
        total_amount: Number(plan.total_amount),
        paid_amount: paidAmt,
        pending_amount: pendingAmt,
        installments_count: plan.installments_count || insts.length,
        overdue_count: overdueInsts.length,
        overdue_amount: overdueAmt,
        installments: insts,
      })

      byClient[c.id].total_debt += pendingAmt
      byClient[c.id].overdue_count += overdueInsts.length
      byClient[c.id].overdue_amount += overdueAmt
    }

    const sorted = Object.values(byClient)
      .sort((a, b) => b.overdue_amount - a.overdue_amount || b.total_debt - a.total_debt)
    setClients(sorted)

    // Alerts: overdue or due in next 7 days
    const sevenDaysOut = new Date()
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
    const { data: alertsData } = await supabase
      .from('installments')
      .select(`
        id, installment_number, amount, due_date, status,
        credit_plans!inner ( id, clients!inner ( id, name ) )
      `)
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
      .lte('due_date', sevenDaysOut.toISOString().split('T')[0])
      .order('due_date', { ascending: true })
      .limit(15)
    setAlerts(alertsData || [])

    setLoading(false)
  }

  // ─── Toggle helpers ────────────────────────────────────────────────────────

  const toggleClient = (id: string) =>
    setExpandedClients(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const togglePlan = (id: string) =>
    setExpandedPlans(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const expandAll = () => {
    setExpandedClients(new Set(clients.map(c => c.client_id)))
  }
  const collapseAll = () => {
    setExpandedClients(new Set())
    setExpandedPlans(new Set())
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.dni?.includes(q) ||
      c.plans.some(p => p.sale_number?.toLowerCase().includes(q))
    )
  }, [clients, search])

  const totalDebt = clients.reduce((s, c) => s + c.total_debt, 0)
  const totalOverdue = clients.reduce((s, c) => s + c.overdue_amount, 0)
  const overdueClients = clients.filter(c => c.overdue_count > 0).length

  const now = Date.now()
  const overdueAlerts = alerts.filter(a => isValidDate(a.due_date) && getSafeTimestamp(a.due_date) < now)
  const upcomingAlerts = alerts.filter(a => isValidDate(a.due_date) && getSafeTimestamp(a.due_date) >= now)

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-14 rounded-xl border bg-gray-50 animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Clientes con crédito" value={String(clients.length)} sub={`${clients.length} activos`} icon={Users} color="blue" />
        <KpiCard label="Con cuotas vencidas" value={String(overdueClients)} sub={overdueClients > 0 ? 'Requieren atención' : 'Todo al día'} icon={AlertCircle} color={overdueClients > 0 ? 'rose' : 'green'} />
        <KpiCard label="Deuda total" value={formatCurrency(totalDebt)} sub="Saldo pendiente" icon={TrendingUp} color="amber" />
        <KpiCard label="Monto vencido" value={formatCurrency(totalOverdue)} sub={totalOverdue > 0 ? 'En mora' : 'Sin mora'} icon={AlertCircle} color={totalOverdue > 0 ? 'rose' : 'green'} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {overdueAlerts.length > 0 && (
            <Card className="p-3 border-rose-200 bg-rose-50">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-rose-900 mb-1">
                    {overdueAlerts.length} cuota{overdueAlerts.length !== 1 ? 's' : ''} vencida{overdueAlerts.length !== 1 ? 's' : ''}
                  </p>
                  {overdueAlerts.slice(0, 3).map((a: any) => (
                    <p key={a.id} className="text-xs text-rose-700">
                      <span className="font-medium">{a.credit_plans?.clients?.name}</span>
                      {' '}- Cuota #{a.installment_number} ({formatSafeDate(a.due_date, 'dd/MM/yy')})
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          )}
          {upcomingAlerts.length > 0 && (
            <Card className="p-3 border-amber-200 bg-amber-50">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    {upcomingAlerts.length} vencimiento{upcomingAlerts.length !== 1 ? 's' : ''} en 7 dias
                  </p>
                  {upcomingAlerts.slice(0, 3).map((a: any) => (
                    <p key={a.id} className="text-xs text-amber-700">
                      <span className="font-medium">{a.credit_plans?.clients?.name}</span>
                      {' '}- Cuota #{a.installment_number} ({formatSafeDate(a.due_date, 'dd/MM/yy')})
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar cliente, DNI, ticket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={expandAll} className="gap-1.5 text-xs h-9">
          <ChevronsUpDown className="h-3.5 w-3.5" />Expandir todo
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll} className="gap-1.5 text-xs h-9">
          <ChevronsDownUp className="h-3.5 w-3.5" />Colapsar
        </Button>
        <Badge variant="secondary" className="h-9 px-3 text-xs">
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Client accordion list */}
      {filtered.length === 0 && (
        <Card className="p-12 text-center text-gray-400 text-sm">
          {search ? 'Sin resultados para la busqueda' : 'No hay clientes con credito activo'}
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map(client => (
          <ClientAccordion
            key={client.client_id}
            client={client}
            isExpanded={expandedClients.has(client.client_id)}
            expandedPlans={expandedPlans}
            onToggleClient={() => toggleClient(client.client_id)}
            onTogglePlan={togglePlan}
          />
        ))}
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon?: React.ElementType
  color: string
}

function KpiCard({ label, value, sub, icon: Icon, color }: KpiCardProps) {
  const textColor: Record<string, string> = {
    blue: 'text-blue-600', rose: 'text-rose-600',
    amber: 'text-amber-600', green: 'text-emerald-600',
  }
  const bgColor: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-950/30',
    rose: 'bg-rose-50 dark:bg-rose-950/30',
    amber: 'bg-amber-50 dark:bg-amber-950/30',
    green: 'bg-emerald-50 dark:bg-emerald-950/30',
  }
  return (
    <Card className="p-3.5 overflow-hidden relative">
      {Icon && (
        <div className={`absolute right-3 top-3 p-1.5 rounded-lg ${bgColor[color] || ''}`}>
          <Icon className={`h-3.5 w-3.5 ${textColor[color] || 'text-muted-foreground'}`} />
        </div>
      )}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 pr-8">{label}</p>
      <p className={`text-xl font-bold tabular-nums leading-none ${textColor[color] || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </Card>
  )
}

// ─── Client accordion row ─────────────────────────────────────────────────────

interface ClientAccordionProps {
  client: ClientRow
  isExpanded: boolean
  expandedPlans: Set<string>
  onToggleClient: () => void
  onTogglePlan: (id: string) => void
}

function ClientAccordion({ client, isExpanded, expandedPlans, onToggleClient, onTogglePlan }: ClientAccordionProps) {
  const isOverdue = client.overdue_count > 0

  return (
    <div className={`rounded-xl border transition-colors ${isOverdue ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200 bg-white'}`}>

      {/* Client header row */}
      <div
        onClick={onToggleClient}
        className="w-full px-4 py-3 flex items-center gap-3 text-left rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
      >
        <ChevronRight
          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />

        {/* Grid: name | plans | debt | overdue | actions */}
        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center">

          {/* Name + phone */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <span className="font-semibold text-sm text-gray-900 truncate">{client.name}</span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-1 mt-0.5 ml-5">
                <Phone className="h-3 w-3 text-gray-300" />
                <span className="text-xs text-gray-400">{client.phone}</span>
              </div>
            )}
          </div>

          {/* Plan count */}
          <div className="text-center hidden md:block">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Planes</p>
            <p className="text-sm font-semibold text-gray-700">{client.plans.length}</p>
          </div>

          {/* Total debt */}
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Deuda total</p>
            <p className="text-sm font-bold text-amber-600 tabular-nums">{formatCurrency(client.total_debt)}</p>
          </div>

          {/* Overdue */}
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide hidden md:block">Vencido</p>
            {isOverdue ? (
              <p className="text-sm font-bold text-rose-600 tabular-nums">{formatCurrency(client.overdue_amount)}</p>
            ) : (
              <Badge variant="success" className="text-[10px] h-5">Al dia</Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Link href={`/collections/payments`} title="Registrar pago">
              <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
                <DollarSign className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href={`/collections/actions`} title="Registrar gestión">
              <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Overdue badge */}
        {isOverdue && (
          <Badge variant="destructive" className="text-[10px] flex-shrink-0">
            {client.overdue_count} venc.
          </Badge>
        )}
      </div>

      {/* Expanded: plans list */}
      {isExpanded && (
        <div className="border-t border-dashed border-gray-200">
          {client.plans.map(plan => (
            <PlanAccordion
              key={plan.plan_id}
              plan={plan}
              isExpanded={expandedPlans.has(plan.plan_id)}
              onToggle={() => onTogglePlan(plan.plan_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Plan accordion row ───────────────────────────────────────────────────────

function PlanAccordion({ plan, isExpanded, onToggle }: { plan: PlanRow; isExpanded: boolean; onToggle: () => void }) {
  const pct = plan.total_amount > 0 ? Math.min((plan.paid_amount / plan.total_amount) * 100, 100) : 0

  return (
    <div className={`border-b last:border-b-0 ${plan.overdue_count > 0 ? 'bg-rose-50/40' : 'bg-white'}`}>

      {/* Plan row */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50/80 transition-colors"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-gray-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
        <Receipt className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />

        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center">

          {/* Ticket info */}
          <div>
            <p className="text-xs font-semibold text-gray-800">
              {plan.sale_number ? `Ticket #${plan.sale_number}` : 'Sin ticket asociado'}
            </p>
            <p className="text-[10px] text-gray-400">
              {plan.installments_count} cuota{plan.installments_count !== 1 ? 's' : ''}
              {plan.sale_date && ` · ${formatSafeDate(plan.sale_date, 'dd/MM/yy')}`}
            </p>
          </div>

          {/* Total */}
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-gray-400">Total</p>
            <p className="text-xs tabular-nums text-gray-700">{formatCurrency(plan.total_amount)}</p>
          </div>

          {/* Pagado */}
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-gray-400">Pagado</p>
            <p className="text-xs tabular-nums text-emerald-600">{formatCurrency(plan.paid_amount)}</p>
          </div>

          {/* Pendiente */}
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Pendiente</p>
            <p className="text-xs font-semibold tabular-nums text-amber-600">{formatCurrency(plan.pending_amount)}</p>
          </div>

          {/* Ver plan link */}
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {plan.overdue_count > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                {plan.overdue_count} venc.
              </Badge>
            )}
            <Link
              href={`/debt/plans/${plan.plan_id}`}
              title="Abrir plan completo"
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline whitespace-nowrap"
            >
              Ver plan
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-14 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-400' : pct >= 30 ? 'bg-amber-400' : 'bg-rose-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
        </div>
      </div>

      {/* Expanded: installments table */}
      {isExpanded && (
        <div className="px-6 pb-4 pt-1">
          <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Cuota</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Monto</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Vencimiento</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Pagado</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Saldo</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plan.installments.map(inst => {
                  const balance = Number(inst.amount) - Number(inst.paid_amount)
                  const isOverdue = inst.status === 'OVERDUE'
                  const isPaid = inst.status === 'PAID'
                  return (
                    <tr
                      key={inst.id}
                      className={`transition-colors ${isOverdue ? 'bg-rose-50' : isPaid ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2 font-semibold text-gray-700">
                        #{inst.installment_number}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {formatCurrency(inst.amount)}
                      </td>
                      <td className={`px-3 py-2 text-center tabular-nums ${isOverdue ? 'text-rose-600 font-semibold' : 'text-gray-600'}`}>
                        {formatSafeDate(inst.due_date, 'dd/MM/yy')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                        {inst.paid_amount > 0 ? formatCurrency(inst.paid_amount) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${balance > 0 ? (isOverdue ? 'text-rose-600' : 'text-amber-600') : 'text-gray-400'}`}>
                        {balance > 0 ? formatCurrency(balance) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <InstallmentStatusBadge status={inst.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Plan totals footer */}
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={3} className="px-3 py-2 font-semibold text-[10px] text-gray-500 uppercase tracking-wide">
                    Totales del plan
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-600 text-xs">
                    {formatCurrency(plan.paid_amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-600 text-xs">
                    {formatCurrency(plan.pending_amount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
