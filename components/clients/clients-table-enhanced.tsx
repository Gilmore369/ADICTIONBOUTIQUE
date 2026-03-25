'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, AlertTriangle, Eye, Pencil, UserX } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { EditClientDialog } from './edit-client-dialog'
import { DeactivateClientDialog } from './deactivate-client-dialog'

interface Client {
  id: string
  dni: string | null
  name: string
  phone: string | null
  rating: 'A' | 'B' | 'C' | 'D' | 'E' | null
  rating_score: number | null
  last_purchase_date: string | null
  credit_used: number
  active: boolean
  deactivation_reason: string | null
  blacklisted?: boolean | null
}

interface ClientsTableEnhancedProps {
  clients: Client[]
  onExport: () => void
}

export function ClientsTableEnhanced({ clients, onExport }: ClientsTableEnhancedProps) {
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [deactivateClient, setDeactivateClient] = useState<{ id: string; name: string } | null>(null)

  const getRatingColor = (rating: string | null) => {
    switch (rating) {
      case 'A': return 'bg-green-100 text-green-800 border-green-200'
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'D': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'E': return 'bg-red-100 text-red-800 border-red-200'
      default:  return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getDebtStatus = (creditUsed: number) => {
    if (creditUsed === 0) {
      return { label: 'Sin deuda', color: 'bg-green-100 text-green-800 border-green-200' }
    } else {
      return { label: 'Con deuda', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Mostrando {clients.length} clientes
        </p>
        <Button onClick={onExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Calif.</TableHead>
              <TableHead>Última Compra</TableHead>
              <TableHead>Deuda</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground h-24"
                >
                  No se encontraron clientes con los filtros aplicados
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => {
                const debtStatus = getDebtStatus(client.credit_used)
                
                return (
                  <TableRow key={client.id} className="hover:bg-accent/50">
                    {/* Name */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        <Link href={`/clients/${client.id}`} className="hover:underline">
                          {client.name}
                        </Link>
                        {client.blacklisted && (
                          <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" title="Lista Negra" />
                        )}
                      </div>
                    </TableCell>

                    {/* DNI */}
                    <TableCell className="font-mono text-sm">{client.dni || '-'}</TableCell>

                    {/* Phone */}
                    <TableCell className="text-sm">{client.phone || '-'}</TableCell>

                    {/* Rating */}
                    <TableCell>
                      {client.rating ? (
                        <Badge variant="outline" className={`text-xs ${getRatingColor(client.rating)}`}>
                          {client.rating} {client.rating_score != null ? `(${client.rating_score})` : ''}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>

                    {/* Last Purchase */}
                    <TableCell className="text-sm">
                      {client.last_purchase_date
                        ? format(new Date(client.last_purchase_date), 'dd/MM/yyyy', { locale: es })
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>

                    {/* Debt Status */}
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${debtStatus.color}`}>
                        {debtStatus.label}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {client.active ? (
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">Activo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 border-gray-200">Inactivo</Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/clients/${client.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver perfil">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Editar cliente"
                          onClick={() => setEditClient(client)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {client.active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Dar de baja"
                            onClick={() => setDeactivateClient({ id: client.id, name: client.name })}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editClient && (
        <EditClientDialog
          client={editClient}
          open={!!editClient}
          onOpenChange={(open) => { if (!open) setEditClient(null) }}
        />
      )}

      {/* Deactivate Dialog */}
      {deactivateClient && (
        <DeactivateClientDialog
          clientId={deactivateClient.id}
          clientName={deactivateClient.name}
          open={!!deactivateClient}
          onOpenChange={(open) => { if (!open) setDeactivateClient(null) }}
        />
      )}
    </div>
  )
}
