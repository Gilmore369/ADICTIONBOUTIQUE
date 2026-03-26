'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Search, Calendar, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { useStore } from '@/contexts/store-context'
import { formatSafeDate } from '@/lib/utils/date'
import { toast } from 'sonner'

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
}

const STORE_CTX_MAP: Record<string, 'ALL' | 'Tienda Mujeres' | 'Tienda Hombres'> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
  ALL: 'ALL',
}

export function SalesHistoryView({ initialSales, lockedStore }: SalesHistoryViewProps) {
  const [sales] = useState<Sale[]>(initialSales)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'CONTADO' | 'CREDITO'>('ALL')
  const [filterStore, setFilterStore] = useState<'ALL' | 'Tienda Mujeres' | 'Tienda Hombres'>(
    (lockedStore as any) || 'ALL'
  )
  const [filterPeriod, setFilterPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL')

  // Sincronizar con el selector global de tienda del header
  const { selectedStore } = useStore()
  useEffect(() => {
    if (!lockedStore) {
      setFilterStore(STORE_CTX_MAP[selectedStore] ?? 'ALL')
    }
  }, [selectedStore, lockedStore])

  // Calculate metrics
  const metrics = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const todaySales = sales.filter(s => new Date(s.created_at) >= today)
    const monthSales = sales.filter(s => new Date(s.created_at) >= monthStart)
    
    const contadoTotal = sales.filter(s => s.sale_type === 'CONTADO').reduce((sum, s) => sum + s.total, 0)
    const creditoTotal = sales.filter(s => s.sale_type === 'CREDITO').reduce((sum, s) => sum + s.total, 0)
    
    const totalAmount = sales.reduce((sum, s) => sum + s.total, 0)
    const avgTicket = sales.length > 0 ? totalAmount / sales.length : 0

    return {
      todayTotal: todaySales.reduce((sum, s) => sum + s.total, 0),
      todayCount: todaySales.length,
      monthTotal: monthSales.reduce((sum, s) => sum + s.total, 0),
      monthCount: monthSales.length,
      contadoTotal,
      creditoTotal,
      contadoPercent: totalAmount > 0 ? (contadoTotal / totalAmount) * 100 : 0,
      avgTicket,
      totalCount: sales.length
    }
  }, [sales])

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
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
        }
      }

      return true
    })
  }, [sales, searchTerm, filterType, filterStore, filterPeriod])

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
        <h1 className="text-2xl font-semibold text-gray-900">Historial de Ventas</h1>
        <p className="text-sm text-gray-600 mt-1">
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
            <span className="text-xs font-medium text-emerald-600">HOY</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.todayTotal)}</p>
          <p className="text-xs text-gray-600 mt-1">{metrics.todayCount} ventas</p>
        </Card>

        {/* Ventas del Mes */}
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600">MES</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.monthTotal)}</p>
          <p className="text-xs text-gray-600 mt-1">{metrics.monthCount} ventas</p>
        </Card>

        {/* Ticket Promedio */}
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600">PROMEDIO</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.avgTicket)}</p>
          <p className="text-xs text-gray-600 mt-1">por venta</p>
        </Card>

        {/* Contado vs Crédito */}
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-amber-600">CONTADO</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.contadoPercent.toFixed(0)}%</p>
          <p className="text-xs text-gray-600 mt-1">{formatCurrency(metrics.contadoTotal)} de {formatCurrency(metrics.contadoTotal + metrics.creditoTotal)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
            onChange={(e) => setFilterPeriod(e.target.value as any)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="ALL">Todas las fechas</option>
            <option value="TODAY">Hoy</option>
            <option value="WEEK">Última semana</option>
            <option value="MONTH">Este mes</option>
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

        <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
          <span>Mostrando {filteredSales.length} de {sales.length} ventas</span>
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
      </Card>

      {/* Sales Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tienda</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    No se encontraron ventas
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {sale.sale_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatSafeDate(sale.created_at, 'dd/MM/yyyy HH:mm', '-')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {sale.clients?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        sale.sale_type === 'CONTADO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {sale.sale_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {sale.store_id}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadPDF(sale)}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
