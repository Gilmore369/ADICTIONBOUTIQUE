'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ban, Download, Search, Calendar, DollarSign, ShoppingCart, TrendingUp, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils/currency'
import { useStore } from '@/contexts/store-context'
import { formatSafeDate } from '@/lib/utils/date'
import { toast } from 'sonner'
import { voidSale } from '@/actions/sales'

interface SaleItem {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: {
    name: string
  } | null
}

interface Sale {
  id: string
  sale_number: string
  created_at: string
  sale_type: 'CONTADO' | 'CREDITO'
  subtotal: number
  discount: number
  total: number
  returned_total?: number
  net_total?: number
  store_id: string
  voided: boolean
  clients: {
    id: string
    name: string
    dni: string | null
  } | null
  sale_items: SaleItem[]
}

interface SalesHistoryViewProps {
  initialSales: Sale[]
  lockedStore?: string | null
  initialPeriod?: 'TODAY' | 'WEEK' | 'MONTH' | '3MONTHS' | '6MONTHS' | '12MONTHS' | 'YEAR' | 'LASTYEAR' | 'ALL' | 'CUSTOM'
}

type PeriodKey = 'TODAY' | 'WEEK' | 'MONTH' | '3MONTHS' | '6MONTHS' | '12MONTHS' | 'YEAR' | 'LASTYEAR' | 'ALL' | 'CUSTOM'

const STORE_CTX_MAP: Record<string, 'ALL' | 'Tienda Mujeres' | 'Tienda Hombres'> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
  ALL: 'ALL',
}

