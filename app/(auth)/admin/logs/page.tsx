'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatSafeDate } from '@/lib/utils/date'
import { RefreshCw, Loader2, ShoppingCart, DollarSign, Package, Phone, Filter, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

type Category = 'all' | 'ventas' | 'cobros' | 'inventario' | 'cobranzas'
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
  all:        { label: 'Todo',       icon: Filter,      color: 'text-gray-600' },
  ventas:     { label: 'Ventas',     icon: ShoppingCart, color: 'text-blue-600' },
  cobros:     { label: 'Cobros',     icon: DollarSign,  color: 'text-green-600' },
  inventario: { label: 'Inventario', icon: Package,     color: 'text-orange-600' },
  cobranzas:  { label: 'Cobranzas', icon: Phone,       color: 'text-purple-600' },
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
}

export default function AdminLogsPage() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category>('all')
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ category, limit: '300' })
      if (userId) params.set('user_id', userId)
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
  }, [category, userId])

  useEffect(() => { load() }, [load])

  const filtered = entries.filter(e =>
    !search ||
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.detail.toLowerCase().includes(search.toLowerCase()) ||
    e.user_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.store || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Logs del Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Historial completo de acciones registradas en el ERP</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
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
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar acción, detalle, usuario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* User filter */}
          <select
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos los usuarios</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['venta','cobro','inventario','cobranza'] as const).map(cat => {
          const count = filtered.filter(e => e.category === cat).length
          const labels: Record<string, string> = { venta: 'Ventas', cobro: 'Cobros', inventario: 'Movimientos', cobranza: 'Cobranzas' }
          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{labels[cat]}</div>
            </div>
          )
        })}
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No hay registros para los filtros seleccionados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fecha / Hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Tienda</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                      {formatSafeDate(e.created_at, 'dd/MM/yy HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', CAT_BADGE[e.category] || 'bg-gray-100 text-gray-600')}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{e.action}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[280px] truncate" title={e.detail}>{e.detail}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {e.store
                        ? e.store.replace('Tienda ', '')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{e.user_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              {filtered.length} registros mostrados
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
