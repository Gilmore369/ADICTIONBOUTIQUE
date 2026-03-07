'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Search, UserX, UserCheck, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'
import { AddToBlacklistDialog } from './add-to-blacklist-dialog'
import { RemoveFromBlacklistDialog } from './remove-from-blacklist-dialog'
import { toast } from 'sonner'

interface BlacklistedClient {
  id: string
  dni: string | null
  name: string
  phone: string | null
  credit_used: number
  blacklisted: boolean
  blacklisted_at: string | null
  blacklisted_reason: string | null
  blacklisted_by: string | null
}

interface Client {
  id: string
  dni: string | null
  name: string
  phone: string | null
  credit_used: number
  blacklisted: boolean
}

interface BlacklistManagementViewProps {
  blacklistedClients: BlacklistedClient[]
  allClients: Client[]
}

export function BlacklistManagementView({ 
  blacklistedClients: initialBlacklisted,
  allClients 
}: BlacklistManagementViewProps) {
  const [blacklistedClients, setBlacklistedClients] = useState<BlacklistedClient[]>(initialBlacklisted)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<BlacklistedClient | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // Filter blacklisted clients
  const filteredClients = useMemo(() => {
    if (!searchTerm) return blacklistedClients

    const term = searchTerm.toLowerCase()
    return blacklistedClients.filter(client =>
      client.name.toLowerCase().includes(term) ||
      client.dni?.toLowerCase().includes(term) ||
      client.phone?.toLowerCase().includes(term)
    )
  }, [blacklistedClients, searchTerm])

  // Get available clients (not blacklisted)
  const availableClients = useMemo(() => {
    return allClients.filter(c => !c.blacklisted)
  }, [allClients])

  const handleClientAdded = (clientId: string, reason: string) => {
    // Refresh the page to get updated data
    window.location.reload()
    toast.success('Cliente agregado a lista negra')
  }

  const handleClientRemoved = (clientId: string) => {
    // Remove from local state
    setBlacklistedClients(prev => prev.filter(c => c.id !== clientId))
    setSelectedClient(null)
    toast.success('Cliente removido de lista negra')
  }

  const handleRemoveClick = (client: BlacklistedClient) => {
    setSelectedClient(client)
    setShowRemoveDialog(true)
  }

  const getReasonBadge = (reason: string | null) => {
    if (!reason) return null

    const reasonMap: Record<string, { label: string; color: string }> = {
      'DEUDA_EXCESIVA': { label: 'Deuda Excesiva', color: 'bg-red-100 text-red-800 border-red-200' },
      'NO_PAGA': { label: 'No Paga', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      'DECISION_GERENCIA': { label: 'Decisión Gerencia', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      'MAL_COMPORTAMIENTO': { label: 'Mal Comportamiento', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      'OTRO': { label: 'Otro', color: 'bg-gray-100 text-gray-800 border-gray-200' }
    }

    const config = reasonMap[reason] || reasonMap['OTRO']
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            Lista Negra
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona clientes bloqueados para ventas a crédito
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar a Lista Negra
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-red-50 to-orange-50 border-red-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{blacklistedClients.length}</p>
          <p className="text-xs text-gray-600 mt-1">Clientes bloqueados</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(blacklistedClients.reduce((sum, c) => sum + c.credit_used, 0))}
          </p>
          <p className="text-xs text-gray-600 mt-1">Deuda total bloqueados</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{availableClients.length}</p>
          <p className="text-xs text-gray-600 mt-1">Clientes activos</p>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, DNI o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Blacklisted Clients Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deuda</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Bloqueo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    {searchTerm ? 'No se encontraron clientes' : 'No hay clientes en lista negra'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {client.dni || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {client.phone || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {getReasonBadge(client.blacklisted_reason)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatCurrency(client.credit_used)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatSafeDate(client.blacklisted_at, 'dd/MM/yyyy HH:mm', '-')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveClick(client)}
                        className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <UserCheck className="h-4 w-4" />
                        Desbloquear
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialogs */}
      <AddToBlacklistDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        availableClients={availableClients}
        onSuccess={handleClientAdded}
      />

      {selectedClient && (
        <RemoveFromBlacklistDialog
          open={showRemoveDialog}
          onOpenChange={setShowRemoveDialog}
          client={selectedClient}
          onSuccess={handleClientRemoved}
        />
      )}
    </div>
  )
}
