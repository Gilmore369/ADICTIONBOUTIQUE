'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClientFilters } from './client-filters'
import { ClientsTableEnhanced } from './clients-table-enhanced'
import { CreateClientDialog } from './create-client-dialog'
import { filterClientsAction } from '@/actions/clients'
import { exportFilteredClients } from '@/actions/export'
import { toast } from '@/lib/toast'
import type { ClientFilters as ClientFiltersType } from '@/lib/types/crm'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ChevronLeft, ChevronRight, Cake } from 'lucide-react'

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
}

interface ClientsListViewProps {
  initialClients: Client[]
}

export function ClientsListView({ initialClients }: ClientsListViewProps) {
  const searchParams = useSearchParams()
  const isBirthdayFilter = searchParams.get('filter') === 'birthday'
  const currentMonth = new Date().getMonth() + 1

  const [clients, setClients] = useState<Client[]>(initialClients)
  const [filters, setFilters] = useState<ClientFiltersType>(
    isBirthdayFilter
      ? { status: 'ACTIVO', birthdayMonth: currentMonth }
      : { status: 'ACTIVO' }
  )
  const [isLoading, setIsLoading] = useState(false)
  const [showOnlyBlacklisted, setShowOnlyBlacklisted] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const blacklistedCount = useMemo(() => clients.filter(c => c.blacklisted).length, [clients])

  // Filter clients based on current filters
  const filteredClients = useMemo(() => {
    if (Object.keys(filters).length === 0) {
      return clients
    }

    return clients.filter(client => {
      // Debt status filter
      if (filters.debtStatus) {
        if (filters.debtStatus === 'MOROSO') {
          // Would need to check for overdue installments - simplified for now
          if (client.credit_used === 0) return false
        } else if (filters.debtStatus === 'CON_DEUDA') {
          if (client.credit_used === 0) return false
        } else if (filters.debtStatus === 'AL_DIA') {
          if (client.credit_used === 0) return false
          // Would need to check no overdue installments
        }
      }

      // Rating filter
      if (filters.rating && filters.rating.length > 0) {
        if (!client.rating || !filters.rating.includes(client.rating)) {
          return false
        }
      }

      // Days since last purchase filter
      if (filters.daysSinceLastPurchase) {
        if (!client.last_purchase_date) return false
        const daysSince = Math.floor(
          (Date.now() - new Date(client.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSince <= filters.daysSinceLastPurchase) return false
      }

      // Birthday month filter
      if (filters.birthdayMonth) {
        if (!client.birthday) return false
        const bMonth = new Date(client.birthday).getUTCMonth() + 1
        if (bMonth !== filters.birthdayMonth) return false
      }

      // Status filter
      if (filters.status) {
        if (filters.status === 'ACTIVO' && !client.active) return false
        if (filters.status === 'INACTIVO' && client.active) return false
        if (filters.status === 'BAJA' && client.active) return false
      }

      // Deactivation reason filter
      if (filters.deactivationReason && filters.deactivationReason.length > 0) {
        if (!client.deactivation_reason || !filters.deactivationReason.includes(client.deactivation_reason)) {
          return false
        }
      }

        // Blacklist quick filter
      if (showOnlyBlacklisted && !client.blacklisted) return false

      return true
    })
  }, [clients, filters, showOnlyBlacklisted])

  // Paginated slice of filteredClients
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const paginatedClients = useMemo(
    () => filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredClients, currentPage]
  )

  const handleFilterChange = useCallback(async (newFilters: ClientFiltersType) => {
    setFilters(newFilters)
    setCurrentPage(1) // reset to page 1 on filter change

    // If filters are applied, fetch filtered clients from server
    if (Object.keys(newFilters).length > 0) {
      setIsLoading(true)
      try {
        const result = await filterClientsAction(newFilters)
        if (result.success && result.data) {
          setClients(result.data)
        } else {
          throw new Error(result.error || 'Error al filtrar clientes')
        }
      } catch (error) {
        console.error('Error filtering clients:', error)
        toast.error('Error', 'No se pudieron filtrar los clientes')
      } finally {
        setIsLoading(false)
      }
    }
  }, [])

  const handleExport = async () => {
    try {
      toast.info('Exportando', 'Generando archivo CSV...')
      const result = await exportFilteredClients(filters)
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al exportar')
      }
      
      // Create download link
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
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
    // Add the new client to the top of the list with minimal data
    setClients(prev => [{
      id: newClient.id,
      dni: newClient.dni ?? null,
      name: newClient.name,
      phone: null,
      rating: null,
      rating_score: null,
      last_purchase_date: null,
      credit_used: 0,
      active: true,
      deactivation_reason: null,
      blacklisted: false,
    }, ...prev])
  }

  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
            {filteredClients.length} resultado{filteredClients.length !== 1 ? 's' : ''}
          </span>
          {blacklistedCount > 0 && (
            <Button
              variant={showOnlyBlacklisted ? 'destructive' : 'outline'}
              size="sm"
              className="gap-1 h-7 text-xs"
              onClick={() => { setShowOnlyBlacklisted(v => !v); setCurrentPage(1) }}
            >
              <AlertTriangle className="h-3 w-3" />
              Lista Negra ({blacklistedCount})
            </Button>
          )}
        </div>
        <CreateClientDialog onSuccess={handleClientCreated} />
      </div>

      <ClientFilters onFilterChange={handleFilterChange} />

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando clientes...</p>
        </div>
      ) : (
        <>
          <ClientsTableEnhanced
            clients={paginatedClients}
            onExport={handleExport}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · {filteredClients.length} clientes
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
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
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === totalPages}
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
