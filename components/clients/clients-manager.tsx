/**
 * ClientsManager Component
 * 
 * Main component for managing clients catalog. Integrates ClientsTable, 
 * ClientSearch, and ClientForm in a dialog for create/edit operations.
 * 
 * Features:
 * - Display clients in table with credit information
 * - Search clients with debouncing
 * - Create new clients via dialog
 * - Edit existing clients
 * - Delete clients (soft delete)
 * - View client location on map
 * 
 * Design Tokens:
 * - Spacing: 16px, 24px
 * - Border radius: 8px (standard)
 * - Button height: 36px
 * 
 * Requirements: 9.1
 * Task: 9.5 Create clients page
 */

'use client'

import { useState, useMemo } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { ClientsTable } from './clients-table'
import { ClientForm } from './client-form'
import { SearchFilter } from '@/components/catalogs/search-filter'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { deleteClient } from '@/actions/catalogs'

interface Client {
  id: string
  dni: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  lat: number | null
  lng: number | null
  credit_limit: number
  credit_used: number
  dni_photo_url: string | null
  client_photo_url: string | null
  birthday: string | null
  active: boolean
}

interface ClientsManagerProps {
  initialClients: Client[]
}

export function ClientsManager({ initialClients }: ClientsManagerProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  // Debounce search query (300ms)
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Handle create client
  const handleCreate = () => {
    setEditingClient(null)
    setDialogOpen(true)
  }

  // Handle edit client
  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setDialogOpen(true)
  }

  // Handle delete client (soft delete)
  const handleDelete = async (client: Client) => {
    if (!confirm(`¿Está seguro de eliminar el cliente "${client.name}"?`)) {
      return
    }

    try {
      const result = await deleteClient(client.id)

      if (!result.success) {
        throw new Error(result.error as string || 'Error deleting client')
      }

      // Remove from local state
      setClients(clients.filter((c) => c.id !== client.id))

      toast.success('Cliente eliminado', `El cliente "${client.name}" ha sido eliminado correctamente.`)

      // Refresh the page data
      router.refresh()
    } catch (error) {
      console.error('Error deleting client:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error al eliminar el cliente')
    }
  }

  // Handle view location (placeholder - could open map modal or navigate to map page)
  const handleViewLocation = (client: Client) => {
    if (client.lat && client.lng) {
      // Open Google Maps in new tab
      const mapsUrl = `https://www.google.com/maps?q=${client.lat},${client.lng}`
      window.open(mapsUrl, '_blank')
    }
  }

  // Handle form success (create or update)
  const handleFormSuccess = (client: Client) => {
    if (editingClient) {
      // Update existing client in local state
      setClients(clients.map((c) => (c.id === client.id ? client : c)))
      toast.success('Cliente actualizado', `El cliente "${client.name}" ha sido actualizado correctamente.`)
    } else {
      // Add new client to local state
      setClients([client, ...clients])
      toast.success('Cliente creado', `El cliente "${client.name}" ha sido creado correctamente.`)
    }

    setDialogOpen(false)
    setEditingClient(null)

    // Refresh the page data
    router.refresh()
  }

  // Handle form cancel
  const handleFormCancel = () => {
    setDialogOpen(false)
    setEditingClient(null)
  }

  // Filter clients by search (debounced)
  const filteredClients = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return clients
    }

    const searchLower = debouncedSearch.toLowerCase()
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      c.dni?.toLowerCase().includes(searchLower) ||
      c.phone?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower)
    )
  }, [clients, debouncedSearch])

  return (
    <div className="space-y-6">
      {/* Header with title and create button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona el catálogo de clientes y su información de crédito (mostrando {filteredClients.length} de {clients.length})
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <SearchFilter
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nombre, DNI, teléfono o email..."
        />
      </div>

      {/* Clients Table */}
      <ClientsTable
        clients={filteredClients}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewLocation={handleViewLocation}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <ClientForm
            mode={editingClient ? 'edit' : 'create'}
            initialData={editingClient || undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
