'use client'

import { useState, useCallback, useMemo } from 'react'
import { ClientFilters } from './client-filters'
import { ClientsTableEnhanced } from './clients-table-enhanced'
import { CreateClientDialog } from './create-client-dialog'
import { filterClientsAction } from '@/actions/clients'
import { exportFilteredClients } from '@/actions/export'
import { toast } from '@/lib/toast'
import type { ClientFilters as ClientFiltersType } from '@/lib/types/crm'

interface Client {
  id: string
  dni: string | null
  name: string
  phone: string | null
  rating: 'A' | 'B' | 'C' | 'D' | null
  rating_score: number | null
  last_purchase_date: string | null
  credit_used: number
  active: boolean
  deactivation_reason: string | null
}

interface ClientsListViewProps {
  initialClients: Client[]
}

export function ClientsListView({ initialClients }: ClientsListViewProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [filters, setFilters] = useState<ClientFiltersType>({})
  const [isLoading, setIsLoading] = useState(false)

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
        // Would need birthday field on client
        // Skipping for now
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

      return true
    })
  }, [clients, filters])

  const handleFilterChange = useCallback(async (newFilters: ClientFiltersType) => {
    setFilters(newFilters)
    
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
    }, ...prev])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona y filtra tu cartera de clientes
          </p>
        </div>
        <CreateClientDialog onSuccess={handleClientCreated} />
      </div>

      <ClientFilters onFilterChange={handleFilterChange} />

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando clientes...</p>
        </div>
      ) : (
        <ClientsTableEnhanced 
          clients={filteredClients} 
          onExport={handleExport}
        />
      )}
    </div>
  )
}
