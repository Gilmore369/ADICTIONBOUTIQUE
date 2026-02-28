/**
 * ClientsTable Component
 * 
 * A table component for displaying clients with credit information.
 * Displays client details including credit limit, credit used, and available credit.
 * 
 * Features:
 * - Responsive design with shadcn/ui Table
 * - Display columns: dni, name, phone, email, credit_limit, credit_used, available_credit, actions
 * - Calculated available credit (credit_limit - credit_used)
 * - Color-coded credit status (red if over limit, yellow if near limit, green if ok)
 * - Action buttons (edit, delete)
 * - Loading skeleton support
 * - Design tokens compliance (spacing, border-radius)
 * 
 * Design Tokens:
 * - Border radius: 8px (standard)
 * - Spacing: 8px, 16px
 * - Button height: 36px
 * 
 * Requirements: 14.1
 * Task: 9.4 Create client UI components
 * 
 * @example
 * ```tsx
 * <ClientsTable
 *   clients={clients}
 *   onEdit={(client) => console.log('Edit:', client)}
 *   onDelete={(client) => console.log('Delete:', client)}
 * />
 * ```
 */

'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  active: boolean
}

import { formatCurrency } from '@/lib/utils/currency'

interface ClientsTableProps {
  clients: Client[]
  onEdit?: (client: Client) => void
  onDelete?: (client: Client) => void
  onViewLocation?: (client: Client) => void
}

export function ClientsTable({
  clients,
  onEdit,
  onDelete,
  onViewLocation,
}: ClientsTableProps) {
  const router = useRouter()
  
  // Calculate available credit and determine status color
  const getCreditStatus = (client: Client) => {
    const available = client.credit_limit - client.credit_used
    const usagePercent = client.credit_limit > 0 
      ? (client.credit_used / client.credit_limit) * 100 
      : 0

    let statusColor = 'text-green-600' // Default: ok
    if (usagePercent >= 100) {
      statusColor = 'text-red-600' // Over limit
    } else if (usagePercent >= 80) {
      statusColor = 'text-yellow-600' // Near limit
    }

    return { available, statusColor }
  }

  const handleRowClick = (clientId: string) => {
    router.push(`/clients/${clientId}`)
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>DNI</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Límite Crédito</TableHead>
            <TableHead className="text-right">Crédito Usado</TableHead>
            <TableHead className="text-right">Crédito Disponible</TableHead>
            <TableHead className="text-center">Ubicación</TableHead>
            {(onEdit || onDelete) && (
              <TableHead className="text-right">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center text-muted-foreground h-24"
              >
                No hay clientes disponibles
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => {
              const { available, statusColor } = getCreditStatus(client)
              
              return (
                <TableRow 
                  key={client.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(client.id)}
                >
                  {/* DNI */}
                  <TableCell className="font-mono text-sm">
                    {client.dni || '-'}
                  </TableCell>
                  
                  {/* Name */}
                  <TableCell className="font-medium">
                    {client.name}
                  </TableCell>
                  
                  {/* Phone */}
                  <TableCell>
                    {client.phone || '-'}
                  </TableCell>
                  
                  {/* Email */}
                  <TableCell className="max-w-[200px] truncate">
                    {client.email || '-'}
                  </TableCell>
                  
                  {/* Credit Limit */}
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(client.credit_limit)}
                  </TableCell>
                  
                  {/* Credit Used */}
                  <TableCell className="text-right">
                    {formatCurrency(client.credit_used)}
                  </TableCell>
                  
                  {/* Available Credit - Color coded */}
                  <TableCell className={`text-right font-semibold ${statusColor}`}>
                    {formatCurrency(available)}
                  </TableCell>
                  
                  {/* Location */}
                  <TableCell className="text-center">
                    {client.lat && client.lng ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewLocation?.(client)
                        }}
                        className="h-8 w-8 p-0"
                        title={`Ver ubicación: ${client.lat}, ${client.lng}`}
                      >
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="sr-only">Ver ubicación</span>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  {/* Actions */}
                  {(onEdit || onDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(client)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(client)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
