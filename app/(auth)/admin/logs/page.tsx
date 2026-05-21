'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatSafeDate } from '@/lib/utils/date'
import { getTodayPeru, peruMidnightUTC, peruEndOfDayUTC } from '@/lib/utils/timezone'
import { RefreshCw, Loader2, ShoppingCart, DollarSign, Package, Phone, Filter, Edit2, Calendar, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Category = 'all' | 'ventas' | 'cobros' | 'inventario' | 'cobranzas' | 'devoluciones' | 'ediciones'
type Severity = 'info' | 'success' | 'warning' | 'error'

interface LogEntry {
  id: string
  category: string
  action: string
  detail: string
  store: string | null
  user_id: string
  user_name: string
  created_at: string
  severity: Severity
}

interface UserOption { id: string; name: string; email: string }

const CATEGORY_META: Record<Category, { label: string; icon: any; color: string }> = {
  all:        { label: 'Todo',        icon: Filter,      color: 'text-gray-600' },
  ventas:     { label: 'Ventas',      icon: ShoppingCart, color: 'text-blue-600' },
  cobros:     { label: 'Cobros',      icon: DollarSign,  color: 'text-green-600' },
  inventario: { label: 'Inventario',  icon: Package,     color: 'text-orange-600' },
  cobranzas:  { label: 'Cobranzas',  icon: Phone,       color: 'text-purple-600' },
  devoluciones: { label: 'Devoluciones', icon: RotateCcw, color: 'text-rose-600' },
  ediciones:  { label: 'Ediciones',  icon: Edit2,       color: 'text-rose-600' },
}

const SEVERITY_STYLES: Record<Severity, string> = {
  info:    'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error:   'bg-red-50 text-red-700 border-red-200',
}

const CAT_BADGE: Record<string, string> = {
  venta:     'bg-blue-100 text-blue-700',
  cobro:     'bg-green-100 text-green-700',
  inventario:'bg-orange-100 text-orange-700',
  cobranza:  'bg-purple-100 text-purple-700',
  devolucion:'bg-rose-100 text-rose-700',
  edicion:   'bg-rose-100 text-rose-700',
}

// Returns the first day of current month as 'YYYY-MM-DD'
function thisMonthStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}
function today() {
  return getTodayPeru()
}

export default function AdminLogsPage() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category>('all')
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(thisMonthStart())
  const [dateTo, setDateTo] = useState(today())

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'lastmonth' | 'year') => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    if (preset === 'today') {
      setDateFrom(fmt(now)); setDateTo(fmt(now))
    } else if (preset === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 6)
      setDateFrom(fmt(start)); setDateTo(fmt(now))
    } else if (preset === 'month') {
      setDateFrom(`${y}-${pad(m+1)}-01`); setDateTo(fmt(now))
    } else if (preset === 'lastmonth') {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      const last = new Date(ly, lm + 1, 0)
      setDateFrom(`${ly}-${pad(lm+1)}-01`); setDateTo(fmt(last))
    } else if (preset === 'year') {
      setDateFrom(`${y}-01-01`); setDateTo(fmt(now))
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Pedimos 500 entradas como buffer; la UI muestra 100 por página.
      // Cada subquery del API trae los 500 más recientes (orden DESC), después merge+slice.
      // En la práctica los queries individuales con .limit(500) son rápidos (~200ms cada uno).
      const params = new URLSearchParams({ category, limit: '500' })
      if (userId) params.set('user_id', userId)
      if (dateFrom) params.set('date_from', peruMidnightUTC(dateFrom))
      if (dateTo) params.set('date_to', peruEndOfDayUTC(dateTo))
      const res = await fetch(`/api/admin/logs?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setEntries(data.data || [])
      setUsers(data.users || [])
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [category, userId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = entries.filter(e =>
    !search ||
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.detail.toLowerCase().includes(search.toLowerCase()) ||
    e.user_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.store || '').toLowerCase().includes(search.toLowerCase())
  )

  // Paginación cliente — 100 por página (los logs DOM-pesados laguean cuando se renderizan 500 filas)
  const PAGE_SIZE = 100
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => { setCurrentPage(1) }, [category, userId, dateFrom, dateTo, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Logs del Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">Historial completo de acciones registradas en el ERP</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]).map(([key, meta]) => {
            const Icon = meta.icon
            const active = category === key
            return (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            )
          })}
        </div>

        {/* Date range row */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 px-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 px-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
          </div>
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1">
            {([
              { key: 'today',     label: 'Hoy' },
              { key: 'week',      label: '7 días' },
              { key: 'month',     label: 'Este mes' },
              { key: 'lastmonth', label: 'Mes anterior' },
              { key: 'year',      label: 'Este año' },
            ] as const).map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className="px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar acción, detalle, usuario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {/* User filter */}
          <select
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          >
            <option value="">Todos los usuarios</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(['venta','cobro','inventario','cobranza','devolucion','edicion'] as const).map(cat => {
          const count = filtered.filter(e => e.category === cat).length
          const labels: Record<string, string> = { venta: 'Ventas', cobro: 'Cobros', inventario: 'Movimientos', cobranza: 'Cobranzas', devolucion: 'Devoluciones', edicion: 'Ediciones' }
          return (
            <div key={cat} className="bg-card rounded-xl border border-border shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{labels[cat]}</div>
            </div>
          )
        })}
      </div>

      {/* Log table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No hay registros para los filtros seleccionados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Fecha / Hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acción</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Tienda</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map(e => (
                  <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {formatSafeDate(e.created_at, 'dd/MM/yy HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', CAT_BADGE[e.category] || 'bg-muted text-muted-foreground')}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{e.action}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[280px] truncate" title={e.detail}>{e.detail}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {e.store
                        ? e.store.replace('Tienda ', '')
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{e.user_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} registros
                {filtered.length >= 500 && <span className="ml-1 italic">(máx. 500 — ajusta los filtros de fecha si necesitas más antiguos)</span>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…')
                      acc.push(p)
                      return acc
                    }, [])
                    .map((p, idx) =>
                      p === '…' ? (
                        <span key={`d${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                      ) : (
                        <button key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={cn(
                            'h-7 min-w-[28px] px-2 text-xs rounded-md border',
                            currentPage === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
