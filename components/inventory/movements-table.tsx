'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'
import { useDebounce } from '@/hooks/use-debounce'

interface Movement {
  id: string
  product_id: string
  warehouse_id: string
  type: string
  quantity: number
  reason?: string
  reference?: string
  notes?: string
  created_at: string
  products?: {
    name: string
    barcode: string
  }
}

interface MovementsTableProps {
  data: Movement[]
  singleStore?: string   // When set, hides store filter buttons and "Tienda" column
}

type SortField = 'fecha' | 'tipo' | 'producto' | 'tienda' | 'cantidad' | 'motivo'
type SortOrder = 'asc' | 'desc'

type StoreFilter = 'all' | 'Tienda Mujeres' | 'Tienda Hombres'

export function MovementsTable({ data: initialData, singleStore: initialSingleStore }: MovementsTableProps) {
  const [sortField, setSortField] = useState<SortField>('fecha')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all')
  const [singleStore, setSingleStore] = useState<string | undefined>(initialSingleStore)

  // Server-side pagination
  const PAGE_SIZE = 50
  const [data, setData] = useState<Movement[]>(initialData)
  const [currentPage, setCurrentPage] = useState(1)
  const [serverTotal, setServerTotal] = useState(0)
  const [serverPages, setServerPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  // Filtro de fechas (rango)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const debouncedFrom = useDebounce(dateFrom, 400)
  const debouncedTo = useDebounce(dateTo, 400)

  const fetchMovements = useCallback(async (
    page: number, search: string, from: string, to: string,
  ) => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) })
      if (search) qs.set('search', search)
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const res = await fetch(`/api/inventory/movements/paginated?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar movimientos')
      setData(json.movements || [])
      setServerTotal(json.total ?? 0)
      setServerPages(json.total_pages ?? 1)
      if (json.single_store) setSingleStore(json.single_store)
    } catch (err) {
      console.error('[MovementsTable] fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMovements(currentPage, debouncedSearch, debouncedFrom, debouncedTo)
  }, [fetchMovements, currentPage, debouncedSearch, debouncedFrom, debouncedTo])
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, debouncedFrom, debouncedTo])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const filteredData = storeFilter === 'all'
    ? data
    : data.filter(m => m.warehouse_id.toLowerCase() === storeFilter.toLowerCase())

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'fecha':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      case 'tipo':
        aValue = a.type
        bValue = b.type
        break
      case 'producto':
        aValue = a.products?.name || ''
        bValue = b.products?.name || ''
        break
      case 'tienda':
        aValue = a.warehouse_id
        bValue = b.warehouse_id
        break
      case 'cantidad':
        aValue = Math.abs(a.quantity)
        bValue = Math.abs(b.quantity)
        break
      case 'motivo':
        aValue = a.reason || a.reference || a.notes || ''
        bValue = b.reason || b.reference || b.notes || ''
        break
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    )
  }

  const storeOptions: { value: StoreFilter; label: string }[] = [
    { value: 'all',              label: 'Ambas tiendas' },
    { value: 'Tienda Mujeres',   label: 'Tienda Mujeres' },
    { value: 'Tienda Hombres',   label: 'Tienda Hombres' },
  ]

  return (
    <Card className="p-4 space-y-4">
      {/* Search + date range + count */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto o código de barras…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Desde:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 text-sm w-[140px]"
          />
          <span className="text-xs text-muted-foreground">Hasta:</span>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 text-sm w-[140px]"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              limpiar
            </button>
          )}
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {isLoading ? 'Cargando…' : `${serverTotal.toLocaleString()} movimientos`}
          {isLoading && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
        </span>
      </div>

      {/* Store filter — hidden for single-store users */}
      {!singleStore && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground font-medium">Tienda:</span>
          <div className="flex gap-1">
            {storeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStoreFilter(opt.value)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  storeFilter === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {storeFilter !== 'all' && (
            <span className="text-xs text-muted-foreground ml-1">
              {filteredData.length} movimiento{filteredData.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('fecha')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Fecha
                  <SortIcon field="fecha" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('tipo')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Tipo
                  <SortIcon field="tipo" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('producto')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Producto
                  <SortIcon field="producto" />
                </Button>
              </TableHead>
              {!singleStore && (
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('tienda')}
                    className="gap-2 h-auto p-0 hover:bg-transparent"
                  >
                    Tienda
                    <SortIcon field="tienda" />
                  </Button>
                </TableHead>
              )}
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('cantidad')}
                  className="gap-2 h-auto p-0 hover:bg-transparent ml-auto"
                >
                  Cantidad
                  <SortIcon field="cantidad" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('motivo')}
                  className="gap-2 h-auto p-0 hover:bg-transparent"
                >
                  Motivo
                  <SortIcon field="motivo" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={singleStore ? 5 : 6} className="text-center text-muted-foreground py-8">
                  No hay movimientos para la tienda seleccionada
                </TableCell>
              </TableRow>
            )}
            {sortedData.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="text-sm">
                  {formatSafeDate(movement.created_at, 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  {movement.type === 'IN' || movement.type === 'ENTRADA' ? (
                    <Badge variant="default" className="gap-1">
                      <ArrowDown className="h-3 w-3" />
                      Entrada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <ArrowUp className="h-3 w-3" />
                      Salida
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{movement.products?.name}</div>
                    <div className="text-xs text-muted-foreground">{movement.products?.barcode}</div>
                  </div>
                </TableCell>
                {!singleStore && <TableCell>{movement.warehouse_id}</TableCell>}
                <TableCell className="text-right font-semibold">
                  {movement.type === 'IN' || movement.type === 'ENTRADA' ? '+' : ''}{Math.abs(movement.quantity)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {movement.reason || movement.reference || movement.notes || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {serverPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {serverPages} · {serverTotal.toLocaleString()} movimientos
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
    </Card>
  )
}
