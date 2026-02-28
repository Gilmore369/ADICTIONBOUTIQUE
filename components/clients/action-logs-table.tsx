/**
 * Action Logs Table Component
 * 
 * Displays action logs with action type, description, user, and timestamp.
 * 
 * Requirements: 7.4
 */

'use client'

import { ClientActionLog } from '@/lib/types/crm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FileText, Phone, MapPin, MessageSquare, RefreshCw, StickyNote } from 'lucide-react'

interface ActionLogsTableProps {
  logs: ClientActionLog[]
}

export function ActionLogsTable({ logs }: ActionLogsTableProps) {
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'NOTA':
        return <StickyNote className="h-4 w-4" />
      case 'LLAMADA':
        return <Phone className="h-4 w-4" />
      case 'VISITA':
        return <MapPin className="h-4 w-4" />
      case 'MENSAJE':
        return <MessageSquare className="h-4 w-4" />
      case 'REACTIVACION':
        return <RefreshCw className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getActionBadge = (actionType: string) => {
    const icon = getActionIcon(actionType)
    
    switch (actionType) {
      case 'NOTA':
        return <Badge variant="outline" className="flex items-center gap-1">{icon} Nota</Badge>
      case 'LLAMADA':
        return <Badge variant="secondary" className="flex items-center gap-1">{icon} Llamada</Badge>
      case 'VISITA':
        return <Badge variant="default" className="flex items-center gap-1 bg-blue-600">{icon} Visita</Badge>
      case 'MENSAJE':
        return <Badge variant="secondary" className="flex items-center gap-1">{icon} Mensaje</Badge>
      case 'REACTIVACION':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600">{icon} Reactivación</Badge>
      default:
        return <Badge variant="outline">{actionType}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Registro de Acciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay acciones registradas
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {getActionBadge(log.action_type)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {log.description}
                    </TableCell>
                    <TableCell>
                      {log.created_at.toLocaleDateString()}{' '}
                      {log.created_at.toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
