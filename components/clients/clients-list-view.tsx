'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClientFilters } from './client-filters'
import { ClientsTableEnhanced } from './clients-table-enhanced'
import { CreateClientDialog } from './create-client-dialog'
import { exportFilteredClients } from '@/actions/export'
import { toast } from '@/lib/toast'
import type { ClientFilters as ClientFiltersType } from '@/lib/types/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, ChevronLeft, ChevronRight, Cake, Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

const PAGE_SIZE = 50

interface Client {
  id: string
  dni: string | null
  name: string
  phone: string | null
  rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | null
  rating_score: number | null
  last_purchase_date: string | null
  credit_used: number
  active: boolean
  deactivation_reason: string | null
  blacklisted?: boolean | null
  birthday?: string | null
  imported_from_legacy?: boolean | null
}

/** No props — all data fetched from /api/clients/paginated */
export function ClientsListView() {
  const searchParams   = useSearchParams()
  const isBirthdayFilter = searchParams.get('filter') === 'birthday'
  const currentMonth   = new Date().getMonth() + 1

  const [clients,      setClients]      = useState<Client[]>([])
  const [serverTotal,  setServerTotal]  = useState(0)
  const [serverPages,  setServerPages]  = useState(1)
  const [blTotal,      setBlTotal]      = useState<number | null>(null)
  const [isLoading,    setIsLoading]    = useState(true)
  const [currentPage,  setCurrentPage]  = useState(1)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [showOnlyBlacklisted, setShowOnlyBlacklisted] = useState(false)
  const [filters,      setFilters]      = useState<ClientFiltersType>(
    isBirthdayFilter
      ? { status: 'ACTIVO', birthdayMonth: currentMonth }
      : { status: 'ACTIVO' }
  )

  const debouncedSearch = useDebounce(searchQuery, 300)

  // ── Fetch page from server ───────────────────────────────────────────────
  const fetchClients = useCallback(async (
    page: number,
    search: string,
    f: ClientFiltersType,
    blacklistedOnly: boolean
  ) => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) })
      if (search)            qs.set('search', search)
      if (f.status)          qs.set('status', f.status)
      if (f.rating?.length)  qs.set('rating', f.rating.join(','))
      if (f.debtStatus)      qs.set('debt_status', f.debtStatus)
      if (f.birthdayMonth)   qs.set('birthday_month', String(f.birthdayMonth))
      if (f.daysSinceLastPurchase) qs.set('days_since', String(f.daysSinceLastPurchase))
      if (blacklistedOnly)   qs.set('blacklisted', 'true')

      const res  = await fetch(`/api/clients/paginated?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar clientes')

      setClients(json.clients || [])
      setServerTotal(json.total ?? 0)
      setServerPages(json.pages ?? 1)
      if (json.blacklisted_total !== null && json.blacklisted_total !== undefined) {
        setBlTotal(json.blacklisted_total)
      }
    } catch (err) {
      console.error('[ClientsListView] fetch error:', err)
      toast.error('Error', 'No se pudieron cargar los clientes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Re-fetch whenever page / search / filters / blacklisted toggle change
  useEffect(() => {
    fetchClients(currentPage, debouncedSearch, filters, showOnlyBlacklisted)
  }, [fetchClients, currentPage, debouncedSearch, filters, showOnlyBlacklisted])

  // Reset to page 1 when search or filters change
  useEffect(() => { setCurrentPage(1) }, [debouncedSearch, filters, showOnlyBlacklisted])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFilterChange = useCallback((newFilters: ClientFiltersType) => {
    setFilters(newFilters)
    // page reset is handled by the effect above
  }, [])

  const handleExport = async () => {
    try {
      toast.info('Exportando', 'Generando archivo CSV...')
      const result = await exportFilteredClients(filters)
      if (!result.success || !result.data) throw new Error(result.error || 'Error al exportar')
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url  = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `clientes-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Exportado', 'Archivo CSV descargado correctamente')
    } catch (error) {
      console.error('Error exporting clients:', error)
      toast.error('Error', 'No se pudo exportar el archivo CSV')
    }
  }

  const handleClientCreated = (newClient: { id: string; name: string; dni?: string | null }) => {
    // Refresh page 1 to show the new client
    setCurrentPage(1)
    fetchClients(1, debouncedSearch, filters, showOnlyBlacklisted)
  }

  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const blacklistedCount = blTotal ?? 0

  return (
    <div className="space-y-4">
      {/* Birthday filter banner */}
      {isBirthdayFilter && (
        <div className="flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-xl px-4 py-2.5 text-sm text-pink-700">
          <Cake className="h-4 w-4 flex-shrink-0" />
          <span>Mostrando clientes con cumpleaños en <strong>{MONTH_NAMES[currentMonth - 1]}</strong></span>
          <button
            onClick={() => window.history.pushState({}, '', '/clients')}
            className="ml-auto text-pink-400 hover:text-pink-700 text-xs underline"
          >Quitar filtro</button>
        </div>
      )}

      {/* Compact header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Clientes</h1>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {isLoading ? '…' : `${serverTotal} resultado${serverTotal !== 1 ? 's' : ''}`}
          </span>
          {blacklistedCount > 0 && (
            <Button
              variant={showOnlyBlacklisted ? 'destructive' : 'outline'}
              size="sm"
              className="gap-1 h-7 text-xs"
              onClick={() => setShowOnlyBlacklisted(v => !v)}
            >
              <AlertTriangle className="h-3 w-3" />
              Lista Negra ({blacklistedCount})
            </Button>
          )}
        </div>
        <CreateClientDialog onSuccess={handleClientCreated} />
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre, DNI o teléfono..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ClientFilters onFilterChange={handleFilterChange} />

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Cargando clientes…</p>
        </div>
      ) : (
        <>
          <ClientsTableEnhanced
            clients={clients}
            onExport={handleExport}
          />

          {/* Pagination */}
          {serverPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {serverPages} · {serverTotal} clientes
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
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
                      <Button
                        key={p}
                        variant={currentPage === p ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 min-w-[28px] px-2 text-xs"
                        onClick={() => setCurrentPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}

                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentPage === serverPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