export function SalesHistoryView({ initialSales, lockedStore, initialPeriod = 'ALL' }: SalesHistoryViewProps) {
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'CONTADO' | 'CREDITO'>('ALL')
  const [filterStore, setFilterStore] = useState<'ALL' | 'Tienda Mujeres' | 'Tienda Hombres'>(
    (lockedStore as any) || 'ALL'
  )
  const [filterPeriod, setFilterPeriod] = useState<PeriodKey>(initialPeriod as PeriodKey)
  // Custom date range (used when filterPeriod === 'CUSTOM')
  const todayStr = new Date().toISOString().slice(0, 10)
  const monthStartStr = `${todayStr.slice(0, 7)}-01`
  const [customFrom, setCustomFrom] = useState(monthStartStr)
  const [customTo, setCustomTo] = useState(todayStr)
  const debouncedFrom = useDebounce(customFrom, 400)
  const debouncedTo = useDebounce(customTo, 400)
  // Aggregated stats from server (full filtered range, NOT just current page)
  const [serverStats, setServerStats] = useState<{
    total: number; contado: number; credito: number;
    count: number; contado_count: number; credito_count: number; avg: number
  }>({ total: 0, contado: 0, credito: 0, count: 0, contado_count: 0, credito_count: 0, avg: 0 })
  const [showVoided, setShowVoided] = useState(false)
  const [voidingId, setVoidingId] = useState<string | null>(null)

  // Server-side pagination state
  const PAGE_SIZE = 50
  const [currentPage, setCurrentPage] = useState(1)
  const [serverTotal, setServerTotal] = useState(0)
  const [serverPages, setServerPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Sincronizar con el selector global de tienda del header
  const { selectedStore } = useStore()
  useEffect(() => {
    if (!lockedStore) {
      setFilterStore(STORE_CTX_MAP[selectedStore] ?? 'ALL')
    }
  }, [selectedStore, lockedStore])

  // Fetch paginated sales from API
  const fetchSales = useCallback(async (
    page: number, search: string, period: string, store: string,
    from?: string, to?: string,
  ) => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE), period })
      if (search) qs.set('search', search)
      if (store && store !== 'ALL') qs.set('store', store)
      if (period === 'CUSTOM') {
        if (from) qs.set('from', from)
        if (to)   qs.set('to',   to)
      }
      const res = await fetch(`/api/sales/paginated?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar ventas')
      setSales(json.sales || [])
      setServerTotal(json.total ?? 0)
      setServerPages(json.total_pages ?? 1)
      if (json.stats) setServerStats(json.stats)
    } catch (err) {
      console.error('[SalesHistoryView] fetch error:', err)
      toast.error('Error al cargar ventas')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Trigger fetch when page / search / period / store / custom range changes
  useEffect(() => {
    fetchSales(currentPage, debouncedSearch, filterPeriod, filterStore, debouncedFrom, debouncedTo)
  }, [fetchSales, currentPage, debouncedSearch, filterPeriod, filterStore, debouncedFrom, debouncedTo])

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1) }, [debouncedSearch, filterPeriod, filterStore, debouncedFrom, debouncedTo])

  const getSaleNetTotal = (sale: Sale) => {
    if (typeof sale.net_total === 'number') return sale.net_total
    const returnedTotal = Number(sale.returned_total || 0)
    return Math.max(0, Math.round((Number(sale.total || 0) - returnedTotal) * 100) / 100)
  }

  // Calculate metrics — always based on filteredSales so cards react to filters
  // (filteredSales defined below, but metrics is computed lazily via useMemo deps)
  const computeMetrics = (data: Sale[]) => {
    const total = data.reduce((s, x) => s + getSaleNetTotal(x), 0)
    const contadoSales = data.filter(s => s.sale_type === 'CONTADO')
    const creditoSales = data.filter(s => s.sale_type === 'CREDITO')
    const contadoTotal = contadoSales.reduce((s, x) => s + getSaleNetTotal(x), 0)
    const creditoTotal = creditoSales.reduce((s, x) => s + getSaleNetTotal(x), 0)
    return {
      total,
      count: data.length,
      contadoTotal,
      contadoCount: contadoSales.length,
      creditoTotal,
      creditoCount: creditoSales.length,
      avgTicket: data.length > 0 ? total / data.length : 0,
      contadoPct: total > 0 ? (contadoTotal / total) * 100 : 0,
      creditoPct: total > 0 ? (creditoTotal / total) * 100 : 0,
    }
  }

  // Handler para anular venta
  const handleVoidSale = async (sale: Sale) => {
    if (!confirm(`¿Anular la venta ${sale.sale_number}? Esta acción no se puede deshacer.`)) return
    setVoidingId(sale.id)
    try {
      const result = await voidSale(sale.id)
      if (result.success) {
        setSales(prev => prev.map(s => s.id === sale.id ? { ...s, voided: true } : s))
        toast.success('Venta anulada', `${sale.sale_number} marcada como anulada`)
      } else {
        toast.error('Error al anular', typeof result.error === 'string' ? result.error : 'Error desconocido')
      }
    } catch {
      toast.error('Error inesperado al anular la venta')
    } finally {
      setVoidingId(null)
    }
  }

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Anuladas filter
      if (!showVoided && sale.voided) return false

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesNumber = sale.sale_number.toLowerCase().includes(term)
        const matchesClient = sale.clients?.name.toLowerCase().includes(term)
        if (!matchesNumber && !matchesClient) return false
      }

      // Type filter
      if (filterType !== 'ALL' && sale.sale_type !== filterType) return false

      // Store filter
      if (filterStore !== 'ALL' && sale.store_id !== filterStore) return false

      // Period filter
      if (filterPeriod !== 'ALL') {
        const saleDate = new Date(sale.created_at)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        if (filterPeriod === 'TODAY') {
          if (saleDate < today) return false
        } else if (filterPeriod === 'WEEK') {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          if (saleDate < weekAgo) return false
        } else if (filterPeriod === 'MONTH') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          if (saleDate < monthStart) return false
        } else if (filterPeriod === '3MONTHS') {
          const cutoff = new Date(today)
          cutoff.setMonth(cutoff.getMonth() - 3)
          if (saleDate < cutoff) return false
        } else if (filterPeriod === '6MONTHS') {
          const cutoff = new Date(today)
          cutoff.setMonth(cutoff.getMonth() - 6)
          if (saleDate < cutoff) return false
        } else if (filterPeriod === '12MONTHS') {
          const cutoff = new Date(today)
          cutoff.setFullYear(cutoff.getFullYear() - 1)
          if (saleDate < cutoff) return false
        }
      }

      return true
    })
  }, [sales, searchTerm, filterType, filterStore, filterPeriod, showVoided])

  // Metrics: usar los stats agregados del servidor (filtro completo, no solo la página)
  // computeMetrics(filteredSales) sólo aporta los counts/pct sobre la página visible
  const metrics = useMemo(() => {
    const total = serverStats.total
    const contadoPct = total > 0 ? (serverStats.contado / total) * 100 : 0
    const creditoPct = total > 0 ? (serverStats.credito / total) * 100 : 0
    return {
      total,
      count: serverStats.count,
      contadoTotal: serverStats.contado,
      contadoCount: serverStats.contado_count,
      creditoTotal: serverStats.credito,
      creditoCount: serverStats.credito_count,
      avgTicket: serverStats.avg,
      contadoPct,
      creditoPct,
    }
  }, [serverStats])

  const handleDownloadPDF = async (sale: Sale) => {
    try {
      toast.info('Descargando PDF...', 'Por favor espera')
      
      // Crear enlace temporal con download attribute
      const link = document.createElement('a')
      link.href = `/api/sales/${sale.sale_number}/pdf`
      link.download = `Ticket_${sale.sale_number}.pdf`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      
      // Agregar al DOM temporalmente
      document.body.appendChild(link)
      
      // Simular click
      link.click()
      
      // Remover después de un momento
      setTimeout(() => {
        document.body.removeChild(link)
      }, 100)
      
      toast.success('PDF descargado', `Ticket_${sale.sale_number}.pdf`)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.error('Error al descargar PDF')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Historial de Ventas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consulta y descarga tickets de todas las ventas realizadas
        </p>
      </div>

      {/* Dashboard - Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas Hoy */}
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-emerald-600">TOTAL</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">{metrics.count.toLocaleString()} ventas en el rango filtrado</p>
        </Card>

        {/* Contado */}
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600">CONTADO</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.contadoTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{metrics.contadoCount.toLocaleString()} ventas · {metrics.contadoPct.toFixed(0)}% del total</p>
        </Card>

        {/* Crédito */}
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600">CRÉDITO</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.creditoTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{metrics.creditoCount.toLocaleString()} ventas · {metrics.creditoPct.toFixed(0)}% del total</p>
        </Card>

        {/* Ticket Promedio */}
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-amber-600">TICKET PROM.</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.avgTicket)}</p>
          <p className="text-xs text-muted-foreground mt-1">{metrics.count.toLocaleString()} ventas en el rango filtrado</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder="Buscar por ticket o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Period Filter */}
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as PeriodKey)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="ALL">Todas las fechas (2009→hoy)</option>
            <option value="TODAY">Hoy</option>
            <option value="WEEK">Última semana</option>
            <option value="MONTH">Último mes</option>
            <option value="3MONTHS">Últimos 3 meses</option>
            <option value="6MONTHS">Últimos 6 meses</option>
            <option value="12MONTHS">Último año (móvil)</option>
            <option value="YEAR">Este año ({new Date().getFullYear()})</option>
            <option value="LASTYEAR">Año pasado ({new Date().getFullYear() - 1})</option>
            <option value="CUSTOM">Personalizado…</option>
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </select>

          {/* Store Filter — hidden when user is restricted to one store */}
          {!lockedStore ? (
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value as any)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="ALL">Todas las tiendas</option>
              <option value="Tienda Mujeres">Tienda Mujeres</option>
              <option value="Tienda Hombres">Tienda Hombres</option>
            </select>
          ) : (
            <span className="px-3 py-2 border rounded-lg text-sm bg-muted text-muted-foreground">
              {lockedStore}
            </span>
          )}
        </div>

        {/* Date range — only when CUSTOM */}
        {filterPeriod === 'CUSTOM' && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm text-muted-foreground">Desde:</label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-9 px-2 border rounded-lg text-sm bg-background"
            />
            <span className="text-muted-foreground">→</span>
            <label className="text-sm text-muted-foreground">Hasta:</label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-9 px-2 border rounded-lg text-sm bg-background"
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground flex-wrap">
          <span>
            {isLoading ? 'Cargando…' : `Mostrando ${filteredSales.length} de ${serverTotal.toLocaleString()} ventas`}
            {serverPages > 1 && ` (página ${currentPage}/${serverPages})`}
          </span>
          <div className="flex items-center gap-3">
            {/* Toggle anuladas */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                role="switch"
                aria-checked={showVoided}
                onClick={() => setShowVoided(v => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors ${showVoided ? 'bg-rose-500' : 'bg-muted-foreground/30'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${showVoided ? 'translate-x-4' : ''}`} />
              </div>
              <span className={showVoided ? 'text-rose-600 font-medium' : ''}>Ver anuladas</span>
            </label>
            {(searchTerm || filterType !== 'ALL' || filterStore !== 'ALL' || filterPeriod !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setFilterType('ALL')
                  setFilterStore((lockedStore as any) || 'ALL')
                  setFilterPeriod('ALL')
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Sales Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tienda</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No se encontraron ventas
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className={`hover:bg-muted/40 transition-colors ${sale.voided ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm font-mono font-medium">
                      <div className="flex items-center gap-2">
                        <span className={sale.voided ? 'line-through text-muted-foreground' : 'text-foreground'}>
                          {sale.sale_number}
                        </span>
                        {sale.voided && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <Ban className="h-2.5 w-2.5" />
                            ANULADA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatSafeDate(sale.created_at, 'dd/MM/yyyy HH:mm', '-')}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {sale.clients?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        sale.sale_type === 'CONTADO'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                      }`}>
                        {sale.sale_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sale.store_id}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-foreground">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={sale.voided ? 'line-through text-muted-foreground' : ''}>
                          {formatCurrency(getSaleNetTotal(sale))}
                        </span>
                        {Number(sale.returned_total || 0) > 0 && !sale.voided && (
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Venta {formatCurrency(sale.total)} - dev. {formatCurrency(Number(sale.returned_total || 0))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(sale)}
                          className="gap-1.5 text-xs"
                          disabled={sale.voided}
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                        {!sale.voided && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVoidSale(sale)}
                            disabled={voidingId === sale.id}
                            className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            {voidingId === sale.id ? '...' : 'Anular'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {serverPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {serverPages} · {serverTotal.toLocaleString()} ventas
            {isLoading && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={currentPage === 1 || isLoading}
              onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            {Array.from({ length: serverPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === serverPages || Math.abs(p - currentPage) <= 2)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button key={p}
                    variant={currentPage === p ? 'default' : 'outline'}
                    size="sm" className="h-7 min-w-[28px] px-2 text-xs"
                    disabled={isLoading}
                    onClick={() => setCurrentPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={currentPage === serverPages || isLoading}
              onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
