'use client'

/**
 * Credit Plans View — grouped by client, server-side paginated
 *
 * Performance fix: replaced a single "load-everything" Supabase query
 * (2,600+ plans × all installments) with a paginated API call that
 * loads 25 clients at a time, each with their plans + installments
 * (~750 rows max per page instead of 20,000+).
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useStore } from '@/contexts/store-context'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate, getSafeTimestamp, isValidDate } from '@/lib/utils/date'
import { getTodayPeru, addDaysPeru } from '@/lib/utils/timezone'
import { createBrowserClient } from '@/lib/supabase/client'
import { InstallmentStatusBadge } from './installment-status-badge'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertCircle, Clock, ChevronRight, User, Phone,
  Receipt, Search, DollarSign, FileText, ChevronsDownUp,
  ChevronsUpDown, TrendingUp, Users, ExternalLink,
  ChevronLeft, Loader2, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  imported_from_legacy?: boolean
  legacy_purchase_description?: string | null
  legacy_purchase_date?: string | null
  legacy_source?: string | null
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
  imported_from_legacy?: boolean
}

interface PageMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

const PER_PAGE = 25

// ─── Main component ───────────────────────────────────────────────────────────

export function CreditPlansView() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [minCredit, setMinCredit] = useState(0)  // S/ monto mínimo para filtrar micro-deudas
  const [meta, setMeta] = useState<PageMeta>({ total: 0, page: 1, per_page: PER_PAGE, total_pages: 1 })
  const [globalStats, setGlobalStats] = useState<{ total_debt: number; overdue: number }>({ total_debt: 0, overdue: 0 })
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())
  const { selectedStore, storeId } = useStore()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Load page ─────────────────────────────────────────────────────────────

  const loadPage = useCallback(async (page: number, searchTerm: string, store: string, minAmt = 0) => {
    if (page === 1) setLoading(true)
    else setPageLoading(true)

    try {
      const url = new URL('/api/credit-plans', window.location.origin)
      url.searchParams.set('page', String(page))
      url.searchParams.set('per_page', String(PER_PAGE))
      if (searchTerm) url.searchParams.set('search', searchTerm)
      url.searchParams.set('store', store)
      if (minAmt > 0) url.searchParams.set('min_credit', String(minAmt))

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Error loading credit plans')
      const json = await res.json()

      setClients(json.data || [])
      if (json.stats) setGlobalStats(json.stats)
      setMeta({
        total: json.total,
        page: json.page,
        per_page: json.per_page,
        total_pages: json.total_pages,
      })
      // Collapse everything on page/search change
      setExpandedClients(new Set())
      setExpandedPlans(new Set())
    } catch (err) {
      console.error('[CreditPlansView] loadPage error:', err)
    } finally {
      setLoading(false)
      setPageLoading(false)
    }
  }, [])

  // ─── Trigger: page, store, minCredit ─────────────────────────────────────

  useEffect(() => {
    if (selectedStore === 'ALL' || storeId !== null) {
      loadPage(currentPage, search, selectedStore, minCredit)
    }
  }, [currentPage, selectedStore, storeId, minCredit]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Trigger: search (debounced 400ms) ───────────────────────────────────

  const handleSearchChange = (value: string) => {
    setInputValue(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setSearch(value)
      setCurrentPage(1)
      loadPage(1, value, selectedStore)
    }, 400)
  }

  const clearSearch = () => {
    setInputValue('')
    setSearch('')
    setCurrentPage(1)
    loadPage(1, '', selectedStore)
  }

  // ─── Load alerts (overdue) — lightweight, separate query ─────────────────

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const supabase = createBrowserClient()
        const { data } = await supabase
          .from('installments')
          .select(`id, installment_number, amount, due_date, status,
            credit_plans!inner ( id, clients!inner ( id, name ) )`)
          .in('status', ['OVERDUE'])
          .lte('due_date', addDaysPeru(7))
          .order('due_date', { ascending: true })
          .limit(15)
        setAlerts(data || [])
      } catch { /* non-critical */ }
    }
    fetchAlerts()
  }, [])

  // ─── Toggle helpers ────────────────────────────────────────────────────────

  const toggleClient = (id: string) =>
    setExpandedClients(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const togglePlan = (id: string) =>
    setExpandedPlans(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const expandAll = () => setExpandedClients(new Set(clients.map(c => c.client_id)))
  const collapseAll = () => { setExpandedClients(new Set()); setExpandedPlans(new Set()) }

  // ─── Derived values ────────────────────────────────────────────────────────

  const totalDebt     = clients.reduce((s, c) => s + c.total_debt, 0)
  const totalOverdue  = clients.reduce((s, c) => s + c.overdue_amount, 0)
  const overdueClients = clients.filter(c => c.overdue_count > 0).length

  const now = Date.now()
  const overdueAlerts  = alerts.filter(a => isValidDate(a.due_date) && getSafeTimestamp(a.due_date) < now)
  const upcomingAlerts = alerts.filter(a => isValidDate(a.due_date) && getSafeTimestamp(a.due_date) >= now)

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-14 rounded-xl border bg-muted/30 animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Summary KPIs — reflect current page */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total clientes" value={String(meta.total)} sub="Con crédito activo" icon={Users} color="blue" />
        <KpiCard label="Esta página" value={String(clients.length)} sub={`Página ${meta.page} de ${meta.total_pages}`} icon={TrendingUp} color="amber" />
        <KpiCard label="Deuda total" value={formatCurrency(globalStats.total_debt)} sub="Saldo pendiente global" icon={TrendingUp} color="amber" />
        <KpiCard label="Vencido total" value={formatCurrency(globalStats.overdue)} sub={globalStats.overdue > 0 ? 'En mora global' : 'Sin mora'} icon={AlertCircle} color={globalStats.overdue > 0 ? 'rose' : 'green'} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {overdueAlerts.length > 0 && (
            <Card className="p-3 border-rose-200 bg-rose-50 dark:bg-rose-950/30">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 mb-1">
                    {overdueAlerts.length} cuota{overdueAlerts.length !== 1 ? 's' : ''} vencida{overdueAlerts.length !== 1 ? 's' : ''}
                  </p>
                  {overdueAlerts.slice(0, 3).map((a: any) => (
                    <p key={a.id} className="text-xs text-rose-700 dark:text-rose-300">
                      <span className="font-medium">{a.credit_plans?.clients?.name}</span>
                      {' '}- Cuota #{a.installment_number} ({formatSafeDate(a.due_date, 'dd/MM/yy')})
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          )}
          {upcomingAlerts.length > 0 && (
            <Card className="p-3 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    {upcomingAlerts.length} vencimiento{upcomingAlerts.length !== 1 ? 's' : ''} en 7 días
                  </p>
                  {upcomingAlerts.slice(0, 3).map((a: any) => (
                    <p key={a.id} className="text-xs text-amber-700 dark:text-amber-300">
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            placeholder="Buscar cliente, DNI, teléfono..."
            value={inputValue}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {inputValue && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={expandAll} className="gap-1.5 text-xs h-9">
          <ChevronsUpDown className="h-3.5 w-3.5" />Expandir todo
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll} className="gap-1.5 text-xs h-9">
          <ChevronsDownUp className="h-3.5 w-3.5" />Colapsar
        </Button>
        {/* Min-credit filter */}
        <select
          value={minCredit}
          onChange={e => { setMinCredit(Number(e.target.value)); setCurrentPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          title="Filtrar por deuda mínima"
        >
          <option value={0}>Todas las deudas</option>
          <option value={5}>Deuda &gt; S/ 5</option>
          <option value={10}>Deuda &gt; S/ 10</option>
          <option value={20}>Deuda &gt; S/ 20</option>
          <option value={50}>Deuda &gt; S/ 50</option>
          <option value={100}>Deuda &gt; S/ 100</option>
        </select>

        <Badge variant="secondary" className="h-9 px-3 text-xs tabular-nums">
          {overdueClients} en mora · {clients.length} en página
        </Badge>
      </div>

      {/* Client accordion list */}
      {pageLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground/70 text-sm">
          {search ? 'Sin resultados para la búsqueda' : 'No hay clientes con crédito activo'}
        </Card>
      ) : (
        <div className="space-y-2">
          {clients.map(client => (
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
      )}

      {/* Pagination */}
      {meta.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            Mostrando {(meta.page - 1) * meta.per_page + 1}–{Math.min(meta.page * meta.per_page, meta.total)} de {meta.total} clientes
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage <= 1 || pageLoading}
              onClick={() => { setCurrentPage(p => p - 1) }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page number pills — show at most 5 around current */}
            {getPaginationRange(currentPage, meta.total_pages).map((item, idx) =>
              item === '...' ? (
                <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <Button
                  key={item}
                  variant={item === currentPage ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  disabled={pageLoading}
                  onClick={() => { setCurrentPage(item as number) }}
                >
                  {item}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage >= meta.total_pages || pageLoading}
              onClick={() => { setCurrentPage(p => p + 1) }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {pageLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  )
}

// ─── Pagination range helper ──────────────────────────────────────────────────

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const range: (number | '...')[] = []
  // Always show first, last, and window around current
  const delta = 2
  const left  = Math.max(2, current - delta)
  const right = Math.min(total - 1, current + delta)

  range.push(1)
  if (left > 2) range.push('...')
  for (let i = left; i <= right; i++) range.push(i)
  if (right < total - 1) range.push('...')
  range.push(total)
  return range
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
  const legacyPurchaseSummary = client.plans
    .map(plan => plan.legacy_purchase_description?.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' | ')

  return (
    <div className={`rounded-xl border transition-colors ${isOverdue ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/20' : 'border-border bg-card'}`}>

      {/* Client header row */}
      <div
        onClick={onToggleClient}
        className="w-full px-4 py-3 flex items-center gap-3 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground/70 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />

        {/* Grid: name | plans | debt | overdue | actions */}
        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center">

          {/* Name + phone */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <User className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">{client.name}</span>
              {client.imported_from_legacy && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 flex-shrink-0">
                  LEGACY
                </Badge>
              )}
              {client.plans.some(p => p.imported_from_legacy) && !client.imported_from_legacy && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 flex-shrink-0">
                  Deuda legacy
                </Badge>
              )}
            </div>
            {client.phone && (
              <div className="flex items-center gap-1 mt-0.5 ml-5">
                <Phone className="h-3 w-3 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground/70">{client.phone}</span>
              </div>
            )}
            {legacyPurchaseSummary && (
              <p className="mt-1 ml-5 text-xs text-muted-foreground truncate">
                Compra: {legacyPurchaseSummary}
              </p>
            )}
          </div>

          {/* Plan count */}
          <div className="text-center hidden md:block">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Planes</p>
            <p className="text-sm font-semibold text-foreground/85">{client.plans.length}</p>
          </div>

          {/* Total debt */}
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Deuda total</p>
            <p className="text-sm font-bold text-amber-600 tabular-nums">{formatCurrency(client.total_debt)}</p>
          </div>

          {/* Overdue */}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide hidden md:block">Vencido</p>
            {isOverdue ? (
              <p className="text-sm font-bold text-rose-600 tabular-nums">{formatCurrency(client.overdue_amount)}</p>
            ) : (
              <Badge variant="success" className="text-[10px] h-5">Al día</Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Link href="/collections/payments" title="Registrar pago">
              <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
                <DollarSign className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/collections/actions" title="Registrar gestión">
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
        <div className="border-t border-dashed border-border">
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
  const todayStr = getTodayPeru()

  return (
    <div className={`border-b last:border-b-0 ${plan.overdue_count > 0 ? 'bg-rose-50 dark:bg-rose-950/20' : 'bg-card'}`}>

      {/* Plan row */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
        <Receipt className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />

        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center">

          {/* Ticket info */}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-semibold text-foreground">
                {plan.sale_number
                  ? `Ticket #${plan.sale_number}`
                  : plan.imported_from_legacy
                    ? 'Deuda importada (sistema anterior)'
                    : 'Sin ticket asociado'}
              </p>
              {plan.imported_from_legacy && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                  LEGACY
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              {plan.imported_from_legacy && plan.legacy_purchase_description
                ? plan.legacy_purchase_description
                : `${plan.installments_count} cuota${plan.installments_count !== 1 ? 's' : ''}`}
              {plan.imported_from_legacy && plan.legacy_purchase_date
                ? ` · Compra: ${formatSafeDate(plan.legacy_purchase_date, 'dd/MM/yy')}`
                : plan.sale_date && ` · ${formatSafeDate(plan.sale_date, 'dd/MM/yy')}`}
            </p>
          </div>

          {/* Total */}
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-muted-foreground/70">Total</p>
            <p className="text-xs tabular-nums text-foreground/85">{formatCurrency(plan.total_amount)}</p>
          </div>

          {/* Pagado */}
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-muted-foreground/70">Pagado</p>
            <p className="text-xs tabular-nums text-emerald-600">{formatCurrency(plan.paid_amount)}</p>
          </div>

          {/* Pendiente */}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground/70">Pendiente</p>
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
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-400' : pct >= 30 ? 'bg-amber-400' : 'bg-rose-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground/70 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
        </div>
      </div>

      {/* Expanded: installments table */}
      {isExpanded && plan.installments.length > 0 && (
        <div className="px-6 pb-4 pt-1">
          <div className="rounded-lg border border-border overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Cuota</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Monto</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Vencimiento</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Pagado</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Saldo</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plan.installments.map(inst => {
                  const balance = Number(inst.amount) - Number(inst.paid_amount)
                  const isPaid = inst.status === 'PAID' || balance <= 0
                  const isOverdueRow = !isPaid && (inst.due_date as string).split('T')[0] < todayStr
                  return (
                    <tr
                      key={inst.id}
                      className={`transition-colors ${isOverdueRow ? 'bg-rose-50 dark:bg-rose-950/20' : isPaid ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                      <td className="px-3 py-2 font-semibold text-foreground/85">#{inst.installment_number}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground/85">{formatCurrency(inst.amount)}</td>
                      <td className={`px-3 py-2 text-center tabular-nums ${isOverdueRow ? 'text-rose-600 font-semibold' : 'text-muted-foreground'}`}>
                        {formatSafeDate(inst.due_date, 'dd/MM/yy')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                        {inst.paid_amount > 0 ? formatCurrency(inst.paid_amount) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${balance > 0 ? (isOverdueRow ? 'text-rose-600' : 'text-amber-600') : 'text-muted-foreground/70'}`}>
                        {balance > 0 ? formatCurrency(balance) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <InstallmentStatusBadge status={inst.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t-2 border-border">
                  <td colSpan={3} className="px-3 py-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
                    Totales del plan
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-600 text-xs">{formatCurrency(plan.paid_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-600 text-xs">{formatCurrency(plan.pending_amount)}</td>
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
