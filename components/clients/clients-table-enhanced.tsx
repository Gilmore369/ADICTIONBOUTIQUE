'use client'

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
import { Download } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

interface ClientsTableEnhancedProps {
  clients: Client[]
  onExport: () => void
}

export function ClientsTableEnhanced({ clients, onExport }: ClientsTableEnhancedProps) {
  const getRatingColor = (rating: string | null) => {
    switch (rating) {
      case 'A':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'B':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'C':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'D':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
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
              <TableHead>Calificación</TableHead>
              <TableHead>Última Compra</TableHead>
              <TableHead>Estado Deuda</TableHead>
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
                      <Link 
                        href={`/clients/${client.id}`}
                        className="hover:underline"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    
                    {/* DNI */}
                    <TableCell className="font-mono text-sm">
                      {client.dni || '-'}
                    </TableCell>
                    
                    {/* Phone */}
                    <TableCell>
                      {client.phone || '-'}
                    </TableCell>
                    
                    {/* Rating */}
                    <TableCell>
                      {client.rating ? (
                        <Badge variant="outline" className={getRatingColor(client.rating)}>
                          {client.rating} ({client.rating_score})
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    
                    {/* Last Purchase */}
                    <TableCell>
                      {client.last_purchase_date ? (
                        format(new Date(client.last_purchase_date), 'dd/MM/yyyy', { locale: es })
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    
                    {/* Debt Status */}
                    <TableCell>
                      <Badge variant="outline" className={debtStatus.color}>
                        {debtStatus.label}
                      </Badge>
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      {client.active ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell className="text-right">
                      <Link href={`/clients/${client.id}`}>
                        <Button variant="ghost" size="sm">
                          Ver Perfil
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
